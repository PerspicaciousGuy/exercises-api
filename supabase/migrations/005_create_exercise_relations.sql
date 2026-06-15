-- Exercise lookup and self-referencing relation tables.

create table public.exercise_primary_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id integer not null references public.muscles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (exercise_id, muscle_id)
);

create table public.exercise_secondary_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id integer not null references public.muscles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (exercise_id, muscle_id)
);

create table public.exercise_stabilizer_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id integer not null references public.muscles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (exercise_id, muscle_id)
);

create table public.exercise_equipment (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_id integer not null references public.equipment(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (exercise_id, equipment_id)
);

create table public.exercise_variations (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  variation_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, variation_id),
  check (exercise_id <> variation_id)
);

create table public.exercise_progressions (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  progression_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, progression_id),
  check (exercise_id <> progression_id)
);

create table public.exercise_regressions (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  regression_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, regression_id),
  check (exercise_id <> regression_id)
);
