import { z } from 'zod';

import {
  CATALOG_ENUM_VALUES as ENUMS,
  CATEGORY_TYPES,
  EXERCISE_STATUSES,
  MEDIA_STATUSES
} from '../constants/catalogEnums.js';
import { createSlug, normalizeExerciseName } from '../utils/slugs.js';

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case slugs');

const displayOrderSchema = z.number().int().nonnegative().default(0);

const namedReferenceSchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string().optional(),
  displayOrder: displayOrderSchema
});

const muscleSchema = namedReferenceSchema.extend({
  region: z.string().min(1),
  muscleGroup: z.string().min(1)
});

const equipmentSchema = namedReferenceSchema.extend({
  equipmentGroup: z.string().min(1).optional()
});

const categorySchema = namedReferenceSchema.extend({
  category: z.enum(CATEGORY_TYPES),
  description: z.string().min(1)
});

const exerciseFlagSchema = namedReferenceSchema.extend({
  description: z.string().min(1)
});

const jointRegionSchema = namedReferenceSchema.extend({
  regionGroup: z.string().min(1).optional()
});

const mediaSchema = z.object({
  type: z.enum(ENUMS.mediaTypes),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  angle: z.string().min(1).optional(),
  caption: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  source: z.string().min(1).optional(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
  status: z.enum(MEDIA_STATUSES).default('active')
});

const exerciseSchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  status: z.enum(EXERCISE_STATUSES).default('active'),
  description: z.string().min(1),
  instructions: z.array(z.string().min(1)).min(1),
  tips: z.array(z.string().min(1)).default([]),
  breathingCues: z.string().min(1).optional(),
  contraindications: z.array(z.string().min(1)).default([]),
  categorySlug: slugSchema,
  difficulty: z.enum(ENUMS.difficulties),
  movementPattern: z.enum(ENUMS.movementPatterns),
  forceType: z.enum(ENUMS.forceTypes).optional(),
  mechanics: z.enum(ENUMS.mechanics),
  position: z.enum(ENUMS.positions).optional(),
  planeOfMotion: z.enum(ENUMS.planesOfMotion).optional(),
  jointRegionSlugs: z.array(slugSchema).default([]),
  laterality: z.enum(ENUMS.lateralities).optional(),
  loadType: z.enum(ENUMS.loadTypes).optional(),
  skillType: z.enum(ENUMS.skillTypes).optional(),
  flagSlugs: z.array(slugSchema).default([]),
  programming: z.record(z.unknown()).default({}),
  tags: z.array(slugSchema).default([]),
  isPremium: z.boolean().default(false),
  catalogVersion: z.number().int().positive().default(1),
  aliases: z.array(z.string().min(1)).default([]),
  primaryMuscleSlugs: z.array(slugSchema).min(1),
  secondaryMuscleSlugs: z.array(slugSchema).default([]),
  stabilizerMuscleSlugs: z.array(slugSchema).default([]),
  equipmentSlugs: z.array(slugSchema).default([]),
  variationSlugs: z.array(slugSchema).default([]),
  progressionSlugs: z.array(slugSchema).default([]),
  regressionSlugs: z.array(slugSchema).default([]),
  media: z.array(mediaSchema).default([])
});

const referenceFixturesSchema = z.object({
  muscles: z.array(muscleSchema),
  equipment: z.array(equipmentSchema),
  categories: z.array(categorySchema),
  exerciseFlags: z.array(exerciseFlagSchema),
  jointRegions: z.array(jointRegionSchema)
});

const exerciseFixturesSchema = z.array(exerciseSchema);

export function parseReferenceFixtures(source) {
  const fixtures = parseWithMessage(
    referenceFixturesSchema,
    normalizeReferenceSource(source),
    'Invalid reference fixtures'
  );

  assertUniqueSlugs('muscles', fixtures.muscles);
  assertUniqueSlugs('equipment', fixtures.equipment);
  assertUniqueSlugs('categories', fixtures.categories);
  assertUniqueSlugs('exerciseFlags', fixtures.exerciseFlags);
  assertUniqueSlugs('jointRegions', fixtures.jointRegions);

  return fixtures;
}

export function parseExerciseFixtures(source) {
  const exercises = parseWithMessage(
    exerciseFixturesSchema,
    normalizeSluggedItems(source),
    'Invalid exercise fixtures'
  );

  assertUniqueSlugs('exercises', exercises);
  assertUniqueNames(exercises);

  return exercises;
}

export function parseCatalogFixtures({ references, exercises }) {
  const parsedReferences = parseReferenceFixtures(references);
  const parsedExercises = parseExerciseFixtures(exercises);

  assertExerciseReferences(parsedReferences, parsedExercises);

  return {
    references: parsedReferences,
    exercises: parsedExercises
  };
}

function parseWithMessage(schema, source, message) {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new Error(`${message}: ${result.error.message}`);
  }

  return result.data;
}

function normalizeReferenceSource(source) {
  return {
    muscles: normalizeSluggedItems(source.muscles),
    equipment: normalizeSluggedItems(source.equipment),
    categories: normalizeSluggedItems(source.categories),
    exerciseFlags: normalizeSluggedItems(source.exerciseFlags),
    jointRegions: normalizeSluggedItems(source.jointRegions)
  };
}

function normalizeSluggedItems(items = []) {
  return items.map((item) => ({
    ...item,
    slug: item.slug ?? createSlug(item.name)
  }));
}

function assertUniqueSlugs(label, items) {
  const seen = new Set();

  for (const item of items) {
    if (seen.has(item.slug)) {
      throw new Error(`Invalid ${label}: duplicate slug "${item.slug}"`);
    }

    seen.add(item.slug);
  }
}

// Every name and alias must resolve to one exercise, ignoring case and
// punctuation, or a client looking a name up cannot tell which record it means.
function assertUniqueNames(exercises) {
  const ownerByKey = new Map();

  for (const exercise of exercises) {
    for (const name of [exercise.name, ...exercise.aliases]) {
      const key = normalizeExerciseName(name);
      const owner = ownerByKey.get(key);

      if (owner && owner !== exercise.slug) {
        throw new Error(
          `Invalid exercises: "${name}" on "${exercise.slug}" matches a name or alias of "${owner}"`
        );
      }

      ownerByKey.set(key, exercise.slug);
    }
  }
}

function assertExerciseReferences(references, exercises) {
  const referenceSets = buildReferenceSets(references, exercises);

  for (const exercise of exercises) {
    assertKnownSlug(
      referenceSets.categories,
      exercise.categorySlug,
      'category'
    );
    assertKnownSlugs(
      referenceSets.jointRegions,
      exercise.jointRegionSlugs,
      'joint region'
    );
    assertKnownSlugs(referenceSets.flags, exercise.flagSlugs, 'exercise flag');
    assertKnownSlugs(referenceSets.muscles, allMuscleSlugs(exercise), 'muscle');
    assertKnownSlugs(
      referenceSets.equipment,
      exercise.equipmentSlugs,
      'equipment'
    );
    assertKnownSlugs(
      referenceSets.exercises,
      allRelatedExerciseSlugs(exercise),
      'exercise'
    );
  }
}

function buildReferenceSets(references, exercises) {
  return {
    muscles: toSlugSet(references.muscles),
    equipment: toSlugSet(references.equipment),
    categories: toSlugSet(references.categories),
    flags: toSlugSet(references.exerciseFlags),
    jointRegions: toSlugSet(references.jointRegions),
    exercises: toSlugSet(exercises)
  };
}

function toSlugSet(items) {
  return new Set(items.map((item) => item.slug));
}

function allMuscleSlugs(exercise) {
  return [
    ...exercise.primaryMuscleSlugs,
    ...exercise.secondaryMuscleSlugs,
    ...exercise.stabilizerMuscleSlugs
  ];
}

function allRelatedExerciseSlugs(exercise) {
  return [
    ...exercise.variationSlugs,
    ...exercise.progressionSlugs,
    ...exercise.regressionSlugs
  ];
}

function assertKnownSlugs(knownSlugs, slugs, label) {
  for (const slug of slugs) {
    assertKnownSlug(knownSlugs, slug, label);
  }
}

function assertKnownSlug(knownSlugs, slug, label) {
  if (!knownSlugs.has(slug)) {
    throw new Error(`unknown ${label} slug "${slug}"`);
  }
}
