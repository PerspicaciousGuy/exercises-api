import { SERVER_ERROR_THRESHOLD } from '../constants/logging.js';
import { ERROR_TYPE_BASE_URL } from '../constants/service.js';
import { getRequestId } from '../logging/requestContext.js';

const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';
const GENERIC_SERVER_ERROR_DETAIL = 'An unexpected error occurred';

/**
 * Builds an RFC 9457 Problem Details body. `code` is kept as an extension
 * member so clients retain a machine-readable error identifier alongside the
 * standard members.
 *
 * Server-error details are replaced with a generic message so internal failures
 * never leak to callers. `requestId` is the compensation: it says nothing to an
 * attacker but lets an operator find the one log line that explains the 500.
 */
export function buildProblemDetails({ statusCode, code, message, instance }) {
  const problem = {
    type: `${ERROR_TYPE_BASE_URL}/${toKebabCase(code)}`,
    title: toTitleCase(code),
    status: statusCode,
    detail:
      statusCode >= SERVER_ERROR_THRESHOLD
        ? GENERIC_SERVER_ERROR_DETAIL
        : message,
    code
  };
  const requestId = getRequestId();

  return {
    ...problem,
    ...(instance ? { instance } : {}),
    ...(requestId ? { requestId } : {})
  };
}

export function sendProblemDetails(response, problem) {
  response.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
}

function toKebabCase(code) {
  return code.toLowerCase().replaceAll('_', '-');
}

function toTitleCase(code) {
  return code
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
