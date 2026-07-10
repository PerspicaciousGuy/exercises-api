import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../errors/AppError.js';
import { createSyncService } from '../services/syncService.js';

const syncExercisesQuerySchema = z.object({
  updated_since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().min(1).optional(),
  include_deprecated: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true')
});

export function createSyncRouter({ syncRepository, syncService }) {
  const router = Router();
  const service = syncService ?? createSyncService({ syncRepository });

  router.get(
    '/sync/metadata',
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        success: true,
        data: await service.getSyncMetadata()
      });
    })
  );

  router.get(
    '/sync/exercises',
    asyncHandler(async (request, response) => {
      const syncResult = await service.syncExercises(
        parseSyncExerciseFilters(request.query)
      );

      response.status(200).json({
        success: true,
        data: {
          exercises: syncResult.exercises,
          tombstones: syncResult.tombstones,
          latestChangeAt: syncResult.latestChangeAt
        },
        pagination: syncResult.pagination
      });
    })
  );

  return router;
}

function parseSyncExerciseFilters(query) {
  const parsed = syncExercisesQuerySchema.safeParse(query);

  if (!parsed.success) {
    throwValidationError(parsed.error.issues[0]);
  }

  return {
    updatedSince: parsed.data.updated_since,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
    includeDeprecated: parsed.data.include_deprecated
  };
}

function throwValidationError(issue) {
  throw new AppError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: `${issue.path.join('.')} ${formatValidationMessage(issue.message)}`
  });
}

function formatValidationMessage(value) {
  const message = `${value.charAt(0).toLowerCase()}${value.slice(1)}`;

  return message.replace(/^number /, '');
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
