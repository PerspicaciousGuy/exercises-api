import { createHash } from 'node:crypto';

const CACHE_CONTROL = 'private, must-revalidate';

/**
 * Adds conditional-request caching to GET responses. It wraps `res.json` to
 * compute a strong ETag from the exact bytes being sent, sets `Cache-Control`
 * and `ETag`, and — when the request's `If-None-Match` already matches — sends
 * `304 Not Modified` with an empty body instead of the payload.
 *
 * The ETag is a hash of the serialized body, so it is correct on any data
 * change with no manual invalidation. Only `200` GET responses are tagged;
 * errors and non-GET methods pass through untouched.
 *
 * Express's built-in weak ETag must be disabled (`app.set('etag', false)`) so
 * the two mechanisms do not fight over the header.
 */
export function responseCache() {
  return (request, response, next) => {
    if (request.method !== 'GET') {
      next();
      return;
    }

    const originalJson = response.json.bind(response);

    response.json = (body) => {
      if (response.statusCode !== 200) {
        return originalJson(body);
      }

      const payload = JSON.stringify(body);
      const etag = buildEtag(payload);

      response.set('Cache-Control', CACHE_CONTROL);
      response.set('ETag', etag);

      if (isNoneMatch(request.get('if-none-match'), etag)) {
        // 304 must not carry a body; the client reuses its cached copy.
        response.status(304).end();
        return response;
      }

      return originalJson(body);
    };

    next();
  };
}

function buildEtag(payload) {
  const hash = createHash('sha256').update(payload).digest('hex');
  return `"${hash}"`;
}

/**
 * True when the client's `If-None-Match` covers the current ETag. Handles a
 * comma-separated list and the `*` wildcard; ignores a weak-validator prefix
 * since the tags issued here are strong.
 */
function isNoneMatch(headerValue, etag) {
  if (!headerValue) {
    return false;
  }

  return headerValue
    .split(',')
    .map((value) => value.trim().replace(/^W\//, ''))
    .some((value) => value === '*' || value === etag);
}
