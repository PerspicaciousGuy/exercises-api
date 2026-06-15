import { describe, expect, it, vi } from 'vitest';

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
      insert: vi.fn(async (table, rows) => rows)
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
});
