-- Exercise media and catalog sync event tracking.

create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  type public.media_type not null,
  url text not null,
  thumbnail_url text,
  angle varchar(50),
  caption text,
  mime_type varchar(100),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  source text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  status public.media_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index exercise_media_one_primary_per_type
  on public.exercise_media(exercise_id, type)
  where is_primary = true and status = 'active';

create table public.exercise_change_events (
  id bigint generated always as identity primary key,
  exercise_id uuid references public.exercises(id) on delete set null,
  change_type public.catalog_change_type not null,
  changed_at timestamptz not null default now(),
  catalog_version integer not null check (catalog_version > 0),
  payload jsonb not null default '{}',
  constraint exercise_change_payload_is_object
    check (jsonb_typeof(payload) = 'object')
);
