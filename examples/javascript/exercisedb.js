/**
 * ExerciseDB API client — JavaScript (Node 18+, or any modern browser).
 *
 * Run: EXERCISEDB_API_KEY=exdb_… node examples/javascript/exercisedb.js
 */

const BASE_URL =
  process.env.EXERCISEDB_BASE_URL ?? 'https://api.harshitbishnoi.dev';
const API_KEY = process.env.EXERCISEDB_API_KEY;
const PAGE_SIZE = 100;

/** Errors are RFC 9457 problem+json. `code` is stable; `detail` is prose. */
class ApiError extends Error {
  constructor(problem) {
    super(problem.detail ?? 'Request failed');
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
  }
}

async function get(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-api-key': API_KEY }
  });
  const body = await response.json();

  if (!response.ok) {
    throw new ApiError(body);
  }

  return body;
}

async function listExercises({ limit = 5 } = {}) {
  const { data } = await get(`/exercises?limit=${limit}`);
  return data;
}

/**
 * Walks every page of a sync and applies it to a local store.
 *
 * `limit` bounds change events, not exercises: an exercise created and then
 * updated inside the window is one record from two events, and deleted records
 * are dropped entirely. So page on `hasMore`, never on `exercises.length`.
 */
async function sync(store) {
  const since = store.getWatermark();
  let cursor = null;
  let watermark = since;
  const pages = [];

  do {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (since) params.set('updated_since', since);
    if (cursor) params.set('cursor', cursor);

    const page = await get(`/sync/exercises?${params}`);
    pages.push(page.data);

    // Identical on every page of one sync: the server reads it before the
    // first page, so a record written mid-sync arrives on the next run
    // instead of being skipped.
    watermark = page.data.latestChangeAt ?? watermark;
    cursor = page.pagination.nextCursor;
  } while (cursor);

  // Records and watermark must commit together. A watermark that lands without
  // its records means the next sync starts after data you never wrote.
  store.transaction(() => {
    for (const { exercises, tombstones } of pages) {
      for (const exercise of exercises) {
        store.upsert(exercise);
      }

      for (const tombstone of tombstones) {
        if (tombstone.changeType === 'deleted') {
          store.remove(tombstone.exerciseId);
        } else {
          store.markDeprecated(tombstone.exerciseId);
        }
      }
    }

    store.setWatermark(watermark);
  });
}

async function main() {
  if (!API_KEY) {
    throw new Error('Set EXERCISEDB_API_KEY');
  }

  try {
    for (const exercise of await listExercises({ limit: 3 })) {
      console.info(`${exercise.slug} — ${exercise.name}`);
    }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'RATE_LIMIT_EXCEEDED') {
      console.error('Daily quota exhausted. Retry after midnight UTC.');
      return;
    }

    throw error;
  }

  await sync(createMemoryStore());
}

/** Stand-in for your real database. */
function createMemoryStore() {
  const exercises = new Map();
  let watermark = null;

  return {
    getWatermark: () => watermark,
    setWatermark: (value) => {
      watermark = value;
    },
    upsert: (exercise) => exercises.set(exercise.id, exercise),
    remove: (id) => exercises.delete(id),
    markDeprecated: (id) => {
      const exercise = exercises.get(id);
      if (exercise) {
        exercise.status = 'deprecated';
      }
    },
    transaction: (work) => work()
  };
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
