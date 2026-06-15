-- Core public catalog exercise table.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  slug varchar(220) not null unique,
  status public.exercise_status not null default 'draft',

  description text not null,
  instructions text[] not null default '{}',
  tips text[] not null default '{}',
  breathing_cues text,
  contraindications text[] not null default '{}',

  category_id integer not null references public.categories(id),
  difficulty public.difficulty_level not null,
  movement_pattern public.movement_pattern not null,
  force_type public.force_type,
  mechanics public.mechanics_type not null,
  position public.position_type,
  plane_of_motion public.plane_of_motion_type,
  joint_regions text[] not null default '{}',
  laterality public.laterality_type,
  load_type public.load_type,
  skill_type public.skill_type,

  flags text[] not null default '{}',
  programming jsonb not null default '{}',
  tags text[] not null default '{}',

  is_premium boolean not null default false,
  catalog_version integer not null default 1 check (catalog_version > 0),
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exercises_active_requires_not_deleted
    check (status <> 'active' or deleted_at is null),
  constraint exercises_deleted_requires_inactive
    check (deleted_at is null or status <> 'active'),
  constraint exercises_programming_is_object
    check (jsonb_typeof(programming) = 'object')
);

create table public.exercise_aliases (
  id integer generated always as identity primary key,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alias varchar(200) not null,
  created_at timestamptz not null default now(),
  unique (exercise_id, alias)
);
