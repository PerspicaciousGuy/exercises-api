import { z } from 'zod';

import { CATALOG_ENUM_VALUES as ENUMS } from '../constants/catalogEnums.js';

// The contract for the file `npm run export:catalog` writes. Strict objects:
// a field added to the full record without updating this schema fails the
// export, so the bundle format never changes by accident.

const slugs = z.array(z.string().min(1));
const nullableString = z.string().nullable();
const exerciseRef = z
  .object({ id: z.string().uuid(), slug: z.string() })
  .strict();

const media = z
  .object({
    type: z.enum(ENUMS.mediaTypes),
    url: z.string().url(),
    thumbnailUrl: z.string().url().nullable(),
    angle: nullableString,
    caption: nullableString,
    isPrimary: z.boolean(),
    sortOrder: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    durationSeconds: z.number().int().positive().nullable()
  })
  .strict();

const exercise = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    // Draft and deprecated records are never exported.
    status: z.literal('active'),
    category: nullableString,
    difficulty: z.enum(ENUMS.difficulties),
    movementPattern: z.enum(ENUMS.movementPatterns),
    tags: slugs,
    updatedAt: z.string().min(1),
    description: z.string().min(1),
    instructions: z.array(z.string().min(1)).min(1),
    tips: z.array(z.string()),
    breathingCues: nullableString,
    contraindications: z.array(z.string()),
    forceType: z.enum(ENUMS.forceTypes).nullable(),
    mechanics: z.enum(ENUMS.mechanics),
    position: z.enum(ENUMS.positions).nullable(),
    planeOfMotion: z.enum(ENUMS.planesOfMotion).nullable(),
    jointRegions: slugs,
    laterality: z.enum(ENUMS.lateralities).nullable(),
    loadType: z.enum(ENUMS.loadTypes).nullable(),
    skillType: z.enum(ENUMS.skillTypes).nullable(),
    flags: slugs,
    programming: z.record(z.unknown()),
    isPremium: z.boolean(),
    catalogVersion: z.number().int().positive(),
    primaryMuscles: slugs.min(1),
    secondaryMuscles: slugs,
    stabilizerMuscles: slugs,
    equipment: slugs,
    aliases: z.array(z.string().min(1)),
    variations: z.array(exerciseRef),
    progressions: z.array(exerciseRef),
    regressions: z.array(exerciseRef),
    media: z.array(media)
  })
  .strict();

const reference = z
  .object({
    id: z.number().int(),
    slug: z.string().min(1),
    name: z.string().min(1),
    displayOrder: z.number().int(),
    updatedAt: z.string().min(1)
  })
  .passthrough();

const enumsSchema = z.object(
  Object.fromEntries(
    Object.keys(ENUMS).map((key) => [key, z.array(z.string()).min(1)])
  )
);

export const catalogExportSchema = z
  .object({
    catalogVersion: z.number().int().positive(),
    exportedAt: z.string().datetime({ offset: true }),
    latestChangeAt: z.string().nullable(),
    muscles: z.array(reference),
    equipment: z.array(reference),
    categories: z.array(reference),
    exerciseFlags: z.array(reference),
    jointRegions: z.array(reference),
    enums: enumsSchema,
    exercises: z.array(exercise)
  })
  .strict()
  .superRefine((file, context) => {
    const exerciseIds = new Set(file.exercises.map((item) => item.id));
    const known = {
      muscle: new Set(file.muscles.map((item) => item.slug)),
      equipment: new Set(file.equipment.map((item) => item.slug))
    };

    for (const item of file.exercises) {
      const checks = [
        ...[
          ...item.primaryMuscles,
          ...item.secondaryMuscles,
          ...item.stabilizerMuscles
        ].map((slug) => ['muscle', slug]),
        ...item.equipment.map((slug) => ['equipment', slug])
      ];

      for (const [kind, slug] of checks) {
        if (!known[kind].has(slug)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${item.slug}: unknown ${kind} "${slug}"`
          });
        }
      }

      // A bundled record must never link to an exercise the bundle lacks.
      for (const ref of [
        ...item.variations,
        ...item.progressions,
        ...item.regressions
      ]) {
        if (!exerciseIds.has(ref.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${item.slug}: links to "${ref.slug}", which is not in the export`
          });
        }
      }
    }
  });

export function parseCatalogExport(value) {
  const result = catalogExportSchema.safeParse(value);

  if (!result.success) {
    throw new Error(`Invalid catalog export: ${result.error.message}`);
  }

  return result.data;
}
