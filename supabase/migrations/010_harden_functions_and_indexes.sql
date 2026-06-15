-- Advisor-driven hardening after applying the initial hosted schema.

alter function public.set_updated_at()
set search_path = pg_catalog, public;

alter function public.exercise_search_document(text, text, text[])
set search_path = pg_catalog, public;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from anon';
    execute 'revoke execute on function public.rls_auto_enable() from authenticated';
  end if;
end
$$;

create index muscles_parent_muscle_idx
  on public.muscles(parent_muscle_id);

create index exercise_primary_muscles_muscle_idx
  on public.exercise_primary_muscles(muscle_id);

create index exercise_secondary_muscles_muscle_idx
  on public.exercise_secondary_muscles(muscle_id);

create index exercise_stabilizer_muscles_muscle_idx
  on public.exercise_stabilizer_muscles(muscle_id);

create index exercise_equipment_equipment_idx
  on public.exercise_equipment(equipment_id);

create index exercise_variations_variation_idx
  on public.exercise_variations(variation_id);

create index exercise_progressions_progression_idx
  on public.exercise_progressions(progression_id);

create index exercise_regressions_regression_idx
  on public.exercise_regressions(regression_id);
