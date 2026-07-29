import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';
import { isUuid } from '../utils/ids.js';
import {
  SUMMARY_COLUMNS,
  mapExerciseDetail,
  mapExerciseSummary
} from './exerciseMappers.js';
import {
  buildListFilters,
  findMatchingExerciseIds,
  searchExerciseRows,
  selectAllProgressionEdges,
  selectEquipmentSlugsByExerciseIds,
  selectExerciseDetailRowsByIds,
  selectExerciseSummaryRowsByIds,
  selectExerciseSummaryRowsByRelation,
  selectMuscleSlugsByExerciseIds,
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
    },
    getMuscleSlugsByExerciseIds(ids) {
      return getRepository().getMuscleSlugsByExerciseIds(ids);
    },
    getEquipmentSlugsByExerciseIds(ids) {
      return getRepository().getEquipmentSlugsByExerciseIds(ids);
    },
    getProgressionEdges() {
      return getRepository().getProgressionEdges();
    },
    getExerciseSummariesByIds(ids) {
      return getRepository().getExerciseSummariesByIds(ids);
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
      // Drop malformed ids before the query: a non-uuid in an `in.(...)` filter
      // on a uuid column makes PostgREST reject the whole request.
      const validIds = ids.filter(isUuid);
      const rows = await selectExerciseDetailRowsByIds(client, validIds);
      const exercisesById = new Map(
        rows.map((row) => [row.id, mapExerciseDetail(row)])
      );

      return validIds.map((id) => exercisesById.get(id)).filter(Boolean);
    },

    async getExerciseById(id) {
      // A malformed id cannot match any row; return null so callers 404 it
      // rather than sending it to PostgREST and 500-ing on a uuid cast error.
      if (!isUuid(id)) {
        return null;
      }

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
    },

    getMuscleSlugsByExerciseIds(ids) {
      return selectMuscleSlugsByExerciseIds(client, ids);
    },

    getEquipmentSlugsByExerciseIds(ids) {
      return selectEquipmentSlugsByExerciseIds(client, ids);
    },

    getProgressionEdges() {
      return selectAllProgressionEdges(client);
    },

    async getExerciseSummariesByIds(ids) {
      const rows = await selectExerciseSummaryRowsByIds(client, ids);
      return rows.map(mapExerciseSummary);
    }
  };
}
