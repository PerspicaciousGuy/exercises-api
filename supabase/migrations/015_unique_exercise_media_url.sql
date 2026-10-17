-- One row per (exercise, url) in exercise_media.
--
-- The seeder upserts media on this key and deletes rows a fixture no longer
-- lists. Before this, it inserted every fixture media item on every run, so the
-- first seed after media was added would have duplicated it on each later run.
-- The table is empty today, so the index applies without a data fix.

create unique index if not exists exercise_media_exercise_url_key
  on public.exercise_media(exercise_id, url);
