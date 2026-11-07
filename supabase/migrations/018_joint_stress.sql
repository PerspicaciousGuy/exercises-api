-- Catalog v11: how hard each exercise loads each joint region, and gentler
-- swaps for the regions it loads hardest (Frevo app "go easy on" feature).
-- joint_stress is {region slug: none|low|moderate|high} for every region;
-- gentler_swaps is {region slug: [{id, slug}]} for the regions rated high.
-- Nullable so existing rows stay valid until the v11 seed fills every record.

alter table public.exercises
  add column if not exists joint_stress jsonb,
  add column if not exists gentler_swaps jsonb;

alter table public.exercises
  drop constraint if exists exercises_joint_stress_object,
  drop constraint if exists exercises_gentler_swaps_object;

alter table public.exercises
  add constraint exercises_joint_stress_object
  check (joint_stress is null or jsonb_typeof(joint_stress) = 'object'),
  add constraint exercises_gentler_swaps_object
  check (gentler_swaps is null or jsonb_typeof(gentler_swaps) = 'object');
