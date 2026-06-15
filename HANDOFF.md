## Project Overview

ExerciseDB API is a production-grade public exercise catalog API for fitness app developers. Version 1 focuses on public catalog data that client apps can sync and cache locally.

## Current State

Phase 0 is complete. Phase 1 migration files are complete but have not yet been applied to a Supabase project. Docker-local Supabase testing was removed; the next path is hosted Supabase via MCP or SQL editor.

## Last Action

Removed Docker-local Supabase setup files and npm scripts. Kept the actual migration SQL files under `supabase/migrations/` for hosted Supabase application.

## In Progress

Nothing currently in progress.

## Pending

Connect the Supabase MCP or use the Supabase SQL editor, apply the migration SQL files in order, run advisors, and verify the hosted schema.

## Known Issues

- `npm install` reported 5 audit findings: 3 moderate, 1 high, and 1 critical. Dependency upgrades or `npm audit fix --force` were not run because that can introduce breaking changes and is outside Phase 0.
- Git required `safe.directory` configuration because the repository was initialized under the sandbox user and pushed under the Windows user.
- Hosted Supabase migrations have not been applied yet.

## Files Status

- Created: `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc`, `README.md`, `HANDOFF.md`, `docs/openapi.yaml`, `docs/database-schema.md`, `eslint.config.js`, `package.json`, `package-lock.json`, `server.js`, `supabase/migrations/001_enable_extensions.sql`, `supabase/migrations/002_create_enums.sql`, `supabase/migrations/003_create_reference_tables.sql`, `supabase/migrations/004_create_exercises.sql`, `supabase/migrations/005_create_exercise_relations.sql`, `supabase/migrations/006_create_media_and_sync.sql`, `supabase/migrations/007_create_api_users_keys_usage.sql`, `supabase/migrations/008_create_indexes_and_triggers.sql`, `supabase/migrations/009_create_rls_and_grants.sql`, `src/app.js`, `src/config/env.js`, `src/constants/service.js`, `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/routes/health.js`, `tests/env.test.js`, `tests/health.test.js`, `tests/migrations.test.js`
- Modified: `IMPLEMENTATION_PLAN.md` marked Phase 0 and Phase 1 migration-file checklist items complete; `package.json` and `package-lock.json` reverted local Supabase CLI setup; `docs/database-schema.md` documents hosted Supabase/MCP application; `HANDOFF.md` updated with hosted Supabase path.
- Currently Being Edited: none
- Planned to Edit: Hosted Supabase connection/application notes, Phase 2 seed/import files
- Untouched: `PLAN.md`, `AGENTS.md`
