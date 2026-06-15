import { describe, expect, it, vi } from 'vitest';

import { createReferenceRepository } from '../src/repositories/referenceRepository.js';

describe('createReferenceRepository', () => {
  it('lists muscles with API field names', async () => {
    const client = {
      select: vi.fn(async () => [
        {
          id: 1,
          slug: 'chest',
          name: 'Chest',
          region: 'upper_body',
          muscle_group: 'push',
          parent_muscle_id: null,
          display_order: 10,
          updated_at: '2026-06-15T10:00:00.000Z'
        }
      ])
    };
    const repository = createReferenceRepository({ client });

    const muscles = await repository.listMuscles();

    expect(client.select).toHaveBeenCalledWith('muscles', {
      columns:
        'id,slug,name,region,muscle_group,parent_muscle_id,display_order,updated_at',
      filters: {
        order: 'display_order.asc'
      }
    });
    expect(muscles).toEqual([
      {
        id: 1,
        slug: 'chest',
        name: 'Chest',
        region: 'upper_body',
        muscleGroup: 'push',
        parentMuscleId: null,
        displayOrder: 10,
        updatedAt: '2026-06-15T10:00:00.000Z'
      }
    ]);
  });

  it('returns metadata with references and enum values', async () => {
    const client = {
      select: vi.fn(async (table) => {
        const rowsByTable = {
          muscles: [
            {
              id: 1,
              slug: 'chest',
              name: 'Chest',
              region: 'upper_body',
              muscle_group: 'push',
              parent_muscle_id: null,
              display_order: 10,
              updated_at: '2026-06-15T10:00:00.000Z'
            }
          ],
          equipment: [
            {
              id: 1,
              slug: 'bodyweight',
              name: 'Bodyweight',
              equipment_group: 'bodyweight',
              display_order: 10,
              updated_at: '2026-06-15T10:00:00.000Z'
            }
          ],
          categories: [
            {
              id: 1,
              slug: 'strength',
              name: 'Strength',
              category: 'strength',
              description: 'Strength movements',
              display_order: 10,
              updated_at: '2026-06-15T10:00:00.000Z'
            }
          ],
          exercise_flags: [],
          joint_regions: []
        };

        return rowsByTable[table] ?? [];
      })
    };
    const repository = createReferenceRepository({ client });

    const metadata = await repository.getMetadata();

    expect(metadata.muscles).toHaveLength(1);
    expect(metadata.equipment).toHaveLength(1);
    expect(metadata.categories).toHaveLength(1);
    expect(metadata.enums).toMatchObject({
      difficulties: ['beginner', 'intermediate', 'advanced'],
      movementPatterns: [
        'squat',
        'hinge',
        'push',
        'pull',
        'carry',
        'rotation',
        'gait'
      ],
      forceTypes: ['push', 'pull', 'static', 'compound']
    });
  });
});
