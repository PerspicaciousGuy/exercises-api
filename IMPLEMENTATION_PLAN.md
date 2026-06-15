# ExerciseDB API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade public exercise catalog API that fitness app developers can sync into their own apps.

**Architecture:** Version 1 is a public catalog only. Supabase/PostgreSQL is the source of truth, Express exposes a curated API layer, and clients use sync endpoints to cache exercise data locally. Private user-created exercises, food data, workout generation, and a full admin UI are postponed until the public catalog is stable.

**Tech Stack:** Node.js, Express.js, PostgreSQL via Supabase, Supabase JS client plus raw SQL, Zod, Jest or Vitest, Supertest, OpenAPI, Stripe, Railway or Render.

---

## Product Scope

Version 1 focuses on public exercise data that app developers can import, cache, and refresh.

In scope:

- Public exercise catalog with rich exercise metadata.
- Lookup/reference data for muscles, equipment, categories, movement patterns, flags, taxonomy, and media.
- Sync-friendly endpoints for initial sync, incremental sync, bulk fetches, and metadata refresh.
- API key authentication, usage tracking, rate limits, and tier-based access.
- Import scripts and validation for building the catalog without a full admin UI.
- OpenAPI documentation, examples, tests, and a clean GitHub-ready project structure.

Out of scope for Version 1:

- Private user-created exercises.
- Food database API.
- Workout plan generation.
- Full custom admin panel.
- Social, calorie, or end-user workout tracking features.

---

## Phase 0: Project Setup And Quality Bar

**Goal:** Create a clean backend workspace that is easy to test, document, and deploy.

- [x] Initialize Node.js project with `package.json`.
- [x] Add Express app structure under `src/`.
- [x] Add environment validation with Zod.
- [x] Add ESLint, Prettier, and consistent npm scripts.
- [x] Add test runner and Supertest setup.
- [x] Add `.env.example`.
- [x] Add `README.md` with setup, scripts, and project purpose.
- [x] Add `docs/openapi.yaml` placeholder.
- [x] Verify `npm run lint`, `npm test`, and `npm run dev` work.

Exit criteria:

- Local server starts.
- Health endpoint returns success.
- Test/lint commands run from a clean checkout.

---

## Phase 1: Database Foundation

**Goal:** Build the Supabase/PostgreSQL schema for a sync-friendly public catalog.

- [x] Create enums for status, difficulty, movement pattern, force type, mechanics, position, plane of motion, laterality, load type, media type, and subscription tier.
- [x] Create reference tables for muscles, equipment, categories, and optional taxonomy values.
- [x] Create `exercises` with rich classification fields, sync metadata, and status fields.
- [x] Create junction tables for muscles, equipment, variations, progressions, and regressions.
- [x] Create `exercise_media` instead of hardcoding only image/video/gif columns.
- [x] Create `exercise_change_events` for sync consumers and deleted/deprecated records.
- [x] Create `api_users`, `api_keys`, `api_usage_daily`, and `api_usage_log`.
- [x] Add indexes for slug lookup, filters, full-text search, tags, updated timestamps, and sync event ordering.
- [x] Add triggers for `updated_at`.
- [x] Enable RLS where tables are exposed through Supabase, even if the Express API is the primary public surface.
- [x] Apply migrations to hosted Supabase and harden advisor findings that are safe to fix immediately.

Local migration files are complete and have been applied to the hosted Supabase project.

Exit criteria:

- Migrations run on a fresh database.
- Schema can represent public catalog data, media, and sync changes.
- No private/custom exercise schema is included in V1.

---

## Phase 2: Seed And Import Pipeline

**Goal:** Make data collection repeatable and validated before any public endpoint depends on it.

- [x] Add seed data for muscles with region/group metadata.
- [x] Add seed data for equipment and categories.
- [x] Define canonical JSON shape for exercises.
- [x] Add import script for JSON or CSV exercise data.
- [x] Validate imports with Zod before database writes.
- [x] Generate slugs consistently.
- [x] Upsert aliases, muscles, equipment, media, tags, and related exercise links.
- [x] Record change events when public exercise records are inserted, updated, deprecated, or deleted.
- [x] Add sample fixture exercises for test coverage.

Phase 2 is implemented locally with JSON fixtures, validation, import planning, and Supabase REST scripts. Hosted import execution requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

Exit criteria:

- A fresh database can be seeded with reference data and sample exercises.
- Invalid exercise data fails with useful errors.
- Imports are repeatable without duplicate aliases/media/relations.

---

## Phase 3: Public Catalog API

**Goal:** Expose high-quality read endpoints for app developers.

- [ ] Build route/controller/service boundaries for exercises.
- [ ] Implement `GET /health`.
- [ ] Implement `GET /exercises` with pagination, filters, sorting, and sparse field selection.
- [ ] Implement `GET /exercises/:id`.
- [ ] Implement `GET /exercises/slug/:slug`.
- [ ] Implement `GET /exercises/search` with alias/tag-aware search.
- [ ] Implement `GET /exercises/bulk?ids=...`.
- [ ] Implement `GET /exercises/:id/related`.
- [ ] Implement `GET /exercises/:id/variations`.
- [ ] Implement `GET /exercises/:id/progressions`.
- [ ] Implement `GET /exercises/:id/regressions`.
- [ ] Implement reference endpoints for muscles, equipment, categories, movement patterns, flags, and metadata.
- [ ] Add consistent response envelopes and error envelopes.
- [ ] Add unit and integration tests for every endpoint.

Exit criteria:

- App developers can browse, filter, search, and fetch full exercise records.
- Endpoint responses are stable and documented.
- Tests cover success, validation, not found, and pagination cases.

---

## Phase 4: Sync API

**Goal:** Support fitness apps that cache public exercise data locally.

- [ ] Implement `GET /sync/metadata` with catalog version, supported resources, enum values, and latest update timestamp.
- [ ] Implement `GET /sync/exercises?updated_since=...` for incremental sync.
- [ ] Include deprecated/deleted IDs or tombstones in sync responses.
- [ ] Support pagination cursors for large sync batches.
- [ ] Add `updated_since` support to `GET /exercises`.
- [ ] Add `include_deprecated` for clients that need migration or cleanup data.
- [ ] Add tests for first sync, incremental sync, no-op sync, and deleted/deprecated records.
- [ ] Document client caching strategy in the getting-started guide.

Exit criteria:

- A mobile app can perform initial sync, store local exercise data, and refresh only changed records later.
- Sync behavior is deterministic and test-covered.

---

## Phase 5: Authentication, Rate Limits, And Usage

**Goal:** Protect the API while keeping developer onboarding simple.

- [ ] Implement API key generation and secure hashing.
- [ ] Implement API key middleware with active/expiry checks.
- [ ] Implement tier-based daily usage limits.
- [ ] Store daily usage counts and raw usage logs.
- [ ] Add rate limit headers.
- [ ] Add premium content gating if premium catalog rows are used.
- [ ] Implement `POST /auth/register`, `POST /auth/login`, `GET /me`, `GET /me/keys`, `POST /me/keys`, `DELETE /me/keys/:id`, and `GET /me/usage`.
- [ ] Add tests for valid keys, invalid keys, revoked keys, expired keys, and limit exhaustion.

Exit criteria:

- Public catalog endpoints require API keys except where explicitly public.
- Usage accounting is visible and enforceable.

---

## Phase 6: Billing And Developer Account Flow

**Goal:** Turn the API into a credible paid SaaS-style project without expanding the product surface.

- [ ] Add Stripe customer and subscription fields.
- [ ] Implement checkout session creation.
- [ ] Implement Stripe webhook handling.
- [ ] Update tiers on subscription changes.
- [ ] Downgrade users safely on canceled or failed subscriptions.
- [ ] Add tests for webhook signature validation and tier updates.
- [ ] Document local webhook testing.

Exit criteria:

- Subscription tier changes flow into API access and rate limits.
- Webhook behavior is safe and repeatable.

---

## Phase 7: Documentation And Developer Experience

**Goal:** Make the project easy to understand from GitHub and easy to consume as an API.

- [ ] Complete OpenAPI spec for every endpoint.
- [ ] Add request/response examples.
- [ ] Add getting-started guide with first API call.
- [ ] Add sync integration guide for mobile apps.
- [ ] Add example code for JavaScript, Python, Swift, Flutter/Dart, and Kotlin.
- [ ] Add Postman collection.
- [ ] Add deployment guide for Railway or Render.
- [ ] Add architecture notes explaining public catalog V1 and postponed private custom exercises.

Exit criteria:

- A developer can understand the API and perform their first successful call in under five minutes.
- The repository reads like a complete backend portfolio project.

---

## Phase 8: Optional Management Tools

**Goal:** Improve maintainability only after the API and import pipeline are solid.

- [ ] Add CLI commands for validating and importing catalog files.
- [ ] Add media upload helpers.
- [ ] Add lightweight internal review workflow for draft to active exercise publishing.
- [ ] Build a custom admin panel only after the data model and import workflow stop changing.

Exit criteria:

- Catalog maintenance is faster without forcing a premature admin UI.

---

## Phase 9: Future Expansion

These are intentionally postponed until the public catalog API is excellent.

- [ ] Private user-created/custom exercises.
- [ ] JavaScript and Python SDKs.
- [ ] Multi-language exercise names and descriptions.
- [ ] Advanced media hosting and processing.
- [ ] Food database API.
- [ ] Workout plan generation.
- [ ] Affiliate/referral program.

---

## Execution Notes

- Implement one phase at a time.
- Prefer test-first development for services, middleware, and endpoint behavior.
- Keep migrations small and reviewable.
- Treat `PLAN.md` as the product specification and this file as the execution source of truth.
- Do not add private custom exercises until Version 1 public catalog sync is complete.
