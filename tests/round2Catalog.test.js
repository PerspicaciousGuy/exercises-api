import { describe, expect, it, vi } from 'vitest';

import { loadCatalogFixtures } from '../src/import/catalogFixtureFiles.js';
import { importExerciseData } from '../src/import/catalogSeeder.js';
import { mapExerciseDetail } from '../src/repositories/exerciseMappers.js';
import { createExerciseRepository } from '../src/repositories/exerciseRepository.js';
import {
  assertProgrammingAgrees,
  parseCatalogFixtures,
  parseExerciseFixtures
} from '../src/validation/catalogFixtures.js';

const agrees = (programming) => () =>
  assertProgrammingAgrees({ slug: 'x', programming });

describe('structured programming defaults', () => {
  it('agree with the text field on every catalog record', async () => {
    const { exercises } = await loadCatalogFixtures();

    for (const exercise of exercises) {
      expect(() => assertProgrammingAgrees(exercise)).not.toThrow();
      expect(typeof exercise.programming.perSide).toBe('boolean');
    }
  });

  it('give every timed and cardio record a duration in seconds', async () => {
    const { exercises } = await loadCatalogFixtures();
    const timed = exercises.filter((exercise) =>
      ['duration', 'weight_duration', 'distance_duration'].includes(
        exercise.trackingType
      )
    );

    expect(timed.length).toBeGreaterThan(0);
    for (const exercise of timed) {
      expect(exercise.programming.defaultDurationSeconds).toBeGreaterThan(0);
    }
  });

  it('mark the unilateral lifts as per side', async () => {
    const { exercises } = await loadCatalogFixtures();
    const bySlug = new Map(exercises.map((item) => [item.slug, item]));

    for (const slug of [
      'bulgarian-split-squat',
      'dumbbell-row',
      'forward-lunge',
      'reverse-lunge',
      'step-up',
      'split-squat',
      'pistol-squat',
      'single-leg-romanian-deadlift',
      'landmine-press',
      'dumbbell-wrist-curl',
      'dumbbell-reverse-wrist-curl',
      'side-plank'
    ]) {
      expect({ slug, perSide: bySlug.get(slug).programming.perSide }).toEqual({
        slug,
        perSide: true
      });
    }
  });

  it('accept matching text and structured fields', () => {
    expect(
      agrees({
        defaultReps: '8-12 each side',
        defaultRepsMin: 8,
        defaultRepsMax: 12,
        perSide: true
      })
    ).not.toThrow();
    expect(
      agrees({
        defaultReps: 6,
        defaultRepsMin: 6,
        defaultRepsMax: 6,
        perSide: false
      })
    ).not.toThrow();
    expect(
      agrees({
        defaultReps: '20-40 metres',
        defaultDistanceMetersMin: 20,
        defaultDistanceMetersMax: 40,
        perSide: false
      })
    ).not.toThrow();
    expect(
      agrees({
        defaultDurationMinutes: 20,
        defaultDurationSeconds: 1200,
        perSide: false
      })
    ).not.toThrow();
  });

  it('reject structured fields that contradict the text', () => {
    expect(
      agrees({
        defaultReps: '8-12',
        defaultRepsMin: 8,
        defaultRepsMax: 10,
        perSide: false
      })
    ).toThrow(/defaultRepsMax/);
    expect(
      agrees({
        defaultReps: '8-12 each side',
        defaultRepsMin: 8,
        defaultRepsMax: 12,
        perSide: false
      })
    ).toThrow(/perSide/);
    expect(
      agrees({
        defaultDurationMinutes: 20,
        defaultDurationSeconds: 60,
        perSide: false
      })
    ).toThrow(/defaultDurationMinutes \* 60/);
    expect(agrees({ defaultReps: 'lots', perSide: false })).toThrow(
      /unrecognised/
    );
  });
});

describe('optional equipment and trackingType', () => {
  const record = (overrides) => ({
    name: 'Walking Lunge',
    slug: 'walking-lunge',
    description: 'A lunge.',
    instructions: ['Step.'],
    categorySlug: 'strength',
    difficulty: 'beginner',
    movementPattern: 'gait',
    mechanics: 'compound',
    programming: {
      defaultReps: '8-12 each side',
      defaultRepsMin: 8,
      defaultRepsMax: 12,
      perSide: true
    },
    trackingType: 'reps',
    primaryMuscleSlugs: ['quadriceps'],
    equipmentSlugs: ['bodyweight'],
    ...overrides
  });

  it('rejects an item listed as both required and optional', async () => {
    const { references } = await loadCatalogFixtures();

    expect(() =>
      parseCatalogFixtures({
        references,
        exercises: [record({ optionalEquipmentSlugs: ['bodyweight'] })]
      })
    ).toThrow(/both required and optional/);
  });

  it('requires a trackingType from the enum', () => {
    expect(() =>
      parseExerciseFixtures([record({ trackingType: 'vibes' })])
    ).toThrow(/Invalid exercise fixtures/);
  });

  it('maps optional equipment and trackingType onto the full record', () => {
    const exercise = mapExerciseDetail({
      id: 'e1',
      slug: 'walking-lunge',
      tracking_type: 'reps',
      exercise_equipment: [
        { equipment: { slug: 'bodyweight', display_order: 10 } }
      ],
      exercise_optional_equipment: [
        { equipment: { slug: 'dumbbell', display_order: 30 } }
      ]
    });

    expect(exercise).toMatchObject({
      trackingType: 'reps',
      equipment: ['bodyweight'],
      optionalEquipment: ['dumbbell']
    });
  });

  it('lets ?equipment= match required and optional equipment', async () => {
    const client = {
      select: vi.fn(async (table) => {
        if (table === 'equipment') return [{ id: 30, slug: 'dumbbell' }];
        if (table === 'exercise_equipment') {
          return [{ exercise_id: 'e-required' }];
        }
        if (table === 'exercise_optional_equipment') {
          return [{ exercise_id: 'e-optional' }];
        }
        return [];
      })
    };

    await createExerciseRepository({ client }).listExercises({
      limit: 20,
      offset: 0,
      equipment: 'dumbbell'
    });

    expect(client.select).toHaveBeenLastCalledWith(
      'exercises',
      expect.objectContaining({
        filters: expect.objectContaining({ id: 'in.(e-required,e-optional)' })
      })
    );
  });

  it('seeds and reconciles optional equipment like the other link tables', async () => {
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
        muscleIdsBySlug: new Map([['quadriceps', 15]]),
        equipmentIdsBySlug: new Map([
          ['bodyweight', 10],
          ['dumbbell', 30]
        ])
      },
      exercises: [
        {
          ...record({ optionalEquipmentSlugs: ['dumbbell'] }),
          status: 'active',
          tips: [],
          contraindications: [],
          jointRegionSlugs: [],
          flagSlugs: [],
          tags: [],
          isPremium: false,
          catalogVersion: 8,
          aliases: [],
          secondaryMuscleSlugs: [],
          stabilizerMuscleSlugs: [],
          variationSlugs: [],
          progressionSlugs: [],
          regressionSlugs: [],
          media: []
        }
      ]
    });

    expect(client.upsert).toHaveBeenCalledWith(
      'exercise_optional_equipment',
      [{ exercise_id: 'exercise-1', equipment_id: 30 }],
      { onConflict: 'exercise_id,equipment_id' }
    );
    expect(client.upsert).toHaveBeenCalledWith(
      'exercises',
      [expect.objectContaining({ tracking_type: 'reps' })],
      { onConflict: 'slug' }
    );
    expect(client.delete).toHaveBeenCalledWith('exercise_optional_equipment', {
      filters: { exercise_id: 'eq.exercise-1', equipment_id: 'not.in.(30)' },
      select: 'equipment_id'
    });
  });
});
