## Project Overview

ExerciseDB API is a production-grade public exercise catalog API for fitness app developers. Version 1 focuses on public catalog data that client apps can sync and cache locally.

## Current State

Phase 0 is complete. Phase 1 migrations have been applied to the hosted Supabase project at `https://yfdxihexqcsccoxhgxgm.supabase.co`. Phase 2 seed/import pipeline is implemented and has been run against hosted Supabase. Phase 3 public catalog read endpoints are implemented. Phase 4 sync endpoints are implemented. Phase 5 authentication, API keys, tier limits, usage tracking, rate limit headers, and premium gating are implemented. Local lint, tests, format checks, and live hosted Supabase smoke tests pass.

## Last Action

Finished Phase 5 authentication, rate limits, and usage. Added custom developer registration/login, one-time plaintext API key issuance, secure API key hashing, scrypt password hashing, API key middleware, daily usage counters, raw usage logs, rate limit response headers, protected catalog/reference/sync routes, premium exercise gating for free-tier users, developer account/key/usage endpoints, OpenAPI updates, README usage examples, and tests.

## In Progress

Nothing currently in progress.

## Pending

Start Phase 6 billing and developer account flow when ready: Stripe checkout, webhook signature validation, subscription-tier updates, safe downgrade behavior, and billing documentation. Phase 7 developer experience docs are still pending after billing.

## Known Issues

- `npm install` reported 5 audit findings: 3 moderate, 1 high, and 1 critical. Dependency upgrades or `npm audit fix --force` were not run because that can introduce breaking changes and is outside the current phase.
- Git required `safe.directory` configuration because the repository was initialized under the sandbox user and pushed under the Windows user.
- Supabase security advisor still warns that the `citext` extension is installed in `public`. Moving it should be handled as a separate migration decision because `api_users.email` currently uses `citext`.
- Supabase performance advisor reports unused indexes because there is not enough real query traffic yet; do not remove them until production-like usage exists.
- Hosted Phase 5 smoke verification created disposable developer account `phase5-smoke-1781534150806@example.com`; there is no admin cleanup endpoint yet.

## Files Status

- Created: `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc`, `README.md`, `HANDOFF.md`, `data/reference/muscles.json`, `data/reference/equipment.json`, `data/reference/categories.json`, `data/reference/exercise-flags.json`, `data/reference/joint-regions.json`, `data/exercises/sample-exercises.json`, `docs/openapi.yaml`, `docs/database-schema.md`, `eslint.config.js`, `package.json`, `package-lock.json`, `scripts/validate-fixtures.js`, `scripts/seed-reference-data.js`, `scripts/import-sample-exercises.js`, `server.js`, `supabase/migrations/001_enable_extensions.sql`, `supabase/migrations/002_create_enums.sql`, `supabase/migrations/003_create_reference_tables.sql`, `supabase/migrations/004_create_exercises.sql`, `supabase/migrations/005_create_exercise_relations.sql`, `supabase/migrations/006_create_media_and_sync.sql`, `supabase/migrations/007_create_api_users_keys_usage.sql`, `supabase/migrations/008_create_indexes_and_triggers.sql`, `supabase/migrations/009_create_rls_and_grants.sql`, `supabase/migrations/010_harden_functions_and_indexes.sql`, `supabase/migrations/011_revoke_public_helper_execution.sql`, `src/app.js`, `src/config/env.js`, `src/config/supabaseEnv.js`, `src/constants/rateLimits.js`, `src/constants/service.js`, `src/errors/AppError.js`, `src/import/catalogFixtureFiles.js`, `src/import/catalogImportPlans.js`, `src/import/catalogSeeder.js`, `src/middleware/apiKeyAuth.js`, `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/repositories/authRepository.js`, `src/repositories/exerciseMappers.js`, `src/repositories/exerciseQueries.js`, `src/repositories/exerciseRepository.js`, `src/repositories/referenceRepository.js`, `src/repositories/syncRepository.js`, `src/routes/auth.js`, `src/routes/exercises.js`, `src/routes/health.js`, `src/routes/references.js`, `src/routes/sync.js`, `src/security/apiKeys.js`, `src/security/passwords.js`, `src/services/authService.js`, `src/services/exerciseService.js`, `src/services/referenceService.js`, `src/services/syncService.js`, `src/supabase/restClient.js`, `src/utils/slugs.js`, `src/validation/catalogFixtures.js`, `tests/apiKeyMiddleware.test.js`, `tests/authRepository.test.js`, `tests/authRoutes.test.js`, `tests/authSecurity.test.js`, `tests/authService.test.js`, `tests/catalogFixtures.test.js`, `tests/catalogSeeder.test.js`, `tests/env.test.js`, `tests/exerciseRepository.test.js`, `tests/exerciseService.test.js`, `tests/exercisesRoutes.test.js`, `tests/health.test.js`, `tests/importPlans.test.js`, `tests/migrations.test.js`, `tests/referenceRepository.test.js`, `tests/referenceRoutes.test.js`, `tests/slugs.test.js`, `tests/supabaseEnv.test.js`, `tests/supabaseRestClient.test.js`, `tests/syncRepository.test.js`, `tests/syncRoutes.test.js`, `tests/syncService.test.js`
- Modified: `README.md` documents registration, API-key usage, protected endpoint examples, rate limit headers, and Phase 5 status; `IMPLEMENTATION_PLAN.md` marks Phase 5 complete and defers billing to Phase 6; `PLAN.md` was updated locally but is git-ignored by project policy; `docs/openapi.yaml` documents auth endpoints and API-key security; `src/app.js` wires auth, API-key middleware, and protected routers; `src/repositories/exerciseQueries.js` supports Phase 4 list sync filters; `src/repositories/referenceRepository.js` exposes shared catalog enum metadata; `src/routes/exercises.js` validates sync list filters and gates premium rows; `src/supabase/restClient.js` adds PATCH support; `tests/exerciseRepository.test.js`, `tests/exercisesRoutes.test.js`, `tests/referenceRoutes.test.js`, and `tests/supabaseRestClient.test.js` cover updated route/repository behavior; `HANDOFF.md` updated with completed Phase 5 state.
- Currently Being Edited: none
- Planned to Edit: Phase 6 billing files when that phase starts; likely new Stripe service, webhook route, billing docs, and tests.
- Untouched: `AGENTS.md`, `.env`
