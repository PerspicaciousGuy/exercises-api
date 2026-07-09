import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

describe('sync routes', () => {
  it('returns sync metadata', async () => {
    const syncService = {
      getSyncMetadata: vi.fn(async () => ({
        catalogVersion: 3,
        latestExerciseUpdatedAt: '2026-06-15T10:00:00.000Z',
        latestChangeAt: '2026-06-15T10:05:00.000Z',
        resources: ['metadata', 'exercises'],
        endpoints: {
          metadata: '/sync/metadata',
          exercises: '/sync/exercises'
        },
        pageSizeMax: 100
      }))
    };
    const app = createAppWithAuthBypass({ syncService });

    const response = await request(app).get('/sync/metadata').expect(200);

    expect(syncService.getSyncMetadata).toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      data: {
        catalogVersion: 3,
        latestExerciseUpdatedAt: '2026-06-15T10:00:00.000Z',
        latestChangeAt: '2026-06-15T10:05:00.000Z',
        resources: ['metadata', 'exercises'],
        endpoints: {
          metadata: '/sync/metadata',
          exercises: '/sync/exercises'
        },
        pageSizeMax: 100
      }
    });
  });

  it('returns changed exercises and tombstones', async () => {
    const syncService = {
      syncExercises: vi.fn(async () => ({
        exercises: [{ id: 'exercise-1', slug: 'push-up', name: 'Push-up' }],
        tombstones: [
          {
            exerciseId: 'exercise-2',
            changeType: 'deleted',
            changedAt: '2026-06-15T11:00:00.000Z',
            catalogVersion: 4
          }
        ],
        pagination: {
          limit: 2,
          nextCursor: 'cursor-2',
          hasMore: true
        }
      }))
    };
    const app = createAppWithAuthBypass({ syncService });

    const response = await request(app)
      .get(
        '/sync/exercises?updated_since=2026-06-15T10:00:00.000Z&limit=2&include_deprecated=true'
      )
      .expect(200);

    expect(syncService.syncExercises).toHaveBeenCalledWith({
      updatedSince: '2026-06-15T10:00:00.000Z',
      limit: 2,
      cursor: undefined,
      includeDeprecated: true
    });
    expect(response.body).toEqual({
      success: true,
      data: {
        exercises: [{ id: 'exercise-1', slug: 'push-up', name: 'Push-up' }],
        tombstones: [
          {
            exerciseId: 'exercise-2',
            changeType: 'deleted',
            changedAt: '2026-06-15T11:00:00.000Z',
            catalogVersion: 4
          }
        ]
      },
      pagination: {
        limit: 2,
        nextCursor: 'cursor-2',
        hasMore: true
      }
    });
  });

  it('rejects invalid updated_since values', async () => {
    const app = createAppWithAuthBypass({
      syncService: {
        getSyncMetadata: vi.fn(),
        syncExercises: vi.fn()
      }
    });

    const response = await request(app)
      .get('/sync/exercises?updated_since=not-a-date')
      .expect(400);

    expect(response.body).toEqual({
      type: 'https://exercisedb-api.dev/errors/validation-error',
      title: 'Validation Error',
      status: 400,
      detail: 'updated_since invalid datetime',
      instance: '/sync/exercises?updated_since=not-a-date',
      code: 'VALIDATION_ERROR'
    });
  });
});

function createAppWithAuthBypass(options) {
  return createApp({
    ...options,
    apiKeyMiddleware: allowApiKey
  });
}

function allowApiKey(_request, _response, next) {
  next();
}
