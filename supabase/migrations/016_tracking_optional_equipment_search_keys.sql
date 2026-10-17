-- Catalog v8: how an exercise is logged, optional equipment, and search keys.
-- All additive: new type, new nullable/generated columns, one new link table.

-- Which inputs a logged set takes. Nullable so existing rows stay valid; the
-- fixture validator requires it on every exercise.
create type public.tracking_type as enum (
  'weight_reps',
  'reps',
  'assisted_reps',
  'band_reps',
  'duration',
  'weight_duration',
  'distance_duration',
  'weight_distance'
);

alter table public.exercises
  add column if not exists tracking_type public.tracking_type;

-- Equipment an exercise can use but does not need: alternatives and add-ons
-- (dumbbells for a lunge, a band for a fire hydrant). exercise_equipment keeps
-- meaning "all of these are required".
create table if not exists public.exercise_optional_equipment (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_id integer not null references public.equipment(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (exercise_id, equipment_id)
);

create index if not exists exercise_optional_equipment_equipment_idx
  on public.exercise_optional_equipment(equipment_id);

alter table public.exercise_optional_equipment enable row level security;

create policy "service role can manage exercise optional equipment"
on public.exercise_optional_equipment for all
to service_role
using (true)
with check (true);

grant select, insert, update, delete on public.exercise_optional_equipment to service_role;

-- Names compared with case, spaces, hyphens and punctuation removed, matching
-- normalizeExerciseName in src/utils/slugs.js, so "pushup", "push up" and
-- "push-up" all find Push-up.
alter table public.exercises
  add column if not exists search_name text
  generated always as (regexp_replace(lower(name), '[^a-z0-9]', '', 'g')) stored;

alter table public.exercise_aliases
  add column if not exists search_alias text
  generated always as (regexp_replace(lower(alias), '[^a-z0-9]', '', 'g')) stored;
