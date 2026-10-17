import { describe, expect, it, vi } from 'vitest';

import { CATALOG_ENUM_VALUES } from '../src/constants/catalogEnums.js';
import { createSyncRepository } from '../src/repositories/syncRepository.js';
import { buildCatalogExport } from '../src/services/catalogExportService.js';
import { catalogExportSchema } from '../src/validation/catalogExport.js';

const SQUAT_ID = '00000000-0000-4000-8000-000000000001';
const GOBLET_ID = '00000000-0000-4000-8000-000000000002';

function exercise(overrides) {
  return {
    id: SQUAT_ID,
    slug: 'barbell-back-squat',
    name: 'Barbell Back Squat',
    status: 'active',
    category: 'strength',
    difficulty: 'intermediate',
    movementPattern: 'squat',
    tags: ['barbell'],
    updatedAt: '2026-10-17T10:00:00+00:00',
    description: 'A squat with the bar across the upper back.',
    instructions: ['Unrack.', 'Squat.', 'Stand.'],
    tips: [],
    breathingCues: null,
    contraindications: [],
    forceType: 'push',
    mechanics: 'compound',
    position: 'standing',
    planeOfMotion: 'sagittal',
    jointRegions: ['hip', 'knee'],
    laterality: 'bilateral',
    loadType: 'free_weight',
    skillType: 'strength',
    flags: ['compound'],
    programming: { defaultSets: 4, defaultReps: '5-10' },
    isPremium: false,
    catalogVersion: 7,
    primaryMuscles: ['quadriceps', 'glutes'],
    secondaryMuscles: ['adductors'],
    stabilizerMuscles: ['abs'],
    equipment: ['barbell'],
    aliases: ['Barbell Squat'],
    variations: [],
    progressions: [],
    regressions: [{ id: GOBLET_ID, slug: 'goblet-squat' }],
    media: [],
    ...overrides
  };
}

function reference(slug, displayOrder, extra = {}) {
  return {
    id: displayOrder,
    slug,
    name: slug,
    displayOrder,
    updatedAt: '2026-06-15T10:00:00+00:00',
    ...extra
  };
}

function fakeRepositories(exercises) {
  const calls = [];
  const syncRepository = {
    getSyncMetadata: vi.fn(async () => {
      calls.push('metadata');
      return {
        catalogVersion: 7,
        latestChangeAt: '2026-10-17T10:00:00+00:00'
      };
    }),
    listActiveExercises: vi.fn(async () => {
      calls.push('exercises');
      return exercises;
    })
  };
  const referenceRepository = {
    getMetadata: vi.fn(async () => ({
      muscles: [
        reference('quadriceps', 150, { region: 'lower_body' }),
        reference('glutes', 170),
        reference('adductors', 180),
        reference('abs', 120)
      ],
      equipment: [reference('dumbbell', 30), reference('barbell', 20)],
      categories: [reference('strength', 10)],
      exerciseFlags: [reference('compound', 40)],
      jointRegions: [reference('hip', 40), reference('knee', 50)],
      enums: CATALOG_ENUM_VALUES
    }))
  };

  return { calls, syncRepository, referenceRepository };
}

const goblet = exercise({
  id: GOBLET_ID,
  slug: 'goblet-squat',
  name: 'Goblet Squat',
  equipment: ['dumbbell'],
  aliases: [],
  regressions: [],
  progressions: [{ id: SQUAT_ID, slug: 'barbell-back-squat' }]
});

describe('catalog export', () => {
  it('builds a file that validates against the export schema', async () => {
    const { syncRepository, referenceRepository } = fakeRepositories([
      exercise(),
      goblet
    ]);

    const file = await buildCatalogExport({
      syncRepository,
      referenceRepository,
      now: () => new Date('2026-10-17T12:00:00.000Z')
    });

    expect(catalogExportSchema.safeParse(file).success).toBe(true);
    expect(Object.keys(file)).toEqual([
      'catalogVersion',
      'exportedAt',
      'latestChangeAt',
      'muscles',
      'equipment',
      'categories',
      'exerciseFlags',
      'jointRegions',
      'enums',
      'exercises'
    ]);
    expect(file).toMatchObject({
      catalogVersion: 7,
      exportedAt: '2026-10-17T12:00:00.000Z',
      latestChangeAt: '2026-10-17T10:00:00+00:00'
    });
    expect(file.enums.movementPatterns).toContain('core');
  });

  it('sorts exercises by slug and references by display order', async () => {
    const { syncRepository, referenceRepository } = fakeRepositories([
      goblet,
      exercise()
    ]);

    const file = await buildCatalogExport({
      syncRepository,
      referenceRepository
    });

    expect(file.exercises.map((item) => item.slug)).toEqual([
      'barbell-back-squat',
      'goblet-squat'
    ]);
    expect(file.muscles.map((item) => item.slug)).toEqual([
      'abs',
      'quadriceps',
      'glutes',
      'adductors'
    ]);
    expect(file.equipment.map((item) => item.slug)).toEqual([
      'barbell',
      'dumbbell'
    ]);
  });

  it('serialises identically on two runs over the same data', async () => {
    const run = async (exercises) => {
      const { syncRepository, referenceRepository } =
        fakeRepositories(exercises);
      const file = await buildCatalogExport({
        syncRepository,
        referenceRepository,
        now: () => new Date('2026-10-17T12:00:00.000Z')
      });
      return JSON.stringify(file);
    };

    expect(await run([goblet, exercise()])).toBe(
      await run([exercise(), goblet])
    );
  });

  it('reads the sync watermark before the exercises', async () => {
    const { calls, syncRepository, referenceRepository } = fakeRepositories([
      exercise({ regressions: [] })
    ]);

    await buildCatalogExport({ syncRepository, referenceRepository });

    expect(calls).toEqual(['metadata', 'exercises']);
  });

  it('accepts an exercise with no media and one with media', () => {
    const file = {
      catalogVersion: 7,
      exportedAt: '2026-10-17T12:00:00.000Z',
      latestChangeAt: null,
      muscles: [
        reference('quadriceps', 1),
        reference('glutes', 2),
        reference('adductors', 3),
        reference('abs', 4)
      ],
      equipment: [reference('barbell', 1)],
      categories: [],
      exerciseFlags: [],
      jointRegions: [],
      enums: CATALOG_ENUM_VALUES,
      exercises: [
        exercise({ regressions: [], media: [] }),
        exercise({
          id: GOBLET_ID,
          slug: 'second',
          regressions: [],
          media: [
            {
              type: 'image',
              url: 'https://cdn.example.com/squat.png',
              thumbnailUrl: null,
              angle: 'front',
              caption: 'Bottom of the squat',
              isPrimary: true,
              sortOrder: 0,
              width: 1024,
              height: 1024,
              durationSeconds: null
            }
          ]
        })
      ]
    };

    expect(catalogExportSchema.safeParse(file).success).toBe(true);
  });

  it('rejects draft records, unknown muscles and links outside the file', async () => {
    const build = (exercises) => {
      const { syncRepository, referenceRepository } =
        fakeRepositories(exercises);
      return buildCatalogExport({ syncRepository, referenceRepository });
    };

    await expect(
      build([exercise({ regressions: [], status: 'draft' })])
    ).rejects.toThrow(/Invalid catalog export/);
    await expect(
      build([exercise({ regressions: [], primaryMuscles: ['wings'] })])
    ).rejects.toThrow(/unknown muscle .*wings/);
    await expect(build([exercise()])).rejects.toThrow(
      /links to .*goblet-squat.*not in the export/
    );
  });

  it('rejects a premium record', async () => {
    const { syncRepository, referenceRepository } = fakeRepositories([
      exercise({ regressions: [], isPremium: true })
    ]);

    await expect(
      buildCatalogExport({ syncRepository, referenceRepository })
    ).rejects.toThrow(/Invalid catalog export/);
  });

  it('rejects a record with a field the schema does not know', async () => {
    const { syncRepository, referenceRepository } = fakeRepositories([
      exercise({ regressions: [], surprise: true })
    ]);

    await expect(
      buildCatalogExport({ syncRepository, referenceRepository })
    ).rejects.toThrow(/Invalid catalog export/);
  });
});

describe('listActiveExercises', () => {
  it('reads only active exercises, in slug order, page by page', async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) => ({
      id: `id-${index}`,
      slug: `slug-${index}`
    }));
    const client = {
      select: vi
        .fn()
        .mockResolvedValueOnce(pageOne)
        .mockResolvedValueOnce([{ id: 'id-100', slug: 'slug-100' }])
    };

    const exercises = await createSyncRepository({
      client
    }).listActiveExercises();

    expect(exercises).toHaveLength(101);
    expect(client.select).toHaveBeenCalledTimes(2);
    expect(client.select).toHaveBeenLastCalledWith('exercises', {
      columns: expect.stringContaining('exercise_media('),
      filters: {
        status: 'eq.active',
        deleted_at: 'is.null',
        is_premium: 'is.false',
        order: 'slug.asc',
        limit: '100',
        offset: '100'
      }
    });
  });
});
