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

const count = z.number().int().positive();

// Structured defaults sit next to the free-text `defaultReps`; see
// assertProgrammingAgrees for how the two must match.
const programmingSchema = z
  .object({
    defaultSets: count.optional(),
    defaultReps: z.union([z.string().min(1), count]).optional(),
    defaultRepsMin: count.optional(),
    defaultRepsMax: count.optional(),
    perSide: z.boolean(),
    defaultDistanceMetersMin: count.optional(),
    defaultDistanceMetersMax: count.optional(),
    defaultDurationSeconds: count.optional(),
    defaultDurationMinutes: count.optional()
  })
  .strict();

const step = z.number().positive().nullable();

// The facts the app's progression logic reads (FitTrackV2
// docs/PROGRESSION.md). Every key is always present, null when unused; see
// assertProgressionRuleAgrees for which keys each model needs.
const progressionRuleSchema = z
  .object({
    model: z.enum(ENUMS.progressionModels),
    loadStepKg: step,
    loadStepLb: step,
    durationStepSeconds: z.number().int().positive().nullable(),
    distanceStepMeters: step,
    stallSessions: count.nullable(),
    resetPercent: z.number().positive().max(50).nullable(),
    note: z.string().min(1).nullable()
  })
  .strict();

// How hard an exercise loads each joint region (FitTrackV2
// docs/EXERCISES-API-SYNC.md, request 5), and the 1-2 gentler exercises for
// each region rated high. assertJointStressAgrees ties both to jointRegions.
const jointStressSchema = z.record(slugSchema, z.enum(ENUMS.jointStressLevels));
const gentlerSwapsSchema = z.record(
  slugSchema,
  z.array(slugSchema).min(1).max(2)
);

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
  programming: programmingSchema,
  progressionRule: progressionRuleSchema,
  jointStress: jointStressSchema,
  gentlerSwapSlugs: gentlerSwapsSchema.default({}),
  trackingType: z.enum(ENUMS.trackingTypes),
  tags: z.array(slugSchema).default([]),
  isPremium: z.boolean().default(false),
  catalogVersion: z.number().int().positive().default(1),
  aliases: z.array(z.string().min(1)).default([]),
  primaryMuscleSlugs: z.array(slugSchema).min(1),
  secondaryMuscleSlugs: z.array(slugSchema).default([]),
  stabilizerMuscleSlugs: z.array(slugSchema).default([]),
  equipmentSlugs: z.array(slugSchema).default([]),
  optionalEquipmentSlugs: z.array(slugSchema).default([]),
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

  for (const exercise of exercises) {
    assertProgrammingAgrees(exercise);
    assertProgressionRuleAgrees(exercise);
    assertJointStressAgrees(exercise);
  }

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

const OPTIONAL_LOAD_EQUIPMENT = ['dumbbell', 'kettlebell'];

const REPS_TEXT = /^(\d+)(?:-(\d+))?( each side)?$/;
const METRES_TEXT = /^(\d+)-(\d+) metres( each side)?$/;

/**
 * The structured programming fields must say the same thing as the text:
 * "8-12 each side" is defaultRepsMin 8, defaultRepsMax 12, perSide true;
 * "15-25 metres" is a distance range; minutes and seconds must agree.
 */
export function assertProgrammingAgrees({ slug, programming: p }) {
  const fail = (message) => {
    throw new Error(`Invalid programming on "${slug}": ${message}`);
  };
  const text = p.defaultReps === undefined ? undefined : String(p.defaultReps);
  const metres = text?.match(METRES_TEXT);
  const reps = metres ? null : text?.match(REPS_TEXT);
  const expected = {
    defaultRepsMin: reps ? Number(reps[1]) : undefined,
    defaultRepsMax: reps ? Number(reps[2] ?? reps[1]) : undefined,
    defaultDistanceMetersMin: metres ? Number(metres[1]) : undefined,
    defaultDistanceMetersMax: metres ? Number(metres[2]) : undefined
  };

  if (text !== undefined && !metres && !reps) {
    fail(`unrecognised defaultReps "${text}"`);
  }
  for (const [key, value] of Object.entries(expected)) {
    if (p[key] !== value) {
      fail(`${key} is ${p[key]}, expected ${value} from "${text}"`);
    }
  }
  if (text !== undefined && text.endsWith('each side') !== p.perSide) {
    fail(`perSide is ${p.perSide} but defaultReps is "${text}"`);
  }
  if (
    p.defaultDurationMinutes !== undefined &&
    p.defaultDurationSeconds !== p.defaultDurationMinutes * 60
  ) {
    fail('defaultDurationSeconds must equal defaultDurationMinutes * 60');
  }
  if (text === undefined && p.defaultDurationSeconds === undefined) {
    fail('needs defaultReps or defaultDurationSeconds');
  }
}

/**
 * Each model carries exactly the steps it uses: `double` and `load_then_reps`
 * a kg and lb load step, `duration` a seconds step, `distance` a metres step.
 * `reps` takes a load step only when its optional equipment adds load (a
 * dumbbell or kettlebell, request 4 in the app sync file); otherwise a harder
 * variant is a progressions link. A reset is a percentage of load, so
 * resetPercent is set exactly when load steps are. `none` has no steps, stall
 * or reset at all.
 */
export function assertProgressionRuleAgrees({
  slug,
  progressionRule: r,
  optionalEquipmentSlugs = []
}) {
  const fail = (message) => {
    throw new Error(`Invalid progressionRule on "${slug}": ${message}`);
  };
  const loadModels = optionalEquipmentSlugs.some((item) =>
    OPTIONAL_LOAD_EQUIPMENT.includes(item)
  )
    ? ['double', 'load_then_reps', 'reps']
    : ['double', 'load_then_reps'];
  const needs = {
    loadStepKg: loadModels,
    loadStepLb: loadModels,
    durationStepSeconds: ['duration'],
    distanceStepMeters: ['distance']
  };

  for (const [key, models] of Object.entries(needs)) {
    if (models.includes(r.model) !== (r[key] !== null)) {
      fail(
        `${key} must be ${models.includes(r.model) ? 'set' : 'null'} for ${r.model}`
      );
    }
  }
  if ((r.model === 'none') !== (r.stallSessions === null)) {
    fail(`stallSessions must be null exactly when model is none`);
  }
  if ((r.loadStepKg === null) !== (r.resetPercent === null)) {
    fail('resetPercent must be set exactly when the load steps are');
  }
}

/**
 * jointRegions says a joint is involved; jointStress says how hard. A region
 * rated none is never listed, a moderate or high one always is (low may be
 * either), and gentlerSwapSlugs has a key for exactly the regions rated high.
 */
export function assertJointStressAgrees({
  slug,
  jointStress,
  jointRegionSlugs,
  gentlerSwapSlugs = {}
}) {
  const fail = (message) => {
    throw new Error(`Invalid jointStress on "${slug}": ${message}`);
  };
  const high = [];

  for (const [region, level] of Object.entries(jointStress)) {
    const listed = jointRegionSlugs.includes(region);

    if (level === 'none' && listed) {
      fail(`${region} is rated none but listed in jointRegionSlugs`);
    }
    if ((level === 'moderate' || level === 'high') && !listed) {
      fail(`${region} is rated ${level} but not in jointRegionSlugs`);
    }
    if (level === 'high') {
      high.push(region);
    }
  }
  for (const region of jointRegionSlugs) {
    if (!(region in jointStress)) {
      fail(`${region} is in jointRegionSlugs but has no rating`);
    }
  }
  if ([...high].sort().join() !== Object.keys(gentlerSwapSlugs).sort().join()) {
    fail(
      `gentlerSwapSlugs needs a key for exactly the high regions (${high.join(', ') || 'none'})`
    );
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
      [...exercise.equipmentSlugs, ...exercise.optionalEquipmentSlugs],
      'equipment'
    );
    for (const slug of exercise.optionalEquipmentSlugs) {
      if (exercise.equipmentSlugs.includes(slug)) {
        throw new Error(
          `"${exercise.slug}" lists "${slug}" as both required and optional equipment`
        );
      }
    }
    assertKnownSlugs(
      referenceSets.exercises,
      allRelatedExerciseSlugs(exercise),
      'exercise'
    );
    assertJointStressReferences(references, exercise, exercises);
  }
}

// A rating for every joint region and no other, and swaps that exist, are
// active, and really are gentler on the region they replace.
function assertJointStressReferences(references, exercise, exercises) {
  const fail = (message) => {
    throw new Error(`Invalid jointStress on "${exercise.slug}": ${message}`);
  };
  const regions = references.jointRegions.map((item) => item.slug);
  const rated = Object.keys(exercise.jointStress);

  if ([...regions].sort().join() !== [...rated].sort().join()) {
    fail(`needs a rating for exactly ${regions.join(', ')}`);
  }

  const levels = ENUMS.jointStressLevels;
  const bySlug = new Map(exercises.map((item) => [item.slug, item]));

  for (const [region, swapSlugs] of Object.entries(exercise.gentlerSwapSlugs)) {
    assertKnownSlugs(new Set(bySlug.keys()), swapSlugs, 'swap exercise');
    if (new Set(swapSlugs).size !== swapSlugs.length) {
      fail(`${region} lists the same swap twice`);
    }
    for (const swapSlug of swapSlugs) {
      const swap = bySlug.get(swapSlug);

      if (swap.slug === exercise.slug) {
        fail(`${region} swaps the exercise for itself`);
      }
      if (swap.status !== 'active') {
        fail(`${region} swap "${swapSlug}" is not active`);
      }
      if (
        levels.indexOf(swap.jointStress[region]) >=
        levels.indexOf(exercise.jointStress[region])
      ) {
        fail(
          `${region} swap "${swapSlug}" (${swap.jointStress[region]}) is not gentler than ${exercise.jointStress[region]}`
        );
      }
    }
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
