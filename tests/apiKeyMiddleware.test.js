import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

describe('api key middleware', () => {
  it('rejects protected catalog requests without an API key', async () => {
    const app = createApp({
      authService: createAuthService(),
      exerciseRepository: createExerciseRepository()
    });

    const response = await request(app).get('/exercises').expect(401);

    expect(response.headers['content-type']).toContain(
      'application/problem+json'
    );
    expect(response.body).toEqual({
      type: 'https://exercisedb-api.dev/errors/api-key-required',
      title: 'Api Key Required',
      status: 401,
      detail: 'API key is required',
      instance: '/exercises',
      requestId: expect.any(String),
      code: 'API_KEY_REQUIRED'
    });
  });

  it('allows protected requests with a valid API key and rate-limit headers', async () => {
    const authService = createAuthService();
    const exerciseRepository = createExerciseRepository();
    const app = createApp({ authService, exerciseRepository });

    const response = await request(app)
      .get('/exercises')
      .set('x-api-key', 'exdb_valid_key')
      .expect(200);

    expect(authService.authenticateApiKey).toHaveBeenCalledWith(
      'exdb_valid_key'
    );
    expect(response.headers['x-ratelimit-limit']).toBe('1000');
    expect(response.headers['x-ratelimit-remaining']).toBe('999');
    expect(response.headers['x-ratelimit-reset']).toBe(
      '2026-06-16T00:00:00.000Z'
    );
  });

  it('returns auth service errors for invalid or exhausted keys', async () => {
    const authService = createAuthService({
      authenticateApiKey: vi.fn(async () => {
        const error = new Error('Daily request limit exceeded');
        error.statusCode = 429;
        error.code = 'RATE_LIMIT_EXCEEDED';
        throw error;
      })
    });
    const app = createApp({
      authService,
      exerciseRepository: createExerciseRepository()
    });

    const response = await request(app)
      .get('/exercises')
      .set('authorization', 'Bearer exdb_limited_key')
      .expect(429);

    expect(response.body).toEqual({
      type: 'https://exercisedb-api.dev/errors/rate-limit-exceeded',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: 'Daily request limit exceeded',
      instance: '/exercises',
      requestId: expect.any(String),
      code: 'RATE_LIMIT_EXCEEDED'
    });
  });

  it('sets Retry-After on a rate-limited response', async () => {
    const authService = createAuthService({
      authenticateApiKey: vi.fn(async () => {
        const error = new Error('Daily request limit exceeded');
        error.statusCode = 429;
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryAfterSeconds = 3600;
        throw error;
      })
    });
    const app = createApp({
      authService,
      exerciseRepository: createExerciseRepository()
    });

    const response = await request(app)
      .get('/exercises')
      .set('x-api-key', 'exdb_limited_key')
      .expect(429);

    expect(response.headers['retry-after']).toBe('3600');
  });
});

function createAuthService(overrides = {}) {
  return {
    authenticateApiKey: vi.fn(async () => ({
      user: {
        id: 'user-1',
        tier: 'free'
      },
      apiKey: {
        id: 'key-1'
      },
      rateLimit: {
        limit: 1000,
        remaining: 999,
        resetAt: '2026-06-16T00:00:00.000Z'
      }
    })),
    logUsage: vi.fn(async () => {}),
    ...overrides
  };
}

function createExerciseRepository() {
  return {
    listExercises: vi.fn(async () => ({
      exercises: [],
      pagination: { limit: 20, offset: 0 }
    }))
  };
}
