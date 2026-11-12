import { Router } from 'express';

import {
  PUBLIC_SEARCH_CACHE_SECONDS,
  PUBLIC_SEARCH_CLIENT_LIMIT,
  PUBLIC_SEARCH_FETCH_LIMIT,
  PUBLIC_SEARCH_GLOBAL_LIMIT,
  PUBLIC_SEARCH_MAX_QUERY_LENGTH,
  PUBLIC_SEARCH_MAX_RESULTS,
  PUBLIC_SEARCH_MIN_QUERY_LENGTH,
  PUBLIC_SEARCH_WINDOW_MS
} from '../constants/publicSearch.js';
import { AppError } from '../errors/AppError.js';
import { createWindowLimiter } from '../middleware/publicSearchLimiter.js';

/**
 * GET /public/search?q= — the only catalog read that needs no API key.
 *
 * It backs the live search box on the docs site. To keep it from doubling as a
 * way to copy the catalog it returns at most a handful of results, only the
 * fields a result row shows (no ids, muscles, instructions or relationships),
 * never premium exercises, and offers no offset to page with. Callers that
 * want the data use the keyed endpoints.
 *
 * Mounted ahead of the API-key middleware; see app.js.
 */
export function createPublicSearchRouter({
  exerciseService,
  limiter = createWindowLimiter({
    windowMs: PUBLIC_SEARCH_WINDOW_MS,
    clientLimit: PUBLIC_SEARCH_CLIENT_LIMIT,
    globalLimit: PUBLIC_SEARCH_GLOBAL_LIMIT
  })
}) {
  const router = Router();

  router.get('/public/search', limiter, async (request, response, next) => {
    try {
      const query = parseQuery(request.query.q);
      const result = await exerciseService.searchExercises({
        query,
        limit: PUBLIC_SEARCH_FETCH_LIMIT,
        offset: 0
      });

      response
        .status(200)
        .set('Cache-Control', `public, max-age=${PUBLIC_SEARCH_CACHE_SECONDS}`)
        .json({
          success: true,
          data: result.exercises
            .filter((exercise) => exercise.status === 'active')
            .filter((exercise) => !exercise.isPremium)
            .slice(0, PUBLIC_SEARCH_MAX_RESULTS)
            .map(toPublicResult)
        });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function parseQuery(value) {
  const query = typeof value === 'string' ? value.trim() : '';

  if (
    query.length < PUBLIC_SEARCH_MIN_QUERY_LENGTH ||
    query.length > PUBLIC_SEARCH_MAX_QUERY_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `q must be between ${PUBLIC_SEARCH_MIN_QUERY_LENGTH} and ${PUBLIC_SEARCH_MAX_QUERY_LENGTH} characters`
    });
  }

  return query;
}

function toPublicResult(exercise) {
  return {
    slug: exercise.slug,
    name: exercise.name,
    category: exercise.category,
    difficulty: exercise.difficulty
  };
}
