import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

function createAppWithAuthBypass(options) {
  return createApp({ ...options, apiKeyMiddleware: allowApiKey });
}

function allowApiKey(_request, _response, next) {
  next();
}

function summary(id, slug, extra = {}) {
  return {
    id,
    slug,
    name: slug,
    status: 'active',
    category: 'strength',
    difficulty: 'beginner',
    movementPattern: 'push',
    tags: [],
    updatedAt: '2026-06-15T10:00:00.000Z',
    ...extra
  };
}

describe('GET /exercises/:id/substitutes', () => {
  it('returns all variations when no equipment filter is given', async () => {
    const variations = [summary('v1', 'dumbbell-bench-press')];
    const exerciseRepository = {
      getExerciseById: vi.fn(async () => ({ id: 'e1' })),
      listExerciseRelations: vi.fn(async () => variations),
      getEquipmentSlugsByExerciseIds: vi.fn()
    };
    const app = createAppWithAuthBypass({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/e1/substitutes')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(exerciseRepository.getEquipmentSlugsByExerciseIds).not.toHaveBeenCalled();
  });

  it('keeps only variations whose equipment is available', async () => {
    const variations = [
      summary('v1', 'dumbbell-bench-press'),
      summary('v2', 'push-up'),
      summary('v3', 'smith-machine-bench-press')
    ];
    const exerciseRepository = {
      getExerciseById: vi.fn(async () => ({ id: 'e1' })),
      listExerciseRelations: vi.fn(async () => variations),
      getEquipmentSlugsByExerciseIds: vi.fn(
        async () =>
          new Map([
            ['v1', ['dumbbell']],
            ['v2', []],
            ['v3', ['smith-machine']]
          ])
      )
    };
    const app = createAppWithAuthBypass({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/e1/substitutes')
      .query({ equipment: 'dumbbell,bodyweight' })
      .expect(200);

    // v1 (dumbbell) kept, v2 (no equipment) always usable, v3 (smith) dropped.
    expect(response.body.data.map((item) => item.id)).toEqual(['v1', 'v2']);
  });

  it('returns 404 for an unknown exercise', async () => {
    const exerciseRepository = {
      getExerciseById: vi.fn(async () => null),
      listExerciseRelations: vi.fn()
    };
    const app = createAppWithAuthBypass({ exerciseRepository });

    await request(app).get('/exercises/ghost/substitutes').expect(404);
    expect(exerciseRepository.listExerciseRelations).not.toHaveBeenCalled();
  });
});

describe('GET /exercises/:id/path', () => {
  it('returns the ordered progression chain to the target', async () => {
    const exerciseRepository = {
      getExerciseById: vi.fn(async (id) => ({ id })),
      getProgressionEdges: vi.fn(async () => [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' }
      ]),
      getExerciseSummariesByIds: vi.fn(async (ids) =>
        ids.map((id) => summary(id, id))
      )
    };
    const app = createAppWithAuthBypass({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/a/path')
      .query({ to: 'c' })
      .expect(200);

    expect(response.body.data.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns data: null when there is no path', async () => {
    const exerciseRepository = {
      getExerciseById: vi.fn(async (id) => ({ id })),
      getProgressionEdges: vi.fn(async () => [{ from: 'a', to: 'b' }]),
      getExerciseSummariesByIds: vi.fn()
    };
    const app = createAppWithAuthBypass({ exerciseRepository });

    const response = await request(app)
      .get('/exercises/a/path')
      .query({ to: 'z' })
      .expect(200);

    expect(response.body).toEqual({ success: true, data: null });
  });

  it('rejects a missing target with a 400', async () => {
    const exerciseRepository = {
      getExerciseById: vi.fn(),
      getProgressionEdges: vi.fn()
    };
    const app = createAppWithAuthBypass({ exerciseRepository });

    await request(app).get('/exercises/a/path').expect(400);
    expect(exerciseRepository.getProgressionEdges).not.toHaveBeenCalled();
  });
});

describe('POST /analyze/coverage', () => {
  it('returns a coverage report for a set of exercise ids', async () => {
    const id1 = '3f1c9b2a-0000-4000-8000-000000000001';
    const id2 = '3f1c9b2a-0000-4000-8000-000000000002';
    const exerciseRepository = {
      getExercisesByIds: vi.fn(async () => [
        summary(id1, 'push-up', { movementPattern: 'push' }),
        summary(id2, 'pull-up', { movementPattern: 'pull' })
      ]),
      getMuscleSlugsByExerciseIds: vi.fn(
        async () =>
          new Map([
            [id1, { primary: ['chest'], secondary: ['triceps'] }],
            [id2, { primary: ['lats'], secondary: ['biceps'] }]
          ])
      )
    };
    const app = createAppWithAuthBypass({ exerciseRepository });

    const response = await request(app)
      .post('/analyze/coverage')
      .send({ exerciseIds: [id1, id2] })
      .expect(200);

    expect(response.body.data.exerciseCount).toBe(2);
    expect(response.body.data.balance.pushCount).toBe(1);
    expect(response.body.data.balance.pullCount).toBe(1);
  });

  it('rejects an empty id list with a 400', async () => {
    const exerciseRepository = { getExercisesByIds: vi.fn() };
    const app = createAppWithAuthBypass({ exerciseRepository });

    await request(app)
      .post('/analyze/coverage')
      .send({ exerciseIds: [] })
      .expect(400);
    expect(exerciseRepository.getExercisesByIds).not.toHaveBeenCalled();
  });
});
