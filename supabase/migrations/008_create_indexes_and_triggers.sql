-- Indexes, full-text search, and timestamp triggers.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.exercise_search_document(
  exercise_name text,
  exercise_description text,
  exercise_tags text[]
)
returns tsvector
language sql
immutable
as $$
  select
    setweight(to_tsvector('english', coalesce(exercise_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(exercise_description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(exercise_tags, '{}'), ' ')), 'C');
$$;

create trigger muscles_updated_at
  before update on public.muscles
  for each row execute function public.set_updated_at();

create trigger equipment_updated_at
  before update on public.equipment
  for each row execute function public.set_updated_at();

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger exercise_flags_updated_at
  before update on public.exercise_flags
  for each row execute function public.set_updated_at();

create trigger joint_regions_updated_at
  before update on public.joint_regions
  for each row execute function public.set_updated_at();

create trigger exercises_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

create trigger exercise_media_updated_at
  before update on public.exercise_media
  for each row execute function public.set_updated_at();

create trigger api_users_updated_at
  before update on public.api_users
  for each row execute function public.set_updated_at();

create trigger api_usage_daily_updated_at
  before update on public.api_usage_daily
  for each row execute function public.set_updated_at();

create index muscles_slug_idx on public.muscles(slug);
create index muscles_region_idx on public.muscles(region);
create index muscles_group_idx on public.muscles(muscle_group);

create index equipment_slug_idx on public.equipment(slug);
create index categories_slug_idx on public.categories(slug);
create index exercise_flags_slug_idx on public.exercise_flags(slug);
create index joint_regions_slug_idx on public.joint_regions(slug);

create index exercises_slug_idx on public.exercises(slug);
create index exercises_status_idx on public.exercises(status);
create index exercises_category_idx on public.exercises(category_id);
create index exercises_difficulty_idx on public.exercises(difficulty);
create index exercises_movement_pattern_idx on public.exercises(movement_pattern);
create index exercises_mechanics_idx on public.exercises(mechanics);
create index exercises_plane_of_motion_idx on public.exercises(plane_of_motion);
create index exercises_laterality_idx on public.exercises(laterality);
create index exercises_load_type_idx on public.exercises(load_type);
create index exercises_is_premium_idx on public.exercises(is_premium);
create index exercises_updated_at_idx on public.exercises(updated_at);
create index exercises_catalog_version_idx on public.exercises(catalog_version);
create index exercises_deleted_at_idx on public.exercises(deleted_at);
create index exercises_flags_gin_idx on public.exercises using gin(flags);
create index exercises_tags_gin_idx on public.exercises using gin(tags);
create index exercises_joint_regions_gin_idx on public.exercises using gin(joint_regions);
create index exercises_programming_gin_idx on public.exercises using gin(programming);
create index exercises_search_idx on public.exercises using gin(
  public.exercise_search_document(name, description, tags)
);

create index exercise_aliases_alias_idx on public.exercise_aliases(alias);
create index exercise_aliases_exercise_idx on public.exercise_aliases(exercise_id);

create index exercise_media_exercise_idx on public.exercise_media(exercise_id);
create index exercise_media_type_idx on public.exercise_media(type);
create index exercise_media_status_idx on public.exercise_media(status);

create index exercise_change_events_changed_at_idx on public.exercise_change_events(changed_at);
create index exercise_change_events_exercise_idx on public.exercise_change_events(exercise_id);
create index exercise_change_events_version_idx on public.exercise_change_events(catalog_version);

create index api_keys_hash_idx on public.api_keys(key_hash);
create index api_keys_user_idx on public.api_keys(user_id);
create index api_usage_daily_user_date_idx on public.api_usage_daily(user_id, usage_date);
create index api_usage_log_user_idx on public.api_usage_log(user_id);
create index api_usage_log_api_key_idx on public.api_usage_log(api_key_id);
create index api_usage_log_created_at_idx on public.api_usage_log(created_at);
