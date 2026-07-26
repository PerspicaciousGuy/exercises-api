-- Add 'core' to the movement_pattern enum.
--
-- The original enum (migration 002) had no value for trunk-dominant work, so a
-- plank was mis-classified as 'push' — it pushes nothing. 'core' names movements
-- whose job is to resist or produce trunk motion. This is the value the
-- application and OpenAPI contract already expect; the enum type was the last
-- place still missing it.
--
-- ALTER TYPE ... ADD VALUE must run as a standalone statement: Postgres cannot
-- add an enum value and use it inside the same transaction, and older versions
-- refuse ADD VALUE inside a transaction block entirely. Apply this migration on
-- its own, not batched with other statements.
--
-- Enum values cannot be removed in Postgres, so this migration has no down.
-- IF NOT EXISTS keeps it idempotent across re-runs.

alter type public.movement_pattern add value if not exists 'core';
