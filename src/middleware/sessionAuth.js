import { AppError } from '../errors/AppError.js';
import { readCookie, SESSION_COOKIE_NAME } from '../security/sessions.js';

const API_KEY_HEADER = 'x-api-key';
const AUTHORIZATION_HEADER = 'authorization';

export function getSessionToken(request) {
  return readCookie(request.get('cookie'), SESSION_COOKIE_NAME);
}

function hasApiKeyCredential(request) {
  return Boolean(
    request.get(API_KEY_HEADER) ?? request.get(AUTHORIZATION_HEADER)
  );
}

/**
 * Authenticates `/me/*` with either a browser session or an API key.
 *
 * The dashboard cannot use an API key: the plaintext key is shown exactly once,
 * so a page that lists keys could never obtain one. The API key path stays
 * supported so existing CLI and script callers keep working.
 *
 * A session is checked first. When both credentials are absent the API key
 * error is raised, because that is the documented contract for `/me`.
 */
export function createSessionOrApiKeyMiddleware({
  sessionService,
  apiKeyMiddleware
}) {
  return async (request, response, next) => {
    const token = getSessionToken(request);

    if (!token) {
      if (hasApiKeyCredential(request)) {
        return apiKeyMiddleware(request, response, next);
      }

      return next(
        new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'A session cookie or API key is required'
        })
      );
    }

    try {
      const { user, session } = await sessionService.authenticateSession(token);

      // Shaped like the API-key consumer so `/me` handlers stay identical.
      // `apiKey` is absent: a session is not an API key and must never be
      // mistaken for one when logging usage.
      request.apiConsumer = { user };
      request.session = session;
      next();
    } catch (error) {
      next(error);
    }
  };
}
