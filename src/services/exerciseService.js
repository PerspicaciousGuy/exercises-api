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
    },

    async getSubstitutes({ exerciseId, equipment }) {
      await ensureExerciseExists(exerciseRepository, exerciseId);
      const variations = await exerciseRepository.listExerciseRelations({
        exerciseId,
        relationType: 'variations'
      });

      if (!equipment || equipment.length === 0) {
        return variations;
      }

      const available = new Set(equipment);
      const equipmentByExercise =
        await exerciseRepository.getEquipmentSlugsByExerciseIds(
          variations.map((variation) => variation.id)
        );

      // A substitute is usable only if every piece of its equipment is on hand.
      // Equipment-less variations (e.g. bodyweight) are always usable.
      return variations.filter((variation) =>
        (equipmentByExercise.get(variation.id) ?? []).every((slug) =>
          available.has(slug)
        )
      );
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
