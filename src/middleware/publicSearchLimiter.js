import { AppError } from '../errors/AppError.js';

const MS_PER_SECOND = 1000;

/**
 * Fixed-window request limiter for unauthenticated routes.
 *
 * Two limits apply: one per client address and one across everyone. The global
 * ceiling is what protects the database, because a client address is only as
 * trustworthy as the proxy setting (`TRUST_PROXY_HOPS`) behind it.
 *
 * State lives in memory, so it resets on restart and is per instance. That is
 * acceptable here: the route is read-only and cheap, and the aim is to stop
 * bulk copying, not to meter customers. The map is cleared every window and
 * only counts admitted requests, so it can never hold more entries than the
 * global limit.
 */
export function createWindowLimiter({
  windowMs,
  clientLimit,
  globalLimit,
  now = Date.now
}) {
  let windowStart = now();
  let globalCount = 0;
  const clientCounts = new Map();

  return function windowLimiter(request, _response, next) {
    const current = now();

    if (current - windowStart >= windowMs) {
      windowStart = current;
      globalCount = 0;
      clientCounts.clear();
    }

    const client = request.ip ?? 'unknown';
    const clientCount = clientCounts.get(client) ?? 0;

    if (globalCount >= globalLimit || clientCount >= clientLimit) {
      const remainingMs = windowStart + windowMs - current;

      next(
        new AppError({
          statusCode: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many searches. Try again shortly.',
          retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / MS_PER_SECOND))
        })
      );
      return;
    }

    clientCounts.set(client, clientCount + 1);
    globalCount += 1;
    next();
  };
}
