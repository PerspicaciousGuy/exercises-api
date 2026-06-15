# Database Schema Review

This document summarizes the local Supabase/PostgreSQL migrations for Phase 1. These files are review artifacts only until the project is connected to a Supabase project.

## Migration Files

| File                                                      | Purpose                                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `supabase/migrations/001_enable_extensions.sql`           | Enables `pgcrypto` and `citext`.                                                        |
| `supabase/migrations/002_create_enums.sql`                | Creates enums for exercise classification, media, sync changes, and subscription tiers. |
| `supabase/migrations/003_create_reference_tables.sql`     | Creates muscles, equipment, categories, flags, and joint-region reference tables.       |
| `supabase/migrations/004_create_exercises.sql`            | Creates the main public exercise catalog table and aliases.                             |
| `supabase/migrations/005_create_exercise_relations.sql`   | Creates muscle/equipment junctions and variation/progression/regression relations.      |
| `supabase/migrations/006_create_media_and_sync.sql`       | Creates normalized media and catalog change-event tables.                               |
| `supabase/migrations/007_create_api_users_keys_usage.sql` | Creates API users, API keys, daily counters, and request logs.                          |
| `supabase/migrations/008_create_indexes_and_triggers.sql` | Creates `updated_at` triggers, filter indexes, GIN indexes, and full-text search index. |
| `supabase/migrations/009_create_rls_and_grants.sql`       | Adds explicit `service_role` grants and enables RLS policies for defense in depth.      |

## Scope Decisions

- Version 1 stores only public catalog data.
- Private user-created exercises are intentionally not included.
- Media is normalized through `exercise_media` rather than fixed image/video/gif columns.
- Sync is supported through `catalog_version`, `updated_at`, `deleted_at`, and `exercise_change_events`.
- The Express API remains the public surface. Direct Supabase Data API access for `anon` and `authenticated` roles is not granted in these migrations.

## Supabase Security Notes

Supabase changed default Data API exposure behavior in 2026. New public-schema tables should not rely on automatic exposure. These migrations use explicit grants and enable RLS so access is reviewable before connecting a real Supabase project.

Current migration stance:

- `service_role` receives table and sequence privileges because the backend server will use it for catalog/API operations.
- `anon` and `authenticated` receive no direct table grants yet.
- RLS is enabled on every table in the public schema.
- Policies only allow `service_role` operations.

Before applying to Supabase:

- Confirm whether the project will expose any tables through Supabase Data API directly.
- If direct client access is needed later, add explicit grants and policies in a new migration.
- Run Supabase advisors after applying migrations to a real project.

## Hosted Supabase Test Flow

The project will apply these migrations directly to a hosted Supabase project through the Supabase MCP or SQL editor. Docker-local testing is intentionally skipped for this project because the local machine is not a good fit for running the full Supabase Docker stack.

Recommended hosted flow:

1. Connect the Supabase MCP to the target project.
2. Apply the migration SQL files in numeric order.
3. Verify table, enum, index, trigger, RLS, and policy creation.
4. Run Supabase advisors and review warnings.
5. Run the project test suite with `npm test`.

## Review Checklist

- [ ] Enum names match API response and filter names.
- [ ] Reference tables are sufficient for Phase 2 seed data.
- [ ] Exercise fields cover public catalog requirements.
- [ ] `exercise_media` supports images, video, GIFs, thumbnails, ordering, and status.
- [ ] `exercise_change_events` supports initial and incremental sync.
- [ ] API user/key tables do not expose raw API keys.
- [ ] Indexes cover filters, slug lookup, full-text search, and sync timestamps.
- [ ] RLS/grants match the server-only access model.
