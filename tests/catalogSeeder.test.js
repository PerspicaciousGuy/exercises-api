import { describe, expect, it, vi } from 'vitest';

import { hashExercise } from '../src/import/catalogImportPlans.js';
import {
  importExerciseData,
  seedReferenceData
} from '../src/import/catalogSeeder.js';

describe('catalog seeder', () => {
  it('upserts reference rows and returns slug lookup maps', async () => {
    const client = {
      upsert: vi.fn(async (table, rows) =>
        rows.map((row, index) => ({
          id: index + 1,
          slug: row.slug
        }))
      )
    };

    const lookups = await seedReferenceData({
      client,
      references: {
        muscles: [
          {
            name: 'Chest',
            slug: 'chest',
            region: 'upper_body',
            muscleGroup: 'push',
            displayOrder: 10
          }
        ],
        equipment: [
          {
            name: 'Bodyweight',
            slug: 'bodyweight',
            equipmentGroup: 'bodyweight',
            displayOrder: 10
          }
        ],
        categories: [
          {
            name: 'Strength',
            slug: 'strength',
            category: 'strength',
            description: 'Resistance training movements.',
            displayOrder: 10
          }
        ],
        exerciseFlags: [],
        jointRegions: []
      }
    });

    expect(client.upsert).toHaveBeenCalledWith(
      'categories',
      expect.any(Array),
      { onConflict: 'slug' }
    );
    expect(lookups.categoryIdsBySlug.get('strength')).toBe(1);
    expect(lookups.muscleIdsBySlug.get('chest')).toBe(1);
    expect(lookups.equipmentIdsBySlug.get('bodyweight')).toBe(1);
  });

  it('imports exercises and normalized relation rows', async () => {
    const client = {
      select: vi.fn(async () => []),
      upsert: vi.fn(async (table, rows) => rows),
      insert: vi.fn(async (table, rows) => rows),
      delete: vi.fn(async () => [])
    };

    await importExerciseData({
      client,
      idFactory: () => 'exercise-1',
      referenceLookups: {
        categoryIdsBySlug: new Map([['strength', 1]]),
        muscleIdsBySlug: new Map([['chest', 10]]),
        equipmentIdsBySlug: new Map([['bodyweight', 20]])
      },
      exercises: [
        {
          name: 'Push-up',
          slug: 'push-up',
          status: 'active',
          description: 'A bodyweight upper-body pushing exercise.',
          instructions: ['Start in a high plank.'],
          tips: [],
          contraindications: [],
          categorySlug: 'strength',
          difficulty: 'beginner',
          movementPattern: 'push',
          mechanics: 'compound',
          jointRegionSlugs: [],
          flagSlugs: [],
          programming: {},
          tags: [],
          isPremium: false,
          catalogVersion: 1,
          aliases: ['Press-up'],
          primaryMuscleSlugs: ['chest'],
          secondaryMuscleSlugs: [],
          stabilizerMuscleSlugs: [],
          equipmentSlugs: ['bodyweight'],
          variationSlugs: [],
          progressionSlugs: [],
          regressionSlugs: [],
          media: []
        }
      ]
    });

    expect(client.upsert).toHaveBeenCalledWith(
      'exercises',
      [expect.objectContaining({ id: 'exercise-1', slug: 'push-up' })],
      { onConflict: 'slug' }
    );
    expect(client.upsert).toHaveBeenCalledWith(
      'exercise_primary_muscles',
      [{ exercise_id: 'exercise-1', muscle_id: 10 }],
      { onConflict: 'exercise_id,muscle_id' }
    );
    expect(client.upsert).toHaveBeenCalledWith(
      'exercise_equipment',
      [{ exercise_id: 'exercise-1', equipment_id: 20 }],
      { onConflict: 'exercise_id,equipment_id' }
    );
    expect(client.insert).toHaveBeenCalledWith('exercise_change_events', [
      expect.objectContaining({
        exercise_id: 'exercise-1',
        change_type: 'updated'
      })
    ]);
  });

  it('deletes links absent from the plan, scoped to the seeded exercise', async () => {
    const client = {
      select: vi.fn(async () => []),
      upsert: vi.fn(async (table, rows) => rows),
      insert: vi.fn(async (table, rows) => rows),
      delete: vi.fn(async () => [])
    };

    await importExerciseData({
      client,
      idFactory: () => 'exercise-1',
      referenceLookups: {
        categoryIdsBySlug: new Map([['strength', 1]]),
        muscleIdsBySlug: new Map([
          ['chest', 10],
          ['triceps', 11]
        ]),
        equipmentIdsBySlug: new Map([['bodyweight', 20]])
      },
      exercises: [baseExercise({ primaryMuscleSlugs: ['chest', 'triceps'] })]
    });

    expect(client.delete).toHaveBeenCalledWith('exercise_primary_muscles', {
      filters: {
        exercise_id: 'eq.exercise-1',
        muscle_id: 'not.in.(10,11)'
      },
      select: 'muscle_id'
    });
  });

  it('deletes every link in a table the exercise no longer uses', async () => {
    const client = {
      select: vi.fn(async () => []),
      upsert: vi.fn(async (table, rows) => rows),
      insert: vi.fn(async (table, rows) => rows),
      delete: vi.fn(async () => [])
    };

    await importExerciseData({
      client,
      idFactory: () => 'exercise-1',
      referenceLookups: {
        categoryIdsBySlug: new Map([['strength', 1]]),
        muscleIdsBySlug: new Map([['chest', 10]]),
        equipmentIdsBySlug: new Map()
      },
      exercises: [baseExercise({ equipmentSlugs: [] })]
    });

    expect(client.delete).toHaveBeenCalledWith('exercise_equipment', {
      filters: { exercise_id: 'eq.exercise-1' },
      select: 'equipment_id'
    });
  });

  it('writes a change event when only a link changed, and skips an unchanged record', async () => {
    const referenceLookups = {
      categoryIdsBySlug: new Map([['strength', 1]]),
      muscleIdsBySlug: new Map([
        ['chest', 10],
        ['triceps', 11]
      ]),
      equipmentIdsBySlug: new Map([['bodyweight', 20]])
    };
    const exercise = baseExercise();
    const seededHash = hashExercise(exercise);
    const clientWithLatestHash = (contentHash) => ({
      select: vi.fn(async (table) =>
        table === 'exercise_change_events'
          ? [{ payload: { slug: 'push-up', contentHash } }]
          : []
      ),
      upsert: vi.fn(async (table, rows) => rows),
      insert: vi.fn(async (table, rows) => rows),
      delete: vi.fn(async () => [])
    });

    const unchanged = clientWithLatestHash(seededHash);
    await importExerciseData({
      client: unchanged,
      idFactory: () => 'exercise-1',
      referenceLookups,
      exercises: [exercise]
    });
    expect(unchanged.insert).toHaveBeenCalledWith('exercise_change_events', []);

    // Same catalogVersion, one extra secondary muscle: still a change.
    const edited = clientWithLatestHash(seededHash);
    await importExerciseData({
      client: edited,
      idFactory: () => 'exercise-1',
      referenceLookups,
      exercises: [baseExercise({ secondaryMuscleSlugs: ['triceps'] })]
    });
    expect(edited.insert).toHaveBeenCalledWith('exercise_change_events', [
      expect.objectContaining({
        exercise_id: 'exercise-1',
        catalog_version: 1,
        payload: expect.objectContaining({
          contentHash: expect.not.stringMatching(seededHash)
        })
      })
    ]);
  });

  it('deletes aliases and media the fixture no longer lists, by row id', async () => {
    const client = {
      select: vi.fn(async (table) => {
        if (table === 'exercise_aliases') {
          return [
            { id: 1, exercise_id: 'exercise-1', alias: 'Press-up' },
            { id: 2, exercise_id: 'exercise-1', alias: 'Old Name' }
          ];
        }
        if (table === 'exercise_media') {
          return [
            {
              id: 'm-1',
              exercise_id: 'exercise-1',
              url: 'https://x.test/a.png'
            }
          ];
        }
        return [];
      }),
      upsert: vi.fn(async (table, rows) => rows),
      insert: vi.fn(async (table, rows) => rows),
      delete: vi.fn(async () => [])
    };

    await importExerciseData({
      client,
      idFactory: () => 'exercise-1',
      referenceLookups: {
        categoryIdsBySlug: new Map([['strength', 1]]),
        muscleIdsBySlug: new Map([['chest', 10]]),
        equipmentIdsBySlug: new Map([['bodyweight', 20]])
      },
      exercises: [baseExercise({ aliases: ['Press-up'] })]
    });

    expect(client.delete).toHaveBeenCalledWith('exercise_aliases', {
      filters: { id: 'in.(2)' },
      select: 'id'
    });
    expect(client.delete).toHaveBeenCalledWith('exercise_media', {
      filters: { id: 'in.(m-1)' },
      select: 'id'
    });
  });

  it('upserts media on exercise and url instead of inserting duplicates', async () => {
    const client = {
      select: vi.fn(async () => []),
      upsert: vi.fn(async (table, rows) => rows),
      insert: vi.fn(async (table, rows) => rows),
      delete: vi.fn(async () => [])
    };

    await importExerciseData({
      client,
      idFactory: () => 'exercise-1',
      referenceLookups: {
        categoryIdsBySlug: new Map([['strength', 1]]),
        muscleIdsBySlug: new Map([['chest', 10]]),
        equipmentIdsBySlug: new Map([['bodyweight', 20]])
      },
      exercises: [
        baseExercise({
          media: [
            {
              type: 'image',
              url: 'https://x.test/a.png',
              isPrimary: true,
              sortOrder: 0,
              status: 'active'
            }
          ]
        })
      ]
    });

    expect(client.upsert).toHaveBeenCalledWith(
      'exercise_media',
      [
        expect.objectContaining({
          exercise_id: 'exercise-1',
          url: 'https://x.test/a.png'
        })
      ],
      { onConflict: 'exercise_id,url' }
    );
    expect(client.insert).not.toHaveBeenCalledWith(
      'exercise_media',
      expect.anything()
    );
  });

  it('reconciles only after every upsert, so a mid-run failure leaves a superset', async () => {
    const calls = [];
    const client = {
      select: vi.fn(async () => []),
      upsert: vi.fn(async (table, rows) => {
        calls.push(`upsert:${table}`);
        return rows;
      }),
      insert: vi.fn(async (table, rows) => rows),
      delete: vi.fn(async (table) => {
        calls.push(`delete:${table}`);
        return [];
      })
    };

    await importExerciseData({
      client,
      idFactory: () => 'exercise-1',
      referenceLookups: {
        categoryIdsBySlug: new Map([['strength', 1]]),
        muscleIdsBySlug: new Map([['chest', 10]]),
        equipmentIdsBySlug: new Map([['bodyweight', 20]])
      },
      exercises: [baseExercise()]
    });

    const firstDelete = calls.findIndex((call) => call.startsWith('delete:'));
    const lastUpsert = findLastIndex(calls, (call) =>
      call.startsWith('upsert:')
    );

    expect(firstDelete).toBeGreaterThan(lastUpsert);
  });
});

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }

  return -1;
}

function baseExercise(overrides = {}) {
  return {
    name: 'Push-up',
    slug: 'push-up',
    status: 'active',
    description: 'A bodyweight upper-body pushing exercise.',
    instructions: ['Start in a high plank.'],
    tips: [],
    contraindications: [],
    categorySlug: 'strength',
    difficulty: 'beginner',
    movementPattern: 'push',
    mechanics: 'compound',
    jointRegionSlugs: [],
    flagSlugs: [],
    programming: {},
    tags: [],
    isPremium: false,
    catalogVersion: 1,
    aliases: [],
    primaryMuscleSlugs: ['chest'],
    secondaryMuscleSlugs: [],
    stabilizerMuscleSlugs: [],
    equipmentSlugs: ['bodyweight'],
    variationSlugs: [],
    progressionSlugs: [],
    regressionSlugs: [],
    media: [],
    ...overrides
  };
}
