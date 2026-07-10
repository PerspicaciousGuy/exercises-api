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
      getLatestChangeAt: vi.fn(async () => '2026-06-15T10:50:00.000Z'),
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
      latestChangeAt: '2026-06-15T10:50:00.000Z',
      pagination: {
        limit: 2,
        nextCursor: expect.any(String),
        hasMore: true
      }
    });
  });

  it('tombstones a deprecated exercise when its record is withheld', async () => {
    const service = createSyncService({
      syncRepository: deprecationRepository()
    });

    const result = await service.syncExercises({
      limit: 10,
      includeDeprecated: false
    });

    expect(result.tombstones.map((stone) => stone.changeType)).toEqual([
      'deprecated'
    ]);
  });

  it('omits the deprecated tombstone when the record itself is returned', async () => {
    const syncRepository = deprecationRepository();
    syncRepository.getSyncExercisesByIds = vi.fn(async () => [
      { id: 'exercise-1', slug: 'sit-up', status: 'deprecated' }
    ]);
    const service = createSyncService({ syncRepository });

    const result = await service.syncExercises({
      limit: 10,
      includeDeprecated: true
    });

    expect(result.exercises).toEqual([
      { id: 'exercise-1', slug: 'sit-up', status: 'deprecated' }
    ]);
    expect(result.tombstones).toEqual([]);
  });

  it('always tombstones a deleted exercise', async () => {
    const syncRepository = {
      getLatestChangeAt: vi.fn(async () => '2026-06-15T10:50:00.000Z'),
      listExerciseChangeEvents: vi.fn(async () => [
        {
          id: 1,
          exerciseId: 'exercise-1',
          changeType: 'deleted',
          changedAt: '2026-06-15T10:30:00.000Z',
          catalogVersion: 2
        }
      ]),
      getSyncExercisesByIds: vi.fn(async () => [])
    };
    const service = createSyncService({ syncRepository });

    for (const includeDeprecated of [false, true]) {
      const result = await service.syncExercises({
        limit: 10,
        includeDeprecated
      });

      expect(result.tombstones.map((stone) => stone.changeType)).toEqual([
        'deleted'
      ]);
    }
  });

  it('carries the watermark in the cursor instead of re-reading it', async () => {
    const syncRepository = {
      getLatestChangeAt: vi.fn(async () => '2026-06-15T10:50:00.000Z'),
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
          changeType: 'updated',
          changedAt: '2026-06-15T10:40:00.000Z',
          catalogVersion: 3
        }
      ]),
      getSyncExercisesByIds: vi.fn(async () => [])
    };
    const service = createSyncService({ syncRepository });

    const firstPage = await service.syncExercises({
      updatedSince: undefined,
      limit: 1,
      cursor: undefined,
      includeDeprecated: false
    });

    const secondPage = await service.syncExercises({
      updatedSince: undefined,
      limit: 1,
      cursor: firstPage.pagination.nextCursor,
      includeDeprecated: false
    });

    expect(secondPage.latestChangeAt).toBe(firstPage.latestChangeAt);
    expect(syncRepository.getLatestChangeAt).toHaveBeenCalledTimes(1);
  });

  it('reads the watermark fresh for a cursor issued without one', async () => {
    const syncRepository = {
      getLatestChangeAt: vi.fn(async () => '2026-06-15T10:50:00.000Z'),
      listExerciseChangeEvents: vi.fn(async () => []),
      getSyncExercisesByIds: vi.fn(async () => [])
    };
    const service = createSyncService({ syncRepository });

    const page = await service.syncExercises({
      updatedSince: undefined,
      limit: 2,
      cursor: encodeCursorForTest(2),
      includeDeprecated: false
    });

    expect(page.latestChangeAt).toBe('2026-06-15T10:50:00.000Z');
    expect(syncRepository.getLatestChangeAt).toHaveBeenCalledTimes(1);
  });

  it('uses a cursor offset for the next page', async () => {
    const syncRepository = {
      getLatestChangeAt: vi.fn(async () => '2026-06-15T10:50:00.000Z'),
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

function deprecationRepository() {
  return {
    getLatestChangeAt: vi.fn(async () => '2026-06-15T10:50:00.000Z'),
    listExerciseChangeEvents: vi.fn(async () => [
      {
        id: 1,
        exerciseId: 'exercise-1',
        changeType: 'deprecated',
        changedAt: '2026-06-15T10:30:00.000Z',
        catalogVersion: 2
      }
    ]),
    getSyncExercisesByIds: vi.fn(async () => [])
  };
}

function encodeCursorForTest(offset) {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}
