import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';
import {
  SUMMARY_COLUMNS,
  mapExerciseDetail,
  mapExerciseSummary
} from './exerciseMappers.js';
import {
  buildListFilters,
  findMatchingExerciseIds,
  searchExerciseRows,
  selectExerciseDetailRowsByIds,
  selectExerciseSummaryRowsByRelation,
  selectOneExercise
} from './exerciseQueries.js';

export function createDefaultExerciseRepository() {
  const env = parseSupabaseScriptEnv(process.env);
  const client = new SupabaseRestClient(env);

  return createExerciseRepository({ client });
}

export function createLazyDefaultExerciseRepository() {
  let repository;

  function getRepository() {
    repository ??= createDefaultExerciseRepository();
    return repository;
  }

  return {
    listExercises(filters) {
      return getRepository().listExercises(filters);
    },
    searchExercises(filters) {
      return getRepository().searchExercises(filters);
    },
    getExercisesByIds(ids) {
      return getRepository().getExercisesByIds(ids);
    },
    getExerciseById(id) {
      return getRepository().getExerciseById(id);
    },
    getExerciseBySlug(slug) {
      return getRepository().getExerciseBySlug(slug);
    },
    listExerciseRelations(input) {
      return getRepository().listExerciseRelations(input);
    }
  };
}

export function createExerciseRepository({ client }) {
  return {
    async listExercises(filters) {
      const matchingExerciseIds = await findMatchingExerciseIds(
        client,
        filters
      );

      if (matchingExerciseIds?.length === 0) {
        return {
          exercises: [],
          pagination: {
            limit: filters.limit,
            offset: filters.offset
          }
        };
      }

      const rows = await client.select('exercises', {
        columns: SUMMARY_COLUMNS,
        filters: buildListFilters(filters, matchingExerciseIds)
      });

      return {
        exercises: rows.map(mapExerciseSummary),
        pagination: {
          limit: filters.limit,
          offset: filters.offset
        }
      };
    },

    async searchExercises({ query, limit, offset }) {
      const rows = await searchExerciseRows(client, { query, limit, offset });

      return {
        exercises: rows.map(mapExerciseSummary),
        pagination: { limit, offset }
      };
    },

    async getExercisesByIds(ids) {
      const rows = await selectExerciseDetailRowsByIds(client, ids);
      const exercisesById = new Map(
        rows.map((row) => [row.id, mapExerciseDetail(row)])
      );

      return ids.map((id) => exercisesById.get(id)).filter(Boolean);
    },

    async getExerciseById(id) {
      return selectOneExercise(client, { id: `eq.${id}` });
    },

    async getExerciseBySlug(slug) {
      return selectOneExercise(client, { slug: `eq.${slug}` });
    },

    async listExerciseRelations({ exerciseId, relationType }) {
      const relatedRows = await selectExerciseSummaryRowsByRelation(client, {
        exerciseId,
        relationType
      });

      return relatedRows.map(mapExerciseSummary);
    }
  };
}
