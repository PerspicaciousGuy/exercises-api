import { describe, expect, it, vi } from 'vitest';

import { createSyncService } from '../src/services/syncService.js';

describe('createSyncService', () => {
  it('returns sync metadata with catalog enum values', async () => {
    const syncRepository = {
      getSyncMetadata: vi.fn(async () => ({
        catalogVersion: 3,
        latestExerciseUpdatedAt: '2026-06-15T10:00:00.000Z',
        latestChangeAt: '2026-06-15T10:05:00.000Z'
      }))
    };
    const service = createSyncService({ syncRepository });

    const metadata = await service.getSyncMetadata();

    expect(metadata).toMatchObject({
      catalogVersion: 3,
      resources: ['metadata', 'exercises'],
      endpoints: {
        metadata: '/sync/metadata',
        exercises: '/sync/exercises'
      },
      enums: {
        difficulties: ['beginner', 'intermediate', 'advanced']
      },
      pageSizeMax: 100
    });
  });

  it('builds a paginated sync response from change events', async () => {
    const syncRepository = {
      listExerciseChangeEvents: vi.fn(async () => [
        {
          id: 1,
          exerciseId: 'exercise-1',
          changeType: 'updated',
          changedAt: '2026-06-15T10:30:00.000Z',
          catalogVersion: 2
        },
        {
          id: 2,
          exerciseId: 'exercise-2',
          changeType: 'deleted',
          changedAt: '2026-06-15T10:40:00.000Z',
          catalogVersion: 3
        },
        {
          id: 3,
          exerciseId: 'exercise-3',
          changeType: 'updated',
          changedAt: '2026-06-15T10:50:00.000Z',
          catalogVersion: 4
        }
      ]),
      getSyncExercisesByIds: vi.fn(async () => [
        { id: 'exercise-1', slug: 'push-up', name: 'Push-up' }
      ])
    };
    const service = createSyncService({ syncRepository });

    const result = await service.syncExercises({
      updatedSince: '2026-06-15T10:00:00.000Z',
      limit: 2,
      cursor: undefined,
      includeDeprecated: false
    });

    expect(syncRepository.listExerciseChangeEvents).toHaveBeenCalledWith({
      updatedSince: '2026-06-15T10:00:00.000Z',
      limit: 3,
      offset: 0
    });
    expect(syncRepository.getSyncExercisesByIds).toHaveBeenCalledWith({
      ids: ['exercise-1'],
      includeDeprecated: false
    });
    expect(result).toEqual({
      exercises: [{ id: 'exercise-1', slug: 'push-up', name: 'Push-up' }],
      tombstones: [
        {
          exerciseId: 'exercise-2',
          changeType: 'deleted',
          changedAt: '2026-06-15T10:40:00.000Z',
          catalogVersion: 3
        }
      ],
      pagination: {
        limit: 2,
        nextCursor: expect.any(String),
        hasMore: true
      }
    });
  });

  it('uses a cursor offset for the next page', async () => {
    const syncRepository = {
      listExerciseChangeEvents: vi.fn(async () => []),
      getSyncExercisesByIds: vi.fn(async () => [])
    };
    const service = createSyncService({ syncRepository });
    const firstPage = await service.syncExercises({
      updatedSince: undefined,
      limit: 2,
      cursor: undefined,
      includeDeprecated: false
    });

    await service.syncExercises({
      updatedSince: undefined,
      limit: 2,
      cursor: firstPage.pagination.nextCursor ?? encodeCursorForTest(2),
      includeDeprecated: false
    });

    expect(syncRepository.listExerciseChangeEvents).toHaveBeenLastCalledWith({
      updatedSince: undefined,
      limit: 3,
      offset: 2
    });
  });
});

function encodeCursorForTest(offset) {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}
