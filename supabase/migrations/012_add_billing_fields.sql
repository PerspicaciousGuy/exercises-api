-- Provider-neutral billing fields on API accounts, plus a webhook event log
-- used for delivery idempotency.
--
-- api_users.stripe_customer_id (migration 007) predates the provider-neutral
-- decision and is intentionally left in place. Dropping it is destructive and
-- requires explicit approval.

create type public.billing_provider as enum ('lemon_squeezy');

create type public.billing_subscription_status as enum (
  'on_trial',
  'active',
  'paused',
  'past_due',
  'unpaid',
  'cancelled',
  'expired'
);

alter table public.api_users
  add column billing_provider public.billing_provider,
  add column billing_customer_id varchar(255),
  add column billing_subscription_id varchar(255),
  add column subscription_status public.billing_subscription_status,
  add column subscription_renews_at timestamptz,
  add column subscription_ends_at timestamptz;

create unique index api_users_billing_subscription_idx
  on public.api_users(billing_provider, billing_subscription_id)
  where billing_subscription_id is not null;

create index api_users_billing_customer_idx
  on public.api_users(billing_provider, billing_customer_id)
  where billing_customer_id is not null;

-- event_key is sha256(raw request body). Lemon Squeezy sends no unique event
-- id and no timestamp header, so a byte-identical redelivery is the only
-- reliable duplicate signal.
create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.billing_provider not null,
  event_name varchar(100) not null,
  event_key varchar(64) not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint billing_webhook_events_provider_key_unique
    unique (provider, event_key)
);

create index billing_webhook_events_received_at_idx
  on public.billing_webhook_events(received_at);

create index billing_webhook_events_event_name_idx
  on public.billing_webhook_events(event_name);

alter table public.billing_webhook_events enable row level security;

create policy "service role can manage billing webhook events"
on public.billing_webhook_events for all
to service_role
using (true)
with check (true);

grant select, insert, update, delete
  on public.billing_webhook_events to service_role;
