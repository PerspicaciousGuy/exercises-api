import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';
import { DETAIL_COLUMNS, mapExerciseDetail } from './exerciseMappers.js';

const EXPORT_PAGE_SIZE = 100;

export function createDefaultSyncRepository() {
  const env = parseSupabaseScriptEnv(process.env);
  const client = new SupabaseRestClient(env);

  return createSyncRepository({ client });
}

export function createLazyDefaultSyncRepository() {
  let repository;

  function getRepository() {
    repository ??= createDefaultSyncRepository();
    return repository;
  }

  return {
    getSyncMetadata() {
      return getRepository().getSyncMetadata();
    },
    getLatestChangeAt() {
      return getRepository().getLatestChangeAt();
    },
    listExerciseChangeEvents(filters) {
      return getRepository().listExerciseChangeEvents(filters);
    },
    getSyncExercisesByIds(input) {
      return getRepository().getSyncExercisesByIds(input);
    },
    listActiveExercises() {
      return getRepository().listActiveExercises();
    }
  };
}

export function createSyncRepository({ client }) {
  return {
    async getSyncMetadata() {
      const [
        catalogVersionRows,
        exerciseUpdateRows,
        changeEventRows,
        latestChangeAt
      ] = await Promise.all([
        client.select('exercises', {
          columns: 'catalog_version',
          filters: {
            order: 'catalog_version.desc',
            limit: '1'
          }
        }),
        client.select('exercises', {
          columns: 'updated_at',
          filters: {
            order: 'updated_at.desc',
            limit: '1'
          }
        }),
        // Highest version, not the newest event's: one seed run writes many
        // events in a single statement, all with the same changed_at.
        client.select('exercise_change_events', {
          columns: 'catalog_version',
          filters: {
            order: 'catalog_version.desc',
            limit: '1'
          }
        }),
        this.getLatestChangeAt()
      ]);

      return {
        catalogVersion:
          changeEventRows[0]?.catalog_version ??
          catalogVersionRows[0]?.catalog_version ??
          1,
        latestExerciseUpdatedAt: exerciseUpdateRows[0]?.updated_at ?? null,
        latestChangeAt
      };
    },

    async getLatestChangeAt() {
      const rows = await client.select('exercise_change_events', {
        columns: 'changed_at',
        filters: {
          order: 'changed_at.desc',
          limit: '1'
        }
      });

      return rows[0]?.changed_at ?? null;
    },

    async listExerciseChangeEvents({ updatedSince, limit, offset }) {
      const rows = await client.select('exercise_change_events', {
        columns:
          'id,exercise_id,change_type,changed_at,catalog_version,payload',
        filters: {
          ...(updatedSince ? { changed_at: `gt.${updatedSince}` } : {}),
          order: 'id.asc',
          limit: String(limit),
          offset: String(offset)
        }
      });

      return rows.map(mapExerciseChangeEvent);
    },

    async getSyncExercisesByIds({ ids, includeDeprecated }) {
      if (ids.length === 0) {
        return [];
      }

      const rows = await client.select('exercises', {
        columns: DETAIL_COLUMNS,
        filters: {
          id: `in.(${ids.join(',')})`,
          status: includeDeprecated ? 'in.(active,deprecated)' : 'eq.active',
          deleted_at: 'is.null'
        }
      });
      const exercisesById = new Map(
        rows.map((row) => [row.id, mapExerciseDetail(row)])
      );

      return ids.map((id) => exercisesById.get(id)).filter(Boolean);
    },

    // Every active exercise as a full record, paged so the result never hits
    // PostgREST's max-rows cap.
    // shortcut: offset paging can skip a row if an exercise is deleted while
    // the export runs; export when no seed is running, or page by keyset.
    async listActiveExercises() {
      const exercises = [];

      for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
        const rows = await client.select('exercises', {
          columns: DETAIL_COLUMNS,
          filters: {
            status: 'eq.active',
            deleted_at: 'is.null',
            // The bundle ships inside public apps, so premium records stay out.
            is_premium: 'is.false',
            order: 'slug.asc',
            limit: String(EXPORT_PAGE_SIZE),
            offset: String(offset)
          }
        });

        exercises.push(...rows.map(mapExerciseDetail));

        if (rows.length < EXPORT_PAGE_SIZE) {
          return exercises;
        }
      }
    }
  };
}

function mapExerciseChangeEvent(row) {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    changeType: row.change_type,
    changedAt: row.changed_at,
    catalogVersion: row.catalog_version,
    payload: row.payload
  };
}
