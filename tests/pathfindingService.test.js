import { describe, expect, it, vi } from 'vitest';

import { createPathfindingService } from '../src/services/pathfindingService.js';

// A small progression graph:
//   a -> b -> d      (long path a..d)
//   a -> c -> d      (equal-length alternative)
//   b -> d           (so a->b->d is length 3)
//   e (isolated)
const EDGES = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'd' },
  { from: 'a', to: 'c' },
  { from: 'c', to: 'd' }
];

function buildRepository({ edges = EDGES, exists = ['a', 'b', 'c', 'd', 'e'] } = {}) {
  return {
    getExerciseById: vi.fn(async (id) => (exists.includes(id) ? { id } : null)),
    getProgressionEdges: vi.fn(async () => edges),
    getExerciseSummariesByIds: vi.fn(async (ids) =>
      ids.map((id) => ({ id, slug: id, name: id }))
    )
  };
}

describe('createPathfindingService.findProgressionPath', () => {
  it('returns the shortest chain from start to target in order', async () => {
    const service = createPathfindingService({
      exerciseRepository: buildRepository()
    });

    const result = await service.findProgressionPath({ fromId: 'a', toId: 'd' });

    expect(result.found).toBe(true);
    // a -> b -> d and a -> c -> d are both length 3; BFS returns one shortest.
    expect(result.path).toHaveLength(3);
    expect(result.path[0].id).toBe('a');
    expect(result.path.at(-1).id).toBe('d');
  });

  it('returns a single-element path when start equals target', async () => {
    const service = createPathfindingService({
      exerciseRepository: buildRepository()
    });

    const result = await service.findProgressionPath({ fromId: 'a', toId: 'a' });

    expect(result.found).toBe(true);
    expect(result.path.map((p) => p.id)).toEqual(['a']);
  });

  it('reports no path when the target is unreachable', async () => {
    const service = createPathfindingService({
      exerciseRepository: buildRepository()
    });

    // e is isolated; d does not progress anywhere; no a->e path.
    const result = await service.findProgressionPath({ fromId: 'a', toId: 'e' });

    expect(result.found).toBe(false);
    expect(result.path).toBeNull();
  });

  it('does not loop forever on a cyclic graph', async () => {
    const service = createPathfindingService({
      exerciseRepository: buildRepository({
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' } // cycle
        ],
        exists: ['a', 'b', 'z']
      })
    });

    const result = await service.findProgressionPath({ fromId: 'a', toId: 'z' });

    expect(result.found).toBe(false);
    expect(result.path).toBeNull();
  });

  it('throws 404 when the start exercise does not exist', async () => {
    const service = createPathfindingService({
      exerciseRepository: buildRepository({ exists: ['d'] })
    });

    await expect(
      service.findProgressionPath({ fromId: 'ghost', toId: 'd' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'EXERCISE_NOT_FOUND' });
  });
});
