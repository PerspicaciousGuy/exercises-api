import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { createWindowLimiter } from '../src/middleware/publicSearchLimiter.js';
import { createPublicSearchRouter } from '../src/routes/publicSearch.js';

function summary(overrides) {
  return {
    id: 'exercise-id',
    slug: 'split-squat',
    name: 'Split Squat',
    status: 'active',
    category: 'strength',
    difficulty: 'beginner',
    movementPattern: 'squat',
    tags: ['unilateral'],
    updatedAt: '2026-06-15T10:00:00.000Z',
    isPremium: false,
    ...overrides
  };
}

function createTestApp(rows) {
  const exerciseRepository = {
    searchExercises: vi.fn(async () => ({
      exercises: rows,
      pagination: { limit: 20, offset: 0 }
    }))
  };
  // No API-key bypass: the route must work with the real key middleware in
  // place, because proving it is reachable without a key is the point.
  const app = createApp({ exerciseRepository });

  return { app, exerciseRepository };
}

describe('GET /public/search', () => {
  it('answers without an API key and returns only slim result fields', async () => {
    const { app, exerciseRepository } = createTestApp([summary()]);

    const response = await request(app)
      .get('/public/search')
      .query({ q: 'split squat' })
      .expect(200);

    expect(exerciseRepository.searchExercises).toHaveBeenCalledWith({
      query: 'split squat',
      limit: 20,
      offset: 0
    });
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          slug: 'split-squat',
          name: 'Split Squat',
          category: 'strength',
          difficulty: 'beginner'
        }
      ]
    });
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('never returns premium or inactive exercises', async () => {
    const { app } = createTestApp([
      summary({ slug: 'free-one', name: 'Free One' }),
      summary({ slug: 'paid-one', name: 'Paid One', isPremium: true }),
      summary({ slug: 'old-one', name: 'Old One', status: 'deprecated' })
    ]);

    const response = await request(app)
      .get('/public/search')
      .query({ q: 'one' })
      .expect(200);

    expect(response.body.data.map((row) => row.slug)).toEqual(['free-one']);
  });

  it('caps the result count and ignores any attempt to page', async () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      summary({ slug: `row-${i}`, name: `Row ${i}` })
    );
    const { app, exerciseRepository } = createTestApp(rows);

    const response = await request(app)
      .get('/public/search')
      .query({ q: 'row', limit: 100, offset: 50 })
      .expect(200);

    expect(response.body.data).toHaveLength(6);
    expect(exerciseRepository.searchExercises).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 })
    );
    expect(response.body).not.toHaveProperty('pagination');
  });

  it.each([
    ['missing', undefined],
    ['too short', 'a'],
    ['only spaces', '   '],
    ['too long', 'x'.repeat(61)]
  ])('rejects a query that is %s', async (_label, q) => {
    const { app, exerciseRepository } = createTestApp([]);

    const response = await request(app)
      .get('/public/search')
      .query(q === undefined ? {} : { q })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(exerciseRepository.searchExercises).not.toHaveBeenCalled();
  });

  it('leaves the keyed catalog endpoints locked', async () => {
    const { app } = createTestApp([summary()]);

    await request(app)
      .get('/exercises/search')
      .query({ q: 'squat' })
      .expect(401);
    await request(app).get('/exercises').expect(401);
  });
});

describe('public search rate limiting', () => {
  it('limits one client without affecting another, then recovers', async () => {
    let clock = 0;
    const limiter = createWindowLimiter({
      windowMs: 1000,
      clientLimit: 2,
      globalLimit: 100,
      now: () => clock
    });
    const exerciseService = {
      searchExercises: vi.fn(async () => ({ exercises: [] }))
    };
    // A bare app around the router, so the test controls the clock and the
    // client address (via X-Forwarded-For) without the production defaults.
    const standalone = express();
    standalone.set('trust proxy', 1);
    standalone.use(createPublicSearchRouter({ exerciseService, limiter }));
    standalone.use((error, _req, res, _next) => {
      res.status(error.statusCode ?? 500).json({
        code: error.code,
        retryAfter: error.retryAfterSeconds
      });
    });

    const call = (ip) =>
      request(standalone)
        .get('/public/search')
        .query({ q: 'squat' })
        .set('X-Forwarded-For', ip);

    await call('1.1.1.1').expect(200);
    await call('1.1.1.1').expect(200);

    const blocked = await call('1.1.1.1').expect(429);
    expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.body.retryAfter).toBe(1);

    await call('2.2.2.2').expect(200);

    clock = 1500;
    await call('1.1.1.1').expect(200);
  });

  it('applies a global ceiling across all clients', () => {
    const limiter = createWindowLimiter({
      windowMs: 1000,
      clientLimit: 10,
      globalLimit: 2,
      now: () => 0
    });
    const results = ['a', 'b', 'c'].map((ip) => {
      const next = vi.fn();
      limiter({ ip }, {}, next);
      return next.mock.calls[0][0];
    });

    expect(results[0]).toBeUndefined();
    expect(results[1]).toBeUndefined();
    expect(results[2]).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED'
    });
  });
});
