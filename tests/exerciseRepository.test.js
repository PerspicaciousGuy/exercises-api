import { describe, expect, it, vi } from 'vitest';

import { createExerciseRepository } from '../src/repositories/exerciseRepository.js';

describe('createExerciseRepository', () => {
  it('queries active exercises with pagination and filters', async () => {
    const client = {
      select: vi.fn(async (table) => {
        if (table === 'exercises') {
          return [
            {
              id: 'exercise-1',
              slug: 'push-up',
              name: 'Push-up',
              status: 'active',
              category_id: 1,
              categories: { slug: 'strength', name: 'Strength' },
              difficulty: 'beginner',
              movement_pattern: 'push',
              tags: ['bodyweight', 'push'],
              updated_at: '2026-06-15T10:00:00.000Z'
            }
          ];
        }

        return [];
      })
    };
    const repository = createExerciseRepository({ client });

    const result = await repository.listExercises({
      limit: 10,
      offset: 0,
      category: 'strength',
      difficulty: 'beginner',
      search: 'push',
      updatedSince: '2026-06-15T10:00:00.000Z',
      includeDeprecated: true
    });

    expect(client.select).toHaveBeenCalledWith('exercises', {
      columns:
        'id,slug,name,status,difficulty,movement_pattern,tags,updated_at,categories(slug,name)',
      filters: {
        status: 'in.(active,deprecated)',
        deleted_at: 'is.null',
        difficulty: 'eq.beginner',
        'categories.slug': 'eq.strength',
        name: 'ilike.*push*',
        updated_at: 'gt.2026-06-15T10:00:00.000Z',
        order: 'name.asc',
        limit: '10',
        offset: '0'
      }
    });
    expect(result).toEqual({
      exercises: [
        {
          id: 'exercise-1',
          slug: 'push-up',
          name: 'Push-up',
          status: 'active',
          category: 'strength',
          difficulty: 'beginner',
          movementPattern: 'push',
          tags: ['bodyweight', 'push'],
          updatedAt: '2026-06-15T10:00:00.000Z'
        }
      ],
      pagination: {
        limit: 10,
        offset: 0
      }
    });
  });

  it('limits list results to matching muscle and equipment relations', async () => {
    const client = {
      select: vi.fn(async (table) => {
        const rowsByTable = {
          muscles: [{ id: 10 }],
          equipment: [{ id: 20 }],
          exercise_primary_muscles: [{ exercise_id: 'exercise-1' }],
          exercise_secondary_muscles: [],
          exercise_stabilizer_muscles: [],
          exercise_equipment: [{ exercise_id: 'exercise-1' }],
          exercises: []
        };

        return rowsByTable[table] ?? [];
      })
    };
    const repository = createExerciseRepository({ client });

    await repository.listExercises({
      limit: 10,
      offset: 0,
      muscle: 'chest',
      equipment: 'bodyweight'
    });

    expect(client.select).toHaveBeenLastCalledWith('exercises', {
      columns:
        'id,slug,name,status,difficulty,movement_pattern,tags,updated_at,categories(slug,name)',
      filters: {
        status: 'eq.active',
        deleted_at: 'is.null',
        id: 'in.(exercise-1)',
        order: 'name.asc',
        limit: '10',
        offset: '0'
      }
    });
  });

  it('returns a detailed exercise by slug', async () => {
    const client = {
      select: vi.fn(async () => [
        {
          id: 'exercise-1',
          slug: 'push-up',
          name: 'Push-up',
          status: 'active',
          description: 'A bodyweight upper-body push.',
          instructions: ['Start in a high plank.'],
          tips: [],
          contraindications: [],
          categories: { slug: 'strength', name: 'Strength' },
          difficulty: 'beginner',
          movement_pattern: 'push',
          force_type: 'push',
          mechanics: 'compound',
          position: 'other',
          plane_of_motion: 'sagittal',
          joint_regions: ['shoulder'],
          laterality: 'bilateral',
          load_type: 'bodyweight',
          skill_type: 'strength',
          flags: ['beginner-friendly'],
          programming: { defaultSets: 3 },
          tags: ['bodyweight'],
          is_premium: false,
          catalog_version: 1,
          updated_at: '2026-06-15T10:00:00.000Z'
        }
      ])
    };
    const repository = createExerciseRepository({ client });

    const exercise = await repository.getExerciseBySlug('push-up');

    expect(client.select).toHaveBeenCalledWith('exercises', {
      columns: expect.stringContaining('description'),
      filters: {
        slug: 'eq.push-up',
        status: 'eq.active',
        deleted_at: 'is.null',
        limit: '1'
      }
    });
    expect(exercise).toEqual({
      id: 'exercise-1',
      slug: 'push-up',
      name: 'Push-up',
      status: 'active',
      description: 'A bodyweight upper-body push.',
      instructions: ['Start in a high plank.'],
      tips: [],
      contraindications: [],
      category: 'strength',
      difficulty: 'beginner',
      movementPattern: 'push',
      forceType: 'push',
      mechanics: 'compound',
      position: 'other',
      planeOfMotion: 'sagittal',
      jointRegions: ['shoulder'],
      laterality: 'bilateral',
      loadType: 'bodyweight',
      skillType: 'strength',
      flags: ['beginner-friendly'],
      programming: { defaultSets: 3 },
      tags: ['bodyweight'],
      isPremium: false,
      catalogVersion: 1,
      updatedAt: '2026-06-15T10:00:00.000Z'
    });
  });

  it('searches exercises by name, alias, and exact tag', async () => {
    const client = {
      select: vi.fn(async (table, options) => {
        if (table === 'exercise_aliases') {
          return [{ exercise_id: 'exercise-2' }];
        }

        if (table === 'exercises' && options.filters.name) {
          return [
            createExerciseSummaryRow({
              id: 'exercise-1',
              slug: 'push-up',
              name: 'Push-up'
            })
          ];
        }

        if (table === 'exercises' && options.filters.tags) {
          return [
            createExerciseSummaryRow({
              id: 'exercise-3',
              slug: 'plank',
              name: 'Plank'
            })
          ];
        }

        if (table === 'exercises' && options.filters.id) {
          return [
            createExerciseSummaryRow({
              id: 'exercise-2',
              slug: 'bench-press',
              name: 'Bench Press'
            })
          ];
        }

        return [];
      })
    };
    const repository = createExerciseRepository({ client });

    const result = await repository.searchExercises({
      query: 'press',
      limit: 10,
      offset: 0
    });

    expect(client.select).toHaveBeenCalledWith('exercise_aliases', {
      columns: 'exercise_id',
      filters: {
        alias: 'ilike.*press*'
      }
    });
    expect(result.exercises.map((exercise) => exercise.id)).toEqual([
      'exercise-1',
      'exercise-2',
      'exercise-3'
    ]);
  });

  it('returns detailed exercises for bulk ids in request order', async () => {
    const id1 = '3f1c9b2a-0000-4000-8000-000000000001';
    const id2 = '3f1c9b2a-0000-4000-8000-000000000002';
    const client = {
      select: vi.fn(async () => [
        createExerciseDetailRow({
          id: id2,
          slug: 'barbell-bench-press',
          name: 'Barbell Bench Press'
        }),
        createExerciseDetailRow({
          id: id1,
          slug: 'push-up',
          name: 'Push-up'
        })
      ])
    };
    const repository = createExerciseRepository({ client });

    const exercises = await repository.getExercisesByIds([id1, id2]);

    expect(client.select).toHaveBeenCalledWith('exercises', {
      columns: expect.stringContaining('description'),
      filters: {
        id: `in.(${id1},${id2})`,
        status: 'eq.active',
        deleted_at: 'is.null'
      }
    });
    expect(exercises.map((exercise) => exercise.id)).toEqual([id1, id2]);
  });

  it('returns relation exercise summaries by relation type', async () => {
    const client = {
      select: vi.fn(async (table) => {
        if (table === 'exercise_variations') {
          return [{ variation_id: 'exercise-2' }];
        }

        if (table === 'exercises') {
          return [
            createExerciseSummaryRow({
              id: 'exercise-2',
              slug: 'barbell-bench-press',
              name: 'Barbell Bench Press'
            })
          ];
        }

        return [];
      })
    };
    const repository = createExerciseRepository({ client });

    const relations = await repository.listExerciseRelations({
      exerciseId: 'exercise-1',
      relationType: 'variations'
    });

    expect(client.select).toHaveBeenCalledWith('exercise_variations', {
      columns: 'variation_id',
      filters: {
        exercise_id: 'eq.exercise-1'
      }
    });
    expect(relations).toEqual([
      {
        id: 'exercise-2',
        slug: 'barbell-bench-press',
        name: 'Barbell Bench Press',
        status: 'active',
        category: 'strength',
        difficulty: 'beginner',
        movementPattern: 'push',
        tags: ['bodyweight'],
        updatedAt: '2026-06-15T10:00:00.000Z'
      }
    ]);
  });

  it('returns null for a malformed id without querying the client', async () => {
    const client = { select: vi.fn() };
    const repository = createExerciseRepository({ client });

    const result = await repository.getExerciseById('not-a-uuid');

    expect(result).toBeNull();
    expect(client.select).not.toHaveBeenCalled();
  });

  it('drops malformed ids from a bulk lookup', async () => {
    const validId = '3f1c9b2a-0000-4000-8000-000000000001';
    const client = {
      select: vi.fn(async () => [createExerciseDetailRow({ id: validId })])
    };
    const repository = createExerciseRepository({ client });

    const result = await repository.getExercisesByIds([validId, 'not-a-uuid']);

    // only the valid id reached the query
    expect(client.select).toHaveBeenCalledWith('exercises', {
      columns: expect.any(String),
      filters: expect.objectContaining({ id: `in.(${validId})` })
    });
    expect(result.map((exercise) => exercise.id)).toEqual([validId]);
  });
});

function createExerciseSummaryRow(overrides = {}) {
  return {
    id: 'exercise-1',
    slug: 'push-up',
    name: 'Push-up',
    status: 'active',
    categories: { slug: 'strength', name: 'Strength' },
    difficulty: 'beginner',
    movement_pattern: 'push',
    tags: ['bodyweight'],
    updated_at: '2026-06-15T10:00:00.000Z',
    ...overrides
  };
}

function createExerciseDetailRow(overrides = {}) {
  return {
    ...createExerciseSummaryRow(overrides),
    description: 'Exercise description',
    instructions: ['Do the movement.'],
    tips: [],
    breathing_cues: null,
    contraindications: [],
    force_type: 'push',
    mechanics: 'compound',
    position: 'other',
    plane_of_motion: 'sagittal',
    joint_regions: ['shoulder'],
    laterality: 'bilateral',
    load_type: 'bodyweight',
    skill_type: 'strength',
    flags: ['beginner-friendly'],
    programming: { defaultSets: 3 },
    is_premium: false,
    catalog_version: 1
  };
}
