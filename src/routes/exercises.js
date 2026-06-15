import { Router } from 'express';
import { z } from 'zod';

import { PREMIUM_ACCESS_TIERS } from '../constants/rateLimits.js';
import { AppError } from '../errors/AppError.js';
import { createExerciseService } from '../services/exerciseService.js';

const BULK_ID_LIMIT = 50;
const PREMIUM_ACCESS_ERROR = {
  statusCode: 403,
  code: 'PREMIUM_ACCESS_REQUIRED',
  message: 'Premium content requires a pro or enterprise API tier'
};

const listExercisesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().min(1).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  equipment: z.string().min(1).optional(),
  muscle: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  updated_since: z.string().datetime({ offset: true }).optional(),
  include_deprecated: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  fields: z.string().min(1).optional()
});

const searchExercisesQuerySchema = z.object({
  q: z.string({ required_error: 'is required' }).trim().min(1, 'is required'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export function createExercisesRouter({ exerciseRepository, exerciseService }) {
  const router = Router();
  const service =
    exerciseService ?? createExerciseService({ exerciseRepository });

  router.get(
    '/exercises',
    asyncHandler(async (request, response) => {
      const { fields, ...filters } = parseListFilters(request.query);
      const result = await service.listExercises(filters);
      const exercises = filterPremiumExercises(result.exercises, request);

      response.status(200).json({
        success: true,
        data: applySparseFields(exercises, fields),
        pagination: result.pagination
      });
    })
  );

  router.get(
    '/exercises/search',
    asyncHandler(async (request, response) => {
      const filters = parseSearchFilters(request.query);
      const result = await service.searchExercises(filters);

      response.status(200).json({
        success: true,
        data: filterPremiumExercises(result.exercises, request),
        pagination: result.pagination
      });
    })
  );

  router.get(
    '/exercises/bulk',
    asyncHandler(async (request, response) => {
      const ids = parseBulkIds(request.query.ids);
      const exercises = await service.getExercisesByIds(ids);

      response.status(200).json({
        success: true,
        data: filterPremiumExercises(exercises, request)
      });
    })
  );

  router.get(
    '/exercises/slug/:slug',
    asyncHandler(async (request, response) => {
      const exercise = await service.getExerciseBySlug(request.params.slug);
      requirePremiumAccess(exercise, request);

      response.status(200).json({
        success: true,
        data: exercise
      });
    })
  );

  router.get(
    '/exercises/:id/related',
    asyncHandler(async (request, response) => {
      const related = await service.getRelatedExercises(request.params.id);

      response.status(200).json({
        success: true,
        data: filterPremiumRelationGroups(related, request)
      });
    })
  );

  router.get(
    '/exercises/:id/variations',
    createRelationHandler(service, 'variations')
  );

  router.get(
    '/exercises/:id/progressions',
    createRelationHandler(service, 'progressions')
  );

  router.get(
    '/exercises/:id/regressions',
    createRelationHandler(service, 'regressions')
  );

  router.get(
    '/exercises/:id',
    asyncHandler(async (request, response) => {
      const exercise = await service.getExerciseById(request.params.id);
      requirePremiumAccess(exercise, request);

      response.status(200).json({
        success: true,
        data: exercise
      });
    })
  );

  return router;
}

function createRelationHandler(service, relationType) {
  return asyncHandler(async (request, response) => {
    const exercises = await service.listExerciseRelations({
      exerciseId: request.params.id,
      relationType
    });

    response.status(200).json({
      success: true,
      data: filterPremiumExercises(exercises, request)
    });
  });
}

function filterPremiumRelationGroups(relationGroups, request) {
  return Object.fromEntries(
    Object.entries(relationGroups).map(([relationType, exercises]) => [
      relationType,
      filterPremiumExercises(exercises, request)
    ])
  );
}

function filterPremiumExercises(exercises, request) {
  if (canAccessPremium(request)) {
    return exercises;
  }

  return exercises.filter((exercise) => !exercise.isPremium);
}

function requirePremiumAccess(exercise, request) {
  if (exercise.isPremium && !canAccessPremium(request)) {
    throw new AppError(PREMIUM_ACCESS_ERROR);
  }
}

function canAccessPremium(request) {
  return PREMIUM_ACCESS_TIERS.has(request.apiConsumer?.user?.tier);
}

function parseListFilters(query) {
  const parsed = listExercisesQuerySchema.safeParse(query);

  if (!parsed.success) {
    throwValidationError(parsed.error.issues[0]);
  }

  return {
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    category: parsed.data.category,
    difficulty: parsed.data.difficulty,
    equipment: parsed.data.equipment,
    muscle: parsed.data.muscle,
    search: parsed.data.search,
    updatedSince: parsed.data.updated_since,
    includeDeprecated: parsed.data.include_deprecated,
    fields: parsed.data.fields
  };
}

function parseSearchFilters(query) {
  const parsed = searchExercisesQuerySchema.safeParse(query);

  if (!parsed.success) {
    throwValidationError(parsed.error.issues[0]);
  }

  return {
    query: parsed.data.q,
    limit: parsed.data.limit,
    offset: parsed.data.offset
  };
}

function parseBulkIds(ids) {
  if (!ids) {
    throwValidationMessage('ids is required');
  }

  const parsedIds = ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (parsedIds.length === 0) {
    throwValidationMessage('ids is required');
  }

  if (parsedIds.length > BULK_ID_LIMIT) {
    throwValidationMessage(`ids must include ${BULK_ID_LIMIT} or fewer values`);
  }

  return parsedIds;
}

function throwValidationError(issue) {
  throwValidationMessage(
    `${issue.path.join('.')} ${formatValidationMessage(issue.message)}`
  );
}

function throwValidationMessage(message) {
  throw new AppError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message
  });
}

function formatValidationMessage(value) {
  const message = `${value.charAt(0).toLowerCase()}${value.slice(1)}`;

  return message.replace(/^number /, '');
}

function applySparseFields(exercises, fields) {
  if (!fields) {
    return exercises;
  }

  const selectedFields = fields.split(',').map((field) => field.trim());

  return exercises.map((exercise) => pickFields(exercise, selectedFields));
}

function pickFields(exercise, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => Object.prototype.hasOwnProperty.call(exercise, field))
      .map((field) => [field, exercise[field]])
  );
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
