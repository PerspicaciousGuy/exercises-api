import { AppError } from '../errors/AppError.js';
import { CATALOG_ENUM_VALUES } from '../repositories/referenceRepository.js';

const PAGE_SIZE_MAX = 100;
const SYNC_RESOURCES = ['metadata', 'exercises'];
const SYNC_ENDPOINTS = {
  metadata: '/sync/metadata',
  exercises: '/sync/exercises'
};
const EXERCISE_RECORD_CHANGE_TYPES = new Set(['created', 'updated']);

// A tombstone means "this record is gone from your local copy". When the caller
// asks for deprecated records, they are not gone: they are returned with
// `status: 'deprecated'`, which is the caller's signal. Emitting a tombstone as
// well would invite clients to delete the row they just asked to keep.
const TOMBSTONE_CHANGE_TYPES = new Set(['deleted', 'deprecated']);
const DELETED_CHANGE_TYPES = new Set(['deleted']);

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
      const { offset, watermark } = decodeCursor(input.cursor);

      // Read the watermark before the events, never after. A change written
      // mid-page carries a later timestamp and is redelivered next sync;
      // reading afterwards would advance past it and lose it permanently.
      const latestChangeAt =
        watermark === undefined
          ? await syncRepository.getLatestChangeAt()
          : watermark;

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

      const hasMore = events.length > input.limit;
      const tombstoneTypes = input.includeDeprecated
        ? DELETED_CHANGE_TYPES
        : TOMBSTONE_CHANGE_TYPES;

      return {
        exercises,
        tombstones: pageEvents
          .filter((event) => tombstoneTypes.has(event.changeType))
          .map(mapTombstone),
        latestChangeAt,
        pagination: {
          limit: input.limit,
          nextCursor: hasMore
            ? encodeCursor({
                offset: offset + input.limit,
                watermark: latestChangeAt
              })
            : null,
          hasMore
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
    return { offset: 0, watermark: undefined };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    );

    if (Number.isInteger(parsed.offset) && parsed.offset >= 0) {
      // A cursor issued before the watermark was carried has no `watermark`
      // key. Absent means "read it fresh"; an explicit null means "the catalog
      // had no change events when this sync began".
      return {
        offset: parsed.offset,
        watermark: Object.hasOwn(parsed, 'watermark')
          ? parsed.watermark
          : undefined
      };
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
