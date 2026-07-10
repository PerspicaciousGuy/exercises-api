import {
  ALWAYS_RETRYABLE_STATUS_CODES,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_MAX_DELAY_MS,
  RETRY_SAFE_METHODS,
  RETRYABLE_STATUS_CODES
} from '../constants/supabase.js';
import { logger } from '../logging/logger.js';

export class SupabaseRestClient {
  constructor({
    supabaseUrl,
    serviceRoleKey,
    fetchImpl = fetch,
    maxAttempts = RETRY_MAX_ATTEMPTS,
    sleep = defaultSleep
  }) {
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
    this.fetchImpl = fetchImpl;
    this.maxAttempts = maxAttempts;
    this.sleep = sleep;
  }

  async select(table, { columns = '*', filters = {} } = {}) {
    const url = this.buildTableUrl(table, {
      select: columns,
      ...filters
    });

    return this.request(url, { method: 'GET' });
  }

  /**
   * `ignoreDuplicates` returns an empty array when the row already exists
   * instead of merging it, which lets callers detect a conflict without a
   * read-then-write race.
   */
  async upsert(
    table,
    rows,
    { onConflict, select = '*', ignoreDuplicates = false } = {}
  ) {
    if (rows.length === 0) {
      return [];
    }

    const url = this.buildTableUrl(table, {
      on_conflict: onConflict,
      select
    });

    const resolution = ignoreDuplicates
      ? 'ignore-duplicates'
      : 'merge-duplicates';

    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(rows),
      prefer: `resolution=${resolution},return=representation`
    });
  }

  async insert(table, rows, { select = '*' } = {}) {
    if (rows.length === 0) {
      return [];
    }

    const url = this.buildTableUrl(table, { select });

    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(rows),
      prefer: 'return=representation'
    });
  }

  async update(table, values, { filters = {}, select = '*' } = {}) {
    const url = this.buildTableUrl(table, {
      ...filters,
      select
    });

    return this.request(url, {
      method: 'PATCH',
      body: JSON.stringify(values),
      prefer: 'return=representation'
    });
  }

  /**
   * Retries transient failures with exponential backoff and jitter.
   *
   * What counts as retryable depends on the method, not only on the failure.
   * A network error on a GET is safe to replay. A network error on a POST is
   * not: the request may have reached Postgres and committed before the socket
   * died, so replaying it could insert the row twice.
   */
  async request(url, { method, body, prefer }) {
    for (let attempt = 1; ; attempt += 1) {
      const isLastAttempt = attempt >= this.maxAttempts;

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: this.buildHeaders(prefer),
          body
        });

        if (response.ok) {
          return response.json();
        }

        const error = await buildRequestError(response);

        if (isLastAttempt || !isRetryableStatus(method, response.status)) {
          throw error;
        }

        await this.backOff(attempt, method, url, response.status);
      } catch (error) {
        if (error.status !== undefined) {
          throw error;
        }

        // No status: fetch itself failed — DNS, TLS, connection reset.
        if (isLastAttempt || !RETRY_SAFE_METHODS.has(method)) {
          throw error;
        }

        await this.backOff(attempt, method, url);
      }
    }
  }

  async backOff(attempt, method, url, status) {
    const delayMs = backOffDelayMs(attempt);

    logger.warn(
      { method, url: redactUrl(url), status, attempt, delayMs },
      'retrying supabase request'
    );

    await this.sleep(delayMs);
  }

  buildHeaders(prefer) {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    };
  }

  buildTableUrl(table, query) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, value);
      }
    }

    return `${this.supabaseUrl}/rest/v1/${table}?${params.toString()}`;
  }
}

function isRetryableStatus(method, status) {
  if (ALWAYS_RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }

  return RETRY_SAFE_METHODS.has(method) && RETRYABLE_STATUS_CODES.has(status);
}

/** Exponential, capped, with full jitter so retries do not synchronise. */
function backOffDelayMs(attempt) {
  const ceiling = Math.min(
    RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    RETRY_MAX_DELAY_MS
  );

  return Math.round(Math.random() * ceiling);
}

function defaultSleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * PostgREST filters travel in the query string, so a URL can carry an email
 * address or a session token hash. Only the table path is safe to log.
 */
function redactUrl(url) {
  const queryIndex = url.indexOf('?');

  return queryIndex === -1 ? url : `${url.slice(0, queryIndex)}?[redacted]`;
}

async function buildRequestError(response) {
  const payload = await readErrorPayload(response);
  const message = payload?.message ?? payload?.error ?? JSON.stringify(payload);
  const error = new Error(
    `Supabase REST request failed with status ${response.status}: ${message}`
  );

  error.status = response.status;

  return error;
}

async function readErrorPayload(response) {
  try {
    return await response.json();
  } catch {
    return response.text();
  }
}
