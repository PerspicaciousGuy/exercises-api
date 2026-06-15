import { AppError } from '../errors/AppError.js';

const RELATION_TYPES = ['variations', 'progressions', 'regressions'];

export function createExerciseService({ exerciseRepository }) {
  return {
    listExercises(filters) {
      return exerciseRepository.listExercises(filters);
    },

    searchExercises(filters) {
      return exerciseRepository.searchExercises(filters);
    },

    getExercisesByIds(ids) {
      return exerciseRepository.getExercisesByIds(ids);
    },

    async getExerciseById(id) {
      return requireExercise(await exerciseRepository.getExerciseById(id));
    },

    async getExerciseBySlug(slug) {
      return requireExercise(await exerciseRepository.getExerciseBySlug(slug));
    },

    async listExerciseRelations({ exerciseId, relationType }) {
      await ensureExerciseExists(exerciseRepository, exerciseId);

      return exerciseRepository.listExerciseRelations({
        exerciseId,
        relationType
      });
    },

    async getRelatedExercises(exerciseId) {
      await ensureExerciseExists(exerciseRepository, exerciseId);
      const [variations, progressions, regressions] = await Promise.all(
        RELATION_TYPES.map((relationType) =>
          exerciseRepository.listExerciseRelations({
            exerciseId,
            relationType
          })
        )
      );

      return {
        variations,
        progressions,
        regressions
      };
    }
  };
}

async function ensureExerciseExists(exerciseRepository, exerciseId) {
  requireExercise(await exerciseRepository.getExerciseById(exerciseId));
}

function requireExercise(exercise) {
  if (!exercise) {
    throw new AppError({
      statusCode: 404,
      code: 'EXERCISE_NOT_FOUND',
      message: 'Exercise was not found'
    });
  }

  return exercise;
}
