import { randomUUID } from 'node:crypto';

import {
  REQUEST_ID_HEADER,
  REQUEST_ID_MAX_LENGTH,
  SERVER_ERROR_THRESHOLD,
  CLIENT_ERROR_THRESHOLD
} from '../constants/logging.js';
import { logger } from '../logging/logger.js';
import { runWithRequestContext } from '../logging/requestContext.js';

/**
 * Assigns every request an id, echoes it back, and logs one line per completed
 * request.
 *
 * An inbound `X-Request-Id` is honoured so a trace can span services, but it is
 * sanitised first: it lands in log files and response headers, and an attacker
 * controlling it could otherwise inject newlines to forge log entries or smuggle
 * header content.
 */
export function requestLogger(request, response, next) {
  const requestId = resolveRequestId(request.get(REQUEST_ID_HEADER));

  request.id = requestId;
  response.set(REQUEST_ID_HEADER, requestId);

  runWithRequestContext({ requestId }, () => {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      logger[levelFor(response.statusCode)](
        {
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Math.round(durationMs * 100) / 100
        },
        'request completed'
      );
    });

    next();
  });
}

/**
 * Exported for testing: Node's HTTP client refuses to send a header containing
 * CRLF, so an injection attempt cannot be driven through a test request. A
 * proxy or a non-Node client can still deliver one.
 */
export function resolveRequestId(headerValue) {
  if (typeof headerValue !== 'string') {
    return randomUUID();
  }

  const sanitised = headerValue
    .replace(/[^\w.-]/g, '')
    .slice(0, REQUEST_ID_MAX_LENGTH);

  return sanitised.length > 0 ? sanitised : randomUUID();
}

function levelFor(statusCode) {
  if (statusCode >= SERVER_ERROR_THRESHOLD) {
    return 'error';
  }

  return statusCode >= CLIENT_ERROR_THRESHOLD ? 'warn' : 'info';
}
