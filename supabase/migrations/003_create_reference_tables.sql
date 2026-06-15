-- Reference tables used by filters, metadata endpoints, and import validation.

create table public.muscles (
  id integer generated always as identity primary key,
  name varchar(100) not null unique,
  slug varchar(120) not null unique,
  region varchar(100) not null,
  muscle_group varchar(100) not null,
  parent_muscle_id integer references public.muscles(id) on delete set null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment (
  id integer generated always as identity primary key,
  name varchar(100) not null unique,
  slug varchar(120) not null unique,
  equipment_group varchar(100),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id integer generated always as identity primary key,
  name varchar(100) not null unique,
  slug varchar(120) not null unique,
  category public.exercise_category not null unique,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercise_flags (
  id integer generated always as identity primary key,
  name varchar(100) not null unique,
  slug varchar(120) not null unique,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.joint_regions (
  id integer generated always as identity primary key,
  name varchar(100) not null unique,
  slug varchar(120) not null unique,
  region_group varchar(100),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
