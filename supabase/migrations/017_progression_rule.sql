-- Catalog v9: per-exercise progression facts for the Frevo app (model, load
-- steps in kg and lb, duration/distance steps, stall and reset). Shaped like
-- programming: a jsonb object whose keys the fixture validator checks.
-- Nullable so existing rows stay valid until the v9 seed fills every record.

alter table public.exercises
  add column if not exists progression_rule jsonb;

alter table public.exercises
  drop constraint if exists exercises_progression_rule_object;

alter table public.exercises
  add constraint exercises_progression_rule_object
  check (progression_rule is null or jsonb_typeof(progression_rule) = 'object');
