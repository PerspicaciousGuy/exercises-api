-- Explicit grants and RLS policies for current Supabase Data API defaults.
--
-- The Express API is the primary public surface. Tables are still granted to
-- service_role and protected with RLS as defense in depth. Do not expose anon
-- or authenticated direct table access until a Data API use case is approved.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.muscles enable row level security;
alter table public.equipment enable row level security;
alter table public.categories enable row level security;
alter table public.exercise_flags enable row level security;
alter table public.joint_regions enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_aliases enable row level security;
alter table public.exercise_primary_muscles enable row level security;
alter table public.exercise_secondary_muscles enable row level security;
alter table public.exercise_stabilizer_muscles enable row level security;
alter table public.exercise_equipment enable row level security;
alter table public.exercise_variations enable row level security;
alter table public.exercise_progressions enable row level security;
alter table public.exercise_regressions enable row level security;
alter table public.exercise_media enable row level security;
alter table public.exercise_change_events enable row level security;
alter table public.api_users enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_usage_daily enable row level security;
alter table public.api_usage_log enable row level security;

create policy "service role can manage muscles"
on public.muscles for all
to service_role
using (true)
with check (true);

create policy "service role can manage equipment"
on public.equipment for all
to service_role
using (true)
with check (true);

create policy "service role can manage categories"
on public.categories for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise flags"
on public.exercise_flags for all
to service_role
using (true)
with check (true);

create policy "service role can manage joint regions"
on public.joint_regions for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercises"
on public.exercises for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise aliases"
on public.exercise_aliases for all
to service_role
using (true)
with check (true);

create policy "service role can manage primary muscles"
on public.exercise_primary_muscles for all
to service_role
using (true)
with check (true);

create policy "service role can manage secondary muscles"
on public.exercise_secondary_muscles for all
to service_role
using (true)
with check (true);

create policy "service role can manage stabilizer muscles"
on public.exercise_stabilizer_muscles for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise equipment"
on public.exercise_equipment for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise variations"
on public.exercise_variations for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise progressions"
on public.exercise_progressions for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise regressions"
on public.exercise_regressions for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise media"
on public.exercise_media for all
to service_role
using (true)
with check (true);

create policy "service role can manage exercise change events"
on public.exercise_change_events for all
to service_role
using (true)
with check (true);

create policy "service role can manage api users"
on public.api_users for all
to service_role
using (true)
with check (true);

create policy "service role can manage api keys"
on public.api_keys for all
to service_role
using (true)
with check (true);

create policy "service role can manage daily usage"
on public.api_usage_daily for all
to service_role
using (true)
with check (true);

create policy "service role can manage usage logs"
on public.api_usage_log for all
to service_role
using (true)
with check (true);
