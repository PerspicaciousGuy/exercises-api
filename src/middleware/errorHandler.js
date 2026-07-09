import {
  buildProblemDetails,
  sendProblemDetails
} from '../errors/problemDetails.js';

const DEFAULT_STATUS_CODE = 500;
const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

export function errorHandler(error, request, response, _next) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : DEFAULT_STATUS_CODE;

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
