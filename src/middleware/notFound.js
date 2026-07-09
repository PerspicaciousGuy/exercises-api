import {
  buildProblemDetails,
  sendProblemDetails
} from '../errors/problemDetails.js';

const NOT_FOUND_STATUS_CODE = 404;

export function notFound(request, response) {
  sendProblemDetails(
    response,
    buildProblemDetails({
      statusCode: NOT_FOUND_STATUS_CODE,
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.originalUrl} was not found`,
      instance: request.originalUrl
    })
  );
}
