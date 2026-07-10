-- Browser sessions for the developer dashboard.
--
-- API keys authenticate machine callers and are long-lived, non-expiring, and
-- quota-bearing. A browser needs none of that: it needs a credential that
-- expires, that the server can revoke, and that JavaScript cannot read. So
-- sessions are a separate concept rather than a reused API key.
--
-- token_hash is sha256(opaque token). The plaintext token exists only in the
-- Set-Cookie header and the client's cookie jar, never in this table.

create table public.api_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.api_users(id) on delete cascade,
  token_hash varchar(64) not null unique,
  user_agent varchar(255),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint api_sessions_expiry_after_create
    check (expires_at > created_at)
);

-- Authentication reads by hash on every dashboard request.
create index api_sessions_token_hash_idx
  on public.api_sessions(token_hash);

-- "Sign out everywhere" and expired-session cleanup both scan by user.
create index api_sessions_user_id_idx
  on public.api_sessions(user_id);

create index api_sessions_expires_at_idx
  on public.api_sessions(expires_at);

alter table public.api_sessions enable row level security;

create policy "service role can manage api sessions"
on public.api_sessions for all
to service_role
using (true)
with check (true);

grant select, insert, update, delete
  on public.api_sessions to service_role;
