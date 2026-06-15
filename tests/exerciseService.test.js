import { describe, expect, it, vi } from 'vitest';

import { createExerciseService } from '../src/services/exerciseService.js';

describe('createExerciseService', () => {
  it('throws not found before loading related exercises for an unknown id', async () => {
    const exerciseRepository = {
      getExerciseById: vi.fn(async () => null),
      listExerciseRelations: vi.fn()
    };
    const service = createExerciseService({ exerciseRepository });

    await expect(
      service.listExerciseRelations({
        exerciseId: 'unknown-exercise',
        relationType: 'variations'
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'EXERCISE_NOT_FOUND',
      message: 'Exercise was not found'
    });
    expect(exerciseRepository.listExerciseRelations).not.toHaveBeenCalled();
  });
});
