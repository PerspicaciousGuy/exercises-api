import { ExerciseDBError } from './errors.js';

const DEFAULT_BASE_URL = 'https://api.harshitbishnoi.dev';

/**
 * Creates an ExerciseDB API client. Every request carries the API key; the
 * `{ success, data }` envelope is unwrapped so methods return `data` directly,
 * and non-2xx responses throw an {@link ExerciseDBError} carrying the API's
 * RFC 9457 problem details.
 *
 * @param {object} options
 * @param {string} options.apiKey - Your ExerciseDB API key.
 * @param {string} [options.baseUrl] - Override the API base URL.
 * @param {typeof fetch} [options.fetch] - Custom fetch (for testing or older runtimes).
 */
export function createClient(options) {
  const {
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    fetch: fetchImpl
  } = options ?? {};
  if (!apiKey) {
    throw new Error('createClient requires an apiKey');
  }

  const doFetch = fetchImpl ?? globalThis.fetch;
  if (!doFetch) {
    throw new Error('No fetch implementation available; pass options.fetch');
  }

  const root = baseUrl.replace(/\/$/, '');

  /**
   * @param {string} path
   * @param {{ query?: Record<string, unknown>, method?: string, body?: unknown }} [options]
   * @returns {Promise<any>}
   */
  async function request(path, { query, method = 'GET', body } = {}) {
    const url = root + path + buildQuery(query);
    /** @type {Record<string, string>} */
    const headers = { 'x-api-key': apiKey };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const response = await doFetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw toError(response.status, payload);
    }

    // Unwrap the { success, data, pagination? } envelope.
    return payload;
  }

  const exercises = {
    /**
     * List exercises with optional filters. Returns one page.
     * @param {import('./types.js').ListExercisesParams} [params]
     * @returns {Promise<import('./types.js').ExercisePage>}
     */
    async list(params = {}) {
      const payload = await request('/exercises', {
        query: toListQuery(params)
      });
      return { exercises: payload.data, pagination: payload.pagination };
    },

    /**
     * Iterate every exercise matching the filters, transparently paging.
     * @param {import('./types.js').ListExercisesParams} [params]
     * @returns {AsyncGenerator<import('./types.js').ExerciseSummary>}
     */
    async *listAll(params = {}) {
      const limit = params.limit ?? 100;
      let offset = params.offset ?? 0;
      for (;;) {
        const { exercises: page } = await this.list({
          ...params,
          limit,
          offset
        });
        for (const exercise of page) {
          yield exercise;
        }
        if (page.length < limit) {
          return;
        }
        offset += limit;
      }
    },

    /**
     * @param {string} query
     * @param {{ limit?: number, offset?: number }} [params]
     * @returns {Promise<import('./types.js').ExercisePage>}
     */
    async search(query, params = {}) {
      const payload = await request('/exercises/search', {
        query: { q: query, limit: params.limit, offset: params.offset }
      });
      return { exercises: payload.data, pagination: payload.pagination };
    },

    /**
     * @param {string} id
     * @returns {Promise<import('./types.js').Exercise>}
     */
    async get(id) {
      return (await request(`/exercises/${encodeURIComponent(id)}`)).data;
    },

    /**
     * @param {string} slug
     * @returns {Promise<import('./types.js').Exercise>}
     */
    async getBySlug(slug) {
      return (await request(`/exercises/slug/${encodeURIComponent(slug)}`))
        .data;
    },

    /**
     * @param {string[]} ids
     * @returns {Promise<import('./types.js').Exercise[]>}
     */
    async bulk(ids) {
      return (
        await request('/exercises/bulk', { query: { ids: ids.join(',') } })
      ).data;
    },

    /**
     * @param {string} id
     * @returns {Promise<import('./types.js').RelatedExercises>}
     */
    async related(id) {
      return (await request(`/exercises/${encodeURIComponent(id)}/related`))
        .data;
    },

    /**
     * @param {string} id
     * @returns {Promise<import('./types.js').ExerciseSummary[]>}
     */
    async variations(id) {
      return (await request(`/exercises/${encodeURIComponent(id)}/variations`))
        .data;
    },

    /**
     * @param {string} id
     * @returns {Promise<import('./types.js').ExerciseSummary[]>}
     */
    async progressions(id) {
      return (
        await request(`/exercises/${encodeURIComponent(id)}/progressions`)
      ).data;
    },

    /**
     * @param {string} id
     * @returns {Promise<import('./types.js').ExerciseSummary[]>}
     */
    async regressions(id) {
      return (await request(`/exercises/${encodeURIComponent(id)}/regressions`))
        .data;
    },

    /**
     * Equipment-aware substitutes: the exercise's variations, optionally kept
     * only if the caller has all their equipment.
     * @param {string} id
     * @param {{ equipment?: string[] }} [options]
     * @returns {Promise<import('./types.js').ExerciseSummary[]>}
     */
    async substitutes(id, options = {}) {
      const query = options.equipment?.length
        ? { equipment: options.equipment.join(',') }
        : undefined;
      return (
        await request(`/exercises/${encodeURIComponent(id)}/substitutes`, {
          query
        })
      ).data;
    },

    /**
     * Shortest progression path up to a target exercise, or null if none.
     * @param {string} id
     * @param {string} toId
     * @returns {Promise<import('./types.js').ExerciseSummary[] | null>}
     */
    async path(id, toId) {
      return (
        await request(`/exercises/${encodeURIComponent(id)}/path`, {
          query: { to: toId }
        })
      ).data;
    }
  };

  const analyze = {
    /**
     * Stateless coverage analysis of a set of exercises.
     * @param {string[]} exerciseIds
     * @returns {Promise<import('./types.js').Coverage>}
     */
    async coverage(exerciseIds) {
      return (
        await request('/analyze/coverage', {
          method: 'POST',
          body: { exerciseIds }
        })
      ).data;
    }
  };

  const reference = {
    /** @returns {Promise<import('./types.js').CatalogMetadata>} */
    async metadata() {
      return (await request('/metadata')).data;
    },
    /** @returns {Promise<import('./types.js').Muscle[]>} */
    async muscles() {
      return (await request('/muscles')).data;
    },
    /** @returns {Promise<import('./types.js').Equipment[]>} */
    async equipment() {
      return (await request('/equipment')).data;
    },
    /** @returns {Promise<import('./types.js').Category[]>} */
    async categories() {
      return (await request('/categories')).data;
    },
    /** @returns {Promise<{ id: number, slug: string, name: string }[]>} */
    async exerciseFlags() {
      return (await request('/exercise-flags')).data;
    },
    /** @returns {Promise<{ id: number, slug: string, name: string }[]>} */
    async jointRegions() {
      return (await request('/joint-regions')).data;
    }
  };

  return { exercises, analyze, reference };
}

/** @param {import('./types.js').ListExercisesParams} params */
function toListQuery(params) {
  return {
    limit: params.limit,
    offset: params.offset,
    category: params.category,
    difficulty: params.difficulty,
    equipment: params.equipment,
    muscle: params.muscle,
    search: params.search,
    updated_since: params.updatedSince,
    include_deprecated: params.includeDeprecated,
    fields: params.fields
  };
}

/** @param {Record<string, unknown> | undefined} query */
function buildQuery(query) {
  if (!query) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const string = search.toString();
  return string ? `?${string}` : '';
}

/**
 * @param {number} status
 * @param {any} payload
 */
function toError(status, payload) {
  const details = payload && typeof payload === 'object' ? payload : {};
  return new ExerciseDBError({
    status,
    message:
      details.detail || details.title || `Request failed with status ${status}`,
    code: details.code,
    type: details.type,
    requestId: details.requestId
  });
}
