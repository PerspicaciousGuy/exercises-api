import { AppError } from '../errors/AppError.js';
import { isUuid } from '../utils/ids.js';

/**
 * Coverage analysis over a caller-supplied set of exercises. Stateless: the
 * caller sends exercise ids (a workout), and gets back which muscles the set
 * trains and where it is unbalanced. Purely descriptive — it reports what is
 * and is not covered, it does not prescribe what to add.
 */

const PULL_PATTERNS = new Set(['pull', 'hinge']);
const PUSH_PATTERNS = new Set(['push', 'squat']);

export function createAnalysisService({ exerciseRepository }) {
  return {
    async analyzeCoverage(exerciseIds) {
      // Malformed ids are reported as unknown, not sent to the database — a
      // non-uuid would make PostgREST reject the whole query.
      const validIds = exerciseIds.filter(isUuid);
      const malformedIds = exerciseIds.filter((id) => !isUuid(id));

      const exercises =
        validIds.length > 0
          ? await exerciseRepository.getExercisesByIds(validIds)
          : [];
      const foundIds = new Set(exercises.map((exercise) => exercise.id));
      const unknownIds = [
        ...validIds.filter((id) => !foundIds.has(id)),
        ...malformedIds
      ];

      if (exercises.length === 0) {
        throw new AppError({
          statusCode: 404,
          code: 'NO_EXERCISES_FOUND',
          message: 'None of the requested exercises were found'
        });
      }

      const muscleSlugsByExercise =
        await exerciseRepository.getMuscleSlugsByExerciseIds(
          exercises.map((exercise) => exercise.id)
        );

      return buildCoverageReport(exercises, muscleSlugsByExercise, unknownIds);
    }
  };
}

function buildCoverageReport(exercises, muscleSlugsByExercise, unknownIds) {
  const primary = new Map();
  const secondary = new Map();

  for (const exercise of exercises) {
    const roles = muscleSlugsByExercise.get(exercise.id) ?? {
      primary: [],
      secondary: []
    };
    for (const slug of roles.primary) increment(primary, slug);
    for (const slug of roles.secondary) increment(secondary, slug);
  }

  return {
    exerciseCount: exercises.length,
    unknownExerciseIds: unknownIds,
    muscles: {
      primary: toSortedCounts(primary),
      secondary: toSortedCounts(secondary)
    },
    balance: buildBalance(exercises, primary)
  };
}

function buildBalance(exercises, primaryMuscleCounts) {
  const patternCounts = new Map();
  for (const exercise of exercises) {
    increment(patternCounts, exercise.movementPattern);
  }

  let push = 0;
  let pull = 0;
  for (const [pattern, count] of patternCounts) {
    if (PUSH_PATTERNS.has(pattern)) push += count;
    if (PULL_PATTERNS.has(pattern)) pull += count;
  }

  return {
    movementPatterns: toSortedCounts(patternCounts),
    pushCount: push,
    pullCount: pull,
    primaryMuscleGroupCount: primaryMuscleCounts.size
  };
}

function increment(map, key) {
  if (key === null || key === undefined) {
    return;
  }
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toSortedCounts(map) {
  return [...map.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}
