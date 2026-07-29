import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../errors/AppError.js';
import { createAnalysisService } from '../services/analysisService.js';

const EXERCISE_ID_LIMIT = 50;

const coverageBodySchema = z.object({
  exerciseIds: z
    .array(z.string().trim().min(1))
    .min(1, 'must include at least one exercise id')
    .max(EXERCISE_ID_LIMIT, `must include ${EXERCISE_ID_LIMIT} or fewer ids`)
});

export function createAnalysisRouter({ exerciseRepository, analysisService }) {
  const router = Router();
  const service =
    analysisService ?? createAnalysisService({ exerciseRepository });

  router.post(
    '/analyze/coverage',
    asyncHandler(async (request, response) => {
      const { exerciseIds } = parseCoverageBody(request.body);
      const report = await service.analyzeCoverage(unique(exerciseIds));

      response.status(200).json({
        success: true,
        data: report
      });
    })
  );

  return router;
}

function parseCoverageBody(body) {
  const parsed = coverageBodySchema.safeParse(body ?? {});

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join('.') || 'exerciseIds';
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `${field} ${issue.message}`
    });
  }

  return parsed.data;
}

function unique(values) {
  return [...new Set(values)];
}

function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}
