import { AppError } from '../errors/AppError.js';
import { logger } from '../logging/logger.js';

const API_KEY_HEADER = 'x-api-key';
const AUTHORIZATION_HEADER = 'authorization';
const BEARER_PREFIX = 'Bearer ';

export function createApiKeyMiddleware({ authService }) {
  return async (request, response, next) => {
    const startedAt = Date.now();

    try {
      const apiKey = getApiKeyFromRequest(request);
      const consumer = await authService.authenticateApiKey(apiKey);

      request.apiConsumer = consumer;
      setRateLimitHeaders(response, consumer.rateLimit);
      response.once('finish', () => {
        // Fire-and-forget: the response has already been sent. An unhandled
        // rejection here would crash the process, so a failed usage write is
        // logged and swallowed. Quota enforcement does not depend on it —
        // that already happened in authenticateApiKey.
        authService
          .logUsage({
            userId: consumer.user.id,
            apiKeyId: consumer.apiKey.id,
            endpoint: request.originalUrl,
            method: request.method,
            statusCode: response.statusCode,
            responseTimeMs: Date.now() - startedAt
          })
          .catch((error) => {
            logger.error(
              { err: error, userId: consumer.user.id },
              'failed to record api usage'
            );
          });
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

function getApiKeyFromRequest(request) {
  const directHeader = request.get(API_KEY_HEADER);

  if (directHeader) {
    return directHeader;
  }

  const authorizationHeader = request.get(AUTHORIZATION_HEADER);

  if (authorizationHeader?.startsWith(BEARER_PREFIX)) {
    return authorizationHeader.slice(BEARER_PREFIX.length);
  }

  throw new AppError({
    statusCode: 401,
    code: 'API_KEY_REQUIRED',
    message: 'API key is required'
  });
}

function setRateLimitHeaders(response, rateLimit) {
  response.set('X-RateLimit-Limit', String(rateLimit.limit));
  response.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  response.set('X-RateLimit-Reset', rateLimit.resetAt);
}
