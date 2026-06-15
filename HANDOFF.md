## Project Overview

ExerciseDB API is a production-grade public exercise catalog API for fitness app developers. Version 1 focuses on public catalog data that client apps can sync and cache locally.

## Current State

Phase 0 is complete. Phase 1 migrations have been applied to the hosted Supabase project at `https://yfdxihexqcsccoxhgxgm.supabase.co`. The public schema has 20 expected tables, all with RLS enabled. Local lint, tests, and format checks pass.

## Last Action

Connected to the hosted Supabase project through MCP, applied migrations `001` through `011`, verified table/RLS state, ran Supabase advisors, added advisor-driven hardening migrations, and updated schema documentation/test expectations.

## In Progress

Nothing currently in progress.

## Pending

Start Phase 2 seed/import pipeline: reference data seeds, canonical exercise JSON shape, validation, and repeatable import scripts.

## Known Issues

- `npm install` reported 5 audit findings: 3 moderate, 1 high, and 1 critical. Dependency upgrades or `npm audit fix --force` were not run because that can introduce breaking changes and is outside Phase 0.
- Git required `safe.directory` configuration because the repository was initialized under the sandbox user and pushed under the Windows user.
- Supabase security advisor still warns that the `citext` extension is installed in `public`. Moving it should be handled as a separate migration decision because `api_users.email` currently uses `citext`.
- Supabase performance advisor reports unused indexes because the hosted database is empty; do not remove them until real query usage exists.

## Files Status

- Created: `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc`, `README.md`, `HANDOFF.md`, `docs/openapi.yaml`, `docs/database-schema.md`, `eslint.config.js`, `package.json`, `package-lock.json`, `server.js`, `supabase/migrations/001_enable_extensions.sql`, `supabase/migrations/002_create_enums.sql`, `supabase/migrations/003_create_reference_tables.sql`, `supabase/migrations/004_create_exercises.sql`, `supabase/migrations/005_create_exercise_relations.sql`, `supabase/migrations/006_create_media_and_sync.sql`, `supabase/migrations/007_create_api_users_keys_usage.sql`, `supabase/migrations/008_create_indexes_and_triggers.sql`, `supabase/migrations/009_create_rls_and_grants.sql`, `supabase/migrations/010_harden_functions_and_indexes.sql`, `supabase/migrations/011_revoke_public_helper_execution.sql`, `src/app.js`, `src/config/env.js`, `src/constants/service.js`, `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/routes/health.js`, `tests/env.test.js`, `tests/health.test.js`, `tests/migrations.test.js`
- Modified: `IMPLEMENTATION_PLAN.md` marks Phase 1 hosted Supabase application complete; `package.json` and `package-lock.json` reverted local Supabase CLI setup; `docs/database-schema.md` documents hosted Supabase application and remaining advisor warning; `tests/migrations.test.js` covers migrations `001` through `011`; `HANDOFF.md` updated with hosted Supabase state.
- Currently Being Edited: none
- Planned to Edit: Phase 2 seed/import files
- Untouched: `PLAN.md`, `AGENTS.md`
