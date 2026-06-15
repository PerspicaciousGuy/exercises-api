import { describe, expect, it } from 'vitest';

import {
  buildExerciseImportPlan,
  buildReferenceSeedRows
} from '../src/import/catalogImportPlans.js';

describe('catalog import plans', () => {
  it('maps reference fixtures to database row names', () => {
    const plan = buildReferenceSeedRows({
      muscles: [
        {
          name: 'Chest',
          slug: 'chest',
          region: 'upper_body',
          muscleGroup: 'push',
          displayOrder: 10
        }
      ],
      equipment: [],
      categories: [],
      exerciseFlags: [],
      jointRegions: []
    });

    expect(plan.muscles).toEqual([
      {
        name: 'Chest',
        slug: 'chest',
        region: 'upper_body',
        muscle_group: 'push',
        parent_muscle_id: null,
        display_order: 10
      }
    ]);
  });

  it('builds normalized exercise rows and relation rows from resolved IDs', () => {
    const plan = buildExerciseImportPlan({
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
          jointRegionSlugs: ['shoulder'],
          flagSlugs: ['beginner-friendly'],
          programming: {},
          tags: ['bodyweight'],
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
      ],
      lookups: {
        categoryIdsBySlug: new Map([['strength', 1]]),
        muscleIdsBySlug: new Map([['chest', 10]]),
        equipmentIdsBySlug: new Map([['bodyweight', 20]]),
        exerciseIdsBySlug: new Map([['push-up', 'exercise-1']])
      }
    });

    expect(plan.exercises).toEqual([
      expect.objectContaining({
        id: 'exercise-1',
        slug: 'push-up',
        category_id: 1,
        movement_pattern: 'push',
        is_premium: false,
        catalog_version: 1
      })
    ]);
    expect(plan.aliases).toEqual([
      {
        exercise_id: 'exercise-1',
        alias: 'Press-up'
      }
    ]);
    expect(plan.primaryMuscles).toEqual([
      {
        exercise_id: 'exercise-1',
        muscle_id: 10
      }
    ]);
    expect(plan.equipment).toEqual([
      {
        exercise_id: 'exercise-1',
        equipment_id: 20
      }
    ]);
  });
});
