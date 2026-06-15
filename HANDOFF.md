## Project Overview

ExerciseDB API is a production-grade public exercise catalog API for fitness app developers. Version 1 focuses on public catalog data that client apps can sync and cache locally.

## Current State

Phase 0 is complete. Phase 1 migrations have been applied to the hosted Supabase project at `https://yfdxihexqcsccoxhgxgm.supabase.co`. Phase 2 seed/import pipeline is implemented and has been run against hosted Supabase. Phase 3 public catalog read endpoints are implemented: list, detail by id, detail by slug, alias/tag-aware search, bulk fetch, grouped related exercises, variations, progressions, regressions, and reference metadata endpoints. Local lint, tests, fixture validation, format checks, and live hosted Supabase smoke tests pass.

## Last Action

Finished the remaining Phase 3 public read endpoints. Added exercise service boundaries, reference service/repository/routes, exercise query helpers, search, bulk fetch, related/variation/progression/regression endpoints, reference metadata endpoints, OpenAPI entries, README examples, and tests. Live smoke test against hosted Supabase covered 14 Phase 3 calls successfully.

## In Progress

Nothing currently in progress.

## Pending

Start Phase 4 sync API: `GET /sync/metadata`, `GET /sync/exercises?updated_since=...`, tombstone/deprecated record handling, cursor pagination, and client caching documentation.

## Known Issues

- `npm install` reported 5 audit findings: 3 moderate, 1 high, and 1 critical. Dependency upgrades or `npm audit fix --force` were not run because that can introduce breaking changes and is outside Phase 0.
- Git required `safe.directory` configuration because the repository was initialized under the sandbox user and pushed under the Windows user.
- Supabase security advisor still warns that the `citext` extension is installed in `public`. Moving it should be handled as a separate migration decision because `api_users.email` currently uses `citext`.
- Supabase performance advisor reports unused indexes because there is not enough real query traffic yet; do not remove them until production-like usage exists.

## Files Status

- Created: `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc`, `README.md`, `HANDOFF.md`, `data/reference/muscles.json`, `data/reference/equipment.json`, `data/reference/categories.json`, `data/reference/exercise-flags.json`, `data/reference/joint-regions.json`, `data/exercises/sample-exercises.json`, `docs/openapi.yaml`, `docs/database-schema.md`, `eslint.config.js`, `package.json`, `package-lock.json`, `scripts/validate-fixtures.js`, `scripts/seed-reference-data.js`, `scripts/import-sample-exercises.js`, `server.js`, `supabase/migrations/001_enable_extensions.sql`, `supabase/migrations/002_create_enums.sql`, `supabase/migrations/003_create_reference_tables.sql`, `supabase/migrations/004_create_exercises.sql`, `supabase/migrations/005_create_exercise_relations.sql`, `supabase/migrations/006_create_media_and_sync.sql`, `supabase/migrations/007_create_api_users_keys_usage.sql`, `supabase/migrations/008_create_indexes_and_triggers.sql`, `supabase/migrations/009_create_rls_and_grants.sql`, `supabase/migrations/010_harden_functions_and_indexes.sql`, `supabase/migrations/011_revoke_public_helper_execution.sql`, `src/app.js`, `src/config/env.js`, `src/config/supabaseEnv.js`, `src/constants/service.js`, `src/errors/AppError.js`, `src/import/catalogFixtureFiles.js`, `src/import/catalogImportPlans.js`, `src/import/catalogSeeder.js`, `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/repositories/exerciseMappers.js`, `src/repositories/exerciseQueries.js`, `src/repositories/exerciseRepository.js`, `src/repositories/referenceRepository.js`, `src/routes/exercises.js`, `src/routes/health.js`, `src/routes/references.js`, `src/services/exerciseService.js`, `src/services/referenceService.js`, `src/supabase/restClient.js`, `src/utils/slugs.js`, `src/validation/catalogFixtures.js`, `tests/catalogFixtures.test.js`, `tests/catalogSeeder.test.js`, `tests/env.test.js`, `tests/exerciseRepository.test.js`, `tests/exerciseService.test.js`, `tests/exercisesRoutes.test.js`, `tests/health.test.js`, `tests/importPlans.test.js`, `tests/migrations.test.js`, `tests/referenceRepository.test.js`, `tests/referenceRoutes.test.js`, `tests/slugs.test.js`, `tests/supabaseEnv.test.js`, `tests/supabaseRestClient.test.js`
- Modified: `.env.example` adds hosted Supabase script env names; `README.md` documents fixture/import scripts and the full Phase 3 endpoint examples; `IMPLEMENTATION_PLAN.md` marks Phase 3 public read endpoints complete and keeps Phase 4 sync pending; `package.json` adds fixture/import scripts; `package-lock.json` reverted local Supabase CLI setup; `docs/openapi.yaml` documents implemented exercise and reference endpoints; `docs/database-schema.md` documents hosted Supabase application and remaining advisor warning; `src/app.js` wires exercise/reference services and routers; `tests/migrations.test.js` covers migrations `001` through `011`; `HANDOFF.md` updated with completed Phase 3 state.
- Currently Being Edited: none
- Planned to Edit: Phase 4 sync API endpoint files
- Untouched: `PLAN.md`, `AGENTS.md`
