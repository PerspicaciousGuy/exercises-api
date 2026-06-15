import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

describe('exercise routes', () => {
  it('returns paginated exercise summaries with filters', async () => {
    const exerciseRepository = {
      listExercises: vi.fn(async () => ({
        exercises: [
          {
            id: 'exercise-1',
            slug: 'push-up',
            name: 'Push-up',
            status: 'active',
            category: 'strength',
            difficulty: 'beginner',
            movementPattern: 'push',
            primaryMuscles: ['chest'],
            equipment: ['bodyweight'],
            tags: ['bodyweight', 'push'],
            updatedAt: '2026-06-15T10:00:00.000Z'
          }
        ],
        pagination: {
          limit: 10,
          offset: 0
        }
      })),
      getExerciseById: vi.fn(),
      getExerciseBySlug: vi.fn()
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises')
      .query({
        limit: 10,
        offset: 0,
        category: 'strength',
        difficulty: 'beginner',
        equipment: 'bodyweight',
        muscle: 'chest'
      })
      .expect(200);

    expect(exerciseRepository.listExercises).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      category: 'strength',
      difficulty: 'beginner',
      equipment: 'bodyweight',
      muscle: 'chest',
      search: undefined
    });
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: 'exercise-1',
          slug: 'push-up',
          name: 'Push-up',
          status: 'active',
          category: 'strength',
          difficulty: 'beginner',
          movementPattern: 'push',
          primaryMuscles: ['chest'],
          equipment: ['bodyweight'],
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

  it('rejects invalid pagination values', async () => {
    const app = createApp({
      exerciseRepository: createEmptyExerciseRepository()
    });

    const response = await request(app).get('/exercises?limit=500').expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'limit must be less than or equal to 100'
      }
    });
  });

  it('returns sparse fields when requested', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      listExercises: vi.fn(async () => ({
        exercises: [
          {
            id: 'exercise-1',
            slug: 'push-up',
            name: 'Push-up',
            difficulty: 'beginner'
          }
        ],
        pagination: { limit: 20, offset: 0 }
      }))
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises?fields=id,slug')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: 'exercise-1',
          slug: 'push-up'
        }
      ],
      pagination: {
        limit: 20,
        offset: 0
      }
    });
  });

  it('returns an exercise by id', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      getExerciseById: vi.fn(async () => ({
        id: 'exercise-1',
        slug: 'push-up',
        name: 'Push-up',
        instructions: ['Start in a high plank.']
      }))
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/exercise-1')
      .expect(200);

    expect(exerciseRepository.getExerciseById).toHaveBeenCalledWith(
      'exercise-1'
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 'exercise-1',
        slug: 'push-up',
        name: 'Push-up',
        instructions: ['Start in a high plank.']
      }
    });
  });

  it('returns an exercise by slug', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      getExerciseBySlug: vi.fn(async () => ({
        id: 'exercise-1',
        slug: 'push-up',
        name: 'Push-up'
      }))
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/slug/push-up')
      .expect(200);

    expect(exerciseRepository.getExerciseBySlug).toHaveBeenCalledWith(
      'push-up'
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 'exercise-1',
        slug: 'push-up',
        name: 'Push-up'
      }
    });
  });

  it('searches exercises by query text', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      searchExercises: vi.fn(async () => ({
        exercises: [
          {
            id: 'exercise-1',
            slug: 'push-up',
            name: 'Push-up',
            tags: ['bodyweight', 'push']
          }
        ],
        pagination: { limit: 5, offset: 0 }
      }))
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/search?q=press&limit=5')
      .expect(200);

    expect(exerciseRepository.searchExercises).toHaveBeenCalledWith({
      query: 'press',
      limit: 5,
      offset: 0
    });
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: 'exercise-1',
          slug: 'push-up',
          name: 'Push-up',
          tags: ['bodyweight', 'push']
        }
      ],
      pagination: {
        limit: 5,
        offset: 0
      }
    });
  });

  it('rejects a search request without a query', async () => {
    const app = createApp({
      exerciseRepository: createEmptyExerciseRepository()
    });

    const response = await request(app).get('/exercises/search').expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'q is required'
      }
    });
  });

  it('returns exercises by bulk ids', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      getExercisesByIds: vi.fn(async (ids) =>
        ids.map((id) => ({
          id,
          slug: `${id}-slug`,
          name: `${id} name`
        }))
      )
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/bulk?ids=exercise-1,exercise-2')
      .expect(200);

    expect(exerciseRepository.getExercisesByIds).toHaveBeenCalledWith([
      'exercise-1',
      'exercise-2'
    ]);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: 'exercise-1',
          slug: 'exercise-1-slug',
          name: 'exercise-1 name'
        },
        {
          id: 'exercise-2',
          slug: 'exercise-2-slug',
          name: 'exercise-2 name'
        }
      ]
    });
  });

  it('rejects bulk requests without ids', async () => {
    const app = createApp({
      exerciseRepository: createEmptyExerciseRepository()
    });

    const response = await request(app).get('/exercises/bulk').expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ids is required'
      }
    });
  });

  it('returns variation exercises for an exercise', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      getExerciseById: vi.fn(async () => ({ id: 'exercise-1' })),
      listExerciseRelations: vi.fn(async () => [
        {
          id: 'exercise-2',
          slug: 'barbell-bench-press',
          name: 'Barbell Bench Press'
        }
      ])
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/exercise-1/variations')
      .expect(200);

    expect(exerciseRepository.listExerciseRelations).toHaveBeenCalledWith({
      exerciseId: 'exercise-1',
      relationType: 'variations'
    });
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: 'exercise-2',
          slug: 'barbell-bench-press',
          name: 'Barbell Bench Press'
        }
      ]
    });
  });

  it('returns progression exercises for an exercise', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      getExerciseById: vi.fn(async () => ({ id: 'exercise-1' })),
      listExerciseRelations: vi.fn(async () => [
        {
          id: 'exercise-2',
          slug: 'barbell-bench-press',
          name: 'Barbell Bench Press'
        }
      ])
    };
    const app = createApp({ exerciseRepository });

    await request(app).get('/exercises/exercise-1/progressions').expect(200);

    expect(exerciseRepository.listExerciseRelations).toHaveBeenCalledWith({
      exerciseId: 'exercise-1',
      relationType: 'progressions'
    });
  });

  it('returns regression exercises for an exercise', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      getExerciseById: vi.fn(async () => ({ id: 'exercise-1' })),
      listExerciseRelations: vi.fn(async () => [
        {
          id: 'exercise-2',
          slug: 'push-up',
          name: 'Push-up'
        }
      ])
    };
    const app = createApp({ exerciseRepository });

    await request(app).get('/exercises/exercise-1/regressions').expect(200);

    expect(exerciseRepository.listExerciseRelations).toHaveBeenCalledWith({
      exerciseId: 'exercise-1',
      relationType: 'regressions'
    });
  });

  it('returns grouped related exercises for an exercise', async () => {
    const exerciseRepository = {
      ...createEmptyExerciseRepository(),
      getExerciseById: vi.fn(async () => ({ id: 'exercise-1' })),
      listExerciseRelations: vi.fn(async ({ relationType }) => [
        {
          id: `${relationType}-exercise`,
          slug: `${relationType}-slug`,
          name: `${relationType} name`
        }
      ])
    };
    const app = createApp({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/exercise-1/related')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        variations: [
          {
            id: 'variations-exercise',
            slug: 'variations-slug',
            name: 'variations name'
          }
        ],
        progressions: [
          {
            id: 'progressions-exercise',
            slug: 'progressions-slug',
            name: 'progressions name'
          }
        ],
        regressions: [
          {
            id: 'regressions-exercise',
            slug: 'regressions-slug',
            name: 'regressions name'
          }
        ]
      }
    });
  });

  it('returns not found for a missing exercise', async () => {
    const app = createApp({
      exerciseRepository: createEmptyExerciseRepository()
    });

    const response = await request(app)
      .get('/exercises/unknown-exercise')
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercise was not found'
      }
    });
  });
});

function createEmptyExerciseRepository() {
  return {
    listExercises: vi.fn(async () => ({
      exercises: [],
      pagination: { limit: 20, offset: 0 }
    })),
    searchExercises: vi.fn(async () => ({
      exercises: [],
      pagination: { limit: 20, offset: 0 }
    })),
    getExercisesByIds: vi.fn(async () => []),
    getExerciseById: vi.fn(async () => null),
    getExerciseBySlug: vi.fn(async () => null),
    listExerciseRelations: vi.fn(async () => [])
  };
}
