import { AppError } from '../errors/AppError.js';
import { CATALOG_ENUM_VALUES } from '../repositories/referenceRepository.js';

const PAGE_SIZE_MAX = 100;
const SYNC_RESOURCES = ['metadata', 'exercises'];
const SYNC_ENDPOINTS = {
  metadata: '/sync/metadata',
  exercises: '/sync/exercises'
};
const EXERCISE_RECORD_CHANGE_TYPES = new Set(['created', 'updated']);
const TOMBSTONE_CHANGE_TYPES = new Set(['deleted', 'deprecated']);

export function createSyncService({ syncRepository }) {
  return {
    async getSyncMetadata() {
      return {
        ...(await syncRepository.getSyncMetadata()),
        resources: SYNC_RESOURCES,
        endpoints: SYNC_ENDPOINTS,
        enums: CATALOG_ENUM_VALUES,
        pageSizeMax: PAGE_SIZE_MAX
      };
    },

    async syncExercises(input) {
      const offset = decodeCursor(input.cursor);
      const events = await syncRepository.listExerciseChangeEvents({
        updatedSince: input.updatedSince,
        limit: input.limit + 1,
        offset
      });
      const pageEvents = events.slice(0, input.limit);
      const exerciseIds = selectExerciseIdsForFetch(
        pageEvents,
        input.includeDeprecated
      );
      const exercises = await syncRepository.getSyncExercisesByIds({
        ids: exerciseIds,
        includeDeprecated: input.includeDeprecated
      });

      return {
        exercises,
        tombstones: pageEvents
          .filter((event) => TOMBSTONE_CHANGE_TYPES.has(event.changeType))
          .map(mapTombstone),
        pagination: {
          limit: input.limit,
          nextCursor:
            events.length > input.limit
              ? encodeCursor({ offset: offset + input.limit })
              : null,
          hasMore: events.length > input.limit
        }
      };
    }
  };
}

function selectExerciseIdsForFetch(events, includeDeprecated) {
  const fetchableEvents = events.filter((event) => {
    if (EXERCISE_RECORD_CHANGE_TYPES.has(event.changeType)) {
      return true;
    }

    return includeDeprecated && event.changeType === 'deprecated';
  });

  return unique(
    fetchableEvents.map((event) => event.exerciseId).filter(Boolean)
  );
}

function mapTombstone(event) {
  return {
    exerciseId: event.exerciseId,
    changeType: event.changeType,
    changedAt: event.changedAt,
    catalogVersion: event.catalogVersion
  };
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) {
    return 0;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    );

    if (Number.isInteger(parsed.offset) && parsed.offset >= 0) {
      return parsed.offset;
    }
  } catch {
    throwInvalidCursor();
  }

  throwInvalidCursor();
}

function throwInvalidCursor() {
  throw new AppError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'cursor is invalid'
  });
}

function unique(values) {
  return [...new Set(values)];
}
