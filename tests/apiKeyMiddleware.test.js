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

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'API_KEY_REQUIRED',
        message: 'API key is required'
      }
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
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Daily request limit exceeded'
      }
    });
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
