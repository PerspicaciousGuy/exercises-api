import { describe, expect, it, vi } from 'vitest';

import { createSyncRepository } from '../src/repositories/syncRepository.js';

describe('createSyncRepository', () => {
  it('returns sync metadata from exercises and change events', async () => {
    const client = {
      select: vi.fn(async (table, options) => {
        if (
          table === 'exercises' &&
          options.filters.order === 'catalog_version.desc'
        ) {
          return [{ catalog_version: 4 }];
        }

        if (table === 'exercises') {
          return [{ updated_at: '2026-06-15T10:00:00.000Z' }];
        }

        return [
          {
            changed_at: '2026-06-15T10:30:00.000Z',
            catalog_version: 4
          }
        ];
      })
    };
    const repository = createSyncRepository({ client });

    const metadata = await repository.getSyncMetadata();

    expect(client.select).toHaveBeenCalledWith('exercises', {
      columns: 'catalog_version',
      filters: {
        order: 'catalog_version.desc',
        limit: '1'
      }
    });
    expect(metadata).toEqual({
      catalogVersion: 4,
      latestExerciseUpdatedAt: '2026-06-15T10:00:00.000Z',
      latestChangeAt: '2026-06-15T10:30:00.000Z'
    });
  });

  it('reads the latest change timestamp', async () => {
    const client = {
      select: vi.fn(async () => [{ changed_at: '2026-06-15T10:30:00.000Z' }])
    };
    const repository = createSyncRepository({ client });

    await expect(repository.getLatestChangeAt()).resolves.toBe(
      '2026-06-15T10:30:00.000Z'
    );
    expect(client.select).toHaveBeenCalledWith('exercise_change_events', {
      columns: 'changed_at',
      filters: { order: 'changed_at.desc', limit: '1' }
    });
  });

  it('returns null when the catalog has no change events', async () => {
    const repository = createSyncRepository({
      client: { select: vi.fn(async () => []) }
    });

    await expect(repository.getLatestChangeAt()).resolves.toBeNull();
  });

  it('lists exercise change events after an update timestamp', async () => {
    const client = {
      select: vi.fn(async () => [
        {
          id: 10,
          exercise_id: 'exercise-1',
          change_type: 'updated',
          changed_at: '2026-06-15T10:30:00.000Z',
          catalog_version: 2,
          payload: { slug: 'push-up' }
        }
      ])
    };
    const repository = createSyncRepository({ client });

    const events = await repository.listExerciseChangeEvents({
      updatedSince: '2026-06-15T10:00:00.000Z',
      limit: 3,
      offset: 2
    });

    expect(client.select).toHaveBeenCalledWith('exercise_change_events', {
      columns: 'id,exercise_id,change_type,changed_at,catalog_version,payload',
      filters: {
        changed_at: 'gt.2026-06-15T10:00:00.000Z',
        order: 'id.asc',
        limit: '3',
        offset: '2'
      }
    });
    expect(events).toEqual([
      {
        id: 10,
        exerciseId: 'exercise-1',
        changeType: 'updated',
        changedAt: '2026-06-15T10:30:00.000Z',
        catalogVersion: 2,
        payload: { slug: 'push-up' }
      }
    ]);
  });

  it('fetches active and optionally deprecated sync exercise records by id', async () => {
    const client = {
      select: vi.fn(async () => [
        {
          id: 'exercise-1',
          slug: 'push-up',
          name: 'Push-up',
          status: 'active',
          description: 'Bodyweight press.',
          instructions: [],
          tips: [],
          breathing_cues: null,
          contraindications: [],
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
          flags: [],
          programming: {},
          tags: ['push'],
          is_premium: false,
          catalog_version: 1,
          updated_at: '2026-06-15T10:00:00.000Z',
          categories: { slug: 'strength', name: 'Strength' }
        }
      ])
    };
    const repository = createSyncRepository({ client });

    const exercises = await repository.getSyncExercisesByIds({
      ids: ['exercise-1'],
      includeDeprecated: true
    });

    expect(client.select).toHaveBeenCalledWith('exercises', {
      columns: expect.stringContaining('catalog_version'),
      filters: {
        id: 'in.(exercise-1)',
        status: 'in.(active,deprecated)',
        deleted_at: 'is.null'
      }
    });
    expect(exercises[0]).toMatchObject({
      id: 'exercise-1',
      slug: 'push-up',
      status: 'active',
      catalogVersion: 1
    });
  });
});
