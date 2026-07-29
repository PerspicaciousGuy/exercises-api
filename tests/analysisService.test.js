import { describe, expect, it, vi } from 'vitest';

import { createAnalysisService } from '../src/services/analysisService.js';

// Real exercise ids are UUIDs; the service filters out non-uuid ids before
// querying, so the tests use well-formed uuids.
const E1 = '3f1c9b2a-0000-4000-8000-000000000001';
const E2 = '3f1c9b2a-0000-4000-8000-000000000002';
const E3 = '3f1c9b2a-0000-4000-8000-000000000003';

function buildRepository({ exercises, muscles }) {
  return {
    getExercisesByIds: vi.fn(async (ids) =>
      exercises.filter((exercise) => ids.includes(exercise.id))
    ),
    getMuscleSlugsByExerciseIds: vi.fn(
      async () => new Map(Object.entries(muscles))
    )
  };
}

describe('createAnalysisService.analyzeCoverage', () => {
  it('aggregates primary and secondary muscle counts across the set', async () => {
    const repository = buildRepository({
      exercises: [
        { id: E1, movementPattern: 'push' },
        { id: E2, movementPattern: 'push' }
      ],
      muscles: {
        [E1]: { primary: ['chest'], secondary: ['triceps'] },
        [E2]: { primary: ['chest'], secondary: ['front-delts', 'triceps'] }
      }
    });
    const service = createAnalysisService({ exerciseRepository: repository });

    const report = await service.analyzeCoverage([E1, E2]);

    expect(report.exerciseCount).toBe(2);
    expect(report.muscles.primary).toEqual([{ slug: 'chest', count: 2 }]);
    // Sorted by count desc, then slug asc.
    expect(report.muscles.secondary).toEqual([
      { slug: 'triceps', count: 2 },
      { slug: 'front-delts', count: 1 }
    ]);
  });

  it('reports push/pull balance from movement patterns', async () => {
    const repository = buildRepository({
      exercises: [
        { id: E1, movementPattern: 'push' },
        { id: E2, movementPattern: 'squat' },
        { id: E3, movementPattern: 'pull' }
      ],
      muscles: {
        [E1]: { primary: ['chest'], secondary: [] },
        [E2]: { primary: ['quadriceps'], secondary: [] },
        [E3]: { primary: ['lats'], secondary: [] }
      }
    });
    const service = createAnalysisService({ exerciseRepository: repository });

    const report = await service.analyzeCoverage([E1, E2, E3]);

    // push + squat count as push work; pull + hinge as pull work.
    expect(report.balance.pushCount).toBe(2);
    expect(report.balance.pullCount).toBe(1);
    expect(report.balance.primaryMuscleGroupCount).toBe(3);
  });

  it('surfaces ids that did not resolve to a real exercise', async () => {
    const repository = buildRepository({
      exercises: [{ id: E1, movementPattern: 'push' }],
      muscles: { [E1]: { primary: ['chest'], secondary: [] } }
    });
    const service = createAnalysisService({ exerciseRepository: repository });

    const report = await service.analyzeCoverage([E1, E2]);

    expect(report.unknownExerciseIds).toEqual([E2]);
    expect(report.exerciseCount).toBe(1);
  });

  it('treats a malformed (non-uuid) id as unknown instead of querying it', async () => {
    const repository = buildRepository({
      exercises: [{ id: E1, movementPattern: 'push' }],
      muscles: { [E1]: { primary: ['chest'], secondary: [] } }
    });
    const service = createAnalysisService({ exerciseRepository: repository });

    const report = await service.analyzeCoverage([E1, 'ghost-id']);

    expect(report.unknownExerciseIds).toContain('ghost-id');
    // only the well-formed id was sent to the database
    expect(repository.getExercisesByIds).toHaveBeenCalledWith([E1]);
  });

  it('throws 404 when none of the requested exercises exist', async () => {
    const repository = buildRepository({ exercises: [], muscles: {} });
    const service = createAnalysisService({ exerciseRepository: repository });

    await expect(service.analyzeCoverage([E1])).rejects.toMatchObject({
      statusCode: 404,
      code: 'NO_EXERCISES_FOUND'
    });
  });
});
