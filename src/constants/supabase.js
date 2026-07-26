export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 100;
export const RETRY_MAX_DELAY_MS = 1000;

/**
 * Only idempotent methods may be retried after a network error. GET reads
 * nothing; DELETE by filter reaches the same end state whether it runs once or
 * twice, since the second run matches zero rows. A POST or PATCH that dies
 * mid-flight may already have reached Postgres, so replaying it could insert or
 * mutate a row twice — their sole retryable case is `429`, refused before any
 * work happens.
 */
export const RETRY_SAFE_METHODS = new Set(['GET', 'DELETE']);

/** Transient by definition: the request failed for a reason that may pass. */
export const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** A `429` is refused, never applied, so replaying it cannot duplicate work. */
export const ALWAYS_RETRYABLE_STATUS_CODES = new Set([429]);
