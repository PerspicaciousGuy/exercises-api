const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when a value is a well-formed UUID. Exercise ids are UUIDs; a malformed
 * one must never reach a PostgREST filter on a `uuid` column, where Postgres
 * rejects the whole query with a 400 rather than returning no rows.
 */
export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
