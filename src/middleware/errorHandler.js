import { SERVER_ERROR_THRESHOLD } from '../constants/logging.js';
import {
  buildProblemDetails,
  sendProblemDetails
} from '../errors/problemDetails.js';
import { logger } from '../logging/logger.js';

const DEFAULT_STATUS_CODE = 500;
const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

export function errorHandler(error, request, response, _next) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : DEFAULT_STATUS_CODE;

  logError(error, statusCode, request);

  if (Number.isInteger(error.retryAfterSeconds)) {
    response.set('Retry-After', String(error.retryAfterSeconds));
  }

  sendProblemDetails(
    response,
    buildProblemDetails({
      statusCode,
      code: error.code ?? DEFAULT_ERROR_CODE,
      message: error.message,
      instance: request.originalUrl
    })
  );
}

/**
 * A 5xx is an incident and carries its stack. A 4xx is a caller mistake — it is
 * worth a line for rate-limit and auth forensics, but a stack trace would bury
 * the real failures.
 */
function logError(error, statusCode, request) {
  const context = {
    code: error.code ?? DEFAULT_ERROR_CODE,
    statusCode,
    method: request.method,
    path: request.originalUrl
  };

  if (statusCode >= SERVER_ERROR_THRESHOLD) {
    logger.error({ ...context, err: error }, error.message);
    return;
  }

  logger.warn(context, error.message);
}
