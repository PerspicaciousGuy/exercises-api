import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';
import { DETAIL_COLUMNS, mapExerciseDetail } from './exerciseMappers.js';

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
    }
  };
}

export function createSyncRepository({ client }) {
  return {
    async getSyncMetadata() {
      const [catalogVersionRows, exerciseUpdateRows, changeEventRows] =
        await Promise.all([
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
          client.select('exercise_change_events', {
            columns: 'changed_at,catalog_version',
            filters: {
              order: 'changed_at.desc',
              limit: '1'
            }
          })
        ]);

      return {
        catalogVersion:
          changeEventRows[0]?.catalog_version ??
          catalogVersionRows[0]?.catalog_version ??
          1,
        latestExerciseUpdatedAt: exerciseUpdateRows[0]?.updated_at ?? null,
        latestChangeAt: changeEventRows[0]?.changed_at ?? null
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
