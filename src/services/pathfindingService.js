import { AppError } from '../errors/AppError.js';

/**
 * Finds the shortest progression path from one exercise up to another, walking
 * the directed progression graph (easier -> harder). The graph is small, so it
 * is loaded whole and searched breadth-first in memory. BFS gives the shortest
 * chain and is cycle-safe via the visited set.
 *
 * Both endpoints must exist. A path is only ever "up" the ladder: if the target
 * is not reachable by progressions from the start, there is honestly no path.
 */
export function createPathfindingService({ exerciseRepository }) {
  return {
    async findProgressionPath({ fromId, toId }) {
      const [from, to] = await Promise.all([
        exerciseRepository.getExerciseById(fromId),
        exerciseRepository.getExerciseById(toId)
      ]);
      requireExercise(from);
      requireExercise(to);

      if (fromId === toId) {
        const [summary] = await exerciseRepository.getExerciseSummariesByIds([
          fromId
        ]);
        return { path: summary ? [summary] : [], found: true };
      }

      const edges = await exerciseRepository.getProgressionEdges();
      const pathIds = shortestPath(edges, fromId, toId);

      if (!pathIds) {
        return { path: null, found: false };
      }

      return { path: await hydratePath(exerciseRepository, pathIds), found: true };
    }
  };
}

function shortestPath(edges, fromId, toId) {
  const adjacency = new Map();
  for (const { from, to } of edges) {
    (adjacency.get(from) ?? adjacency.set(from, []).get(from)).push(to);
  }

  const queue = [fromId];
  const cameFrom = new Map([[fromId, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === toId) {
      return reconstruct(cameFrom, toId);
    }

    for (const next of adjacency.get(current) ?? []) {
      if (!cameFrom.has(next)) {
        cameFrom.set(next, current);
        queue.push(next);
      }
    }
  }

  return null;
}

function reconstruct(cameFrom, toId) {
  const path = [];
  let node = toId;
  while (node !== null && node !== undefined) {
    path.unshift(node);
    node = cameFrom.get(node);
  }
  return path;
}

/**
 * Turns the ordered path ids into summaries, preserving path order (the
 * id-filter query returns rows in arbitrary order).
 */
async function hydratePath(exerciseRepository, pathIds) {
  const summaries = await exerciseRepository.getExerciseSummariesByIds(pathIds);
  const byId = new Map(summaries.map((summary) => [summary.id, summary]));
  return pathIds.map((id) => byId.get(id)).filter(Boolean);
}

function requireExercise(exercise) {
  if (!exercise) {
    throw new AppError({
      statusCode: 404,
      code: 'EXERCISE_NOT_FOUND',
      message: 'Exercise was not found'
    });
  }
}
