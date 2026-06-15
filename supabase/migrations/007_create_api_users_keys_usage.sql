-- API consumer accounts, API keys, and usage tracking.

create table public.api_users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name varchar(255),
  password_hash varchar(255) not null,
  tier public.subscription_tier not null default 'free',
  stripe_customer_id varchar(255),
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.api_users(id) on delete cascade,
  key_hash varchar(255) not null unique,
  label varchar(100),
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint api_keys_expiry_after_create
    check (expires_at is null or expires_at > created_at)
);

create table public.api_usage_daily (
  user_id uuid not null references public.api_users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table public.api_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.api_users(id) on delete set null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  endpoint varchar(255) not null,
  method varchar(10) not null,
  status_code integer not null check (status_code between 100 and 599),
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  created_at timestamptz not null default now()
);
