/**
 * Limits for GET /public/search, the one catalog read that needs no API key.
 *
 * It exists so the docs site can offer a live search box without shipping a key
 * or the catalog. Every limit here is about making sure it cannot be used to
 * copy that catalog: results are capped and slim, there is no paging, and the
 * request rate is bounded per client and in total.
 */

export const PUBLIC_SEARCH_MAX_RESULTS = 6;

/** Extra rows fetched so dropping premium rows still leaves a full page. */
export const PUBLIC_SEARCH_FETCH_LIMIT = 20;

export const PUBLIC_SEARCH_MIN_QUERY_LENGTH = 2;
export const PUBLIC_SEARCH_MAX_QUERY_LENGTH = 60;

export const PUBLIC_SEARCH_WINDOW_MS = 60_000;

/** Per client address, per window. A person typing a query sends a handful. */
export const PUBLIC_SEARCH_CLIENT_LIMIT = 60;

/** Across every client, per window: the ceiling on database load from this route. */
export const PUBLIC_SEARCH_GLOBAL_LIMIT = 600;

/** Browsers and shared caches may reuse an answer this long. */
export const PUBLIC_SEARCH_CACHE_SECONDS = 60;
