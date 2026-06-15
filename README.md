# ExerciseDB API

Production-grade public exercise catalog API for fitness app developers.

Version 1 focuses on a public exercise catalog that client apps can sync and cache locally. Private user-created exercises, food data, workout generation, and a full custom admin panel are future expansions.

## Tech Stack

- Node.js
- Express.js
- PostgreSQL via Supabase
- Zod
- Vitest
- Supertest
- OpenAPI

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

Start the development server:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "exercisedb-api",
    "version": "0.1.0",
    "environment": "development"
  }
}
```

Register a developer account and get the first API key:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"dev@example.com\",\"password\":\"change-this-password\",\"name\":\"Example Developer\"}"
```

The plaintext API key is returned once. Store it securely and use it with protected endpoints:

```bash
EXERCISEDB_API_KEY=exdb_your_key_here
```

List exercises:

```bash
curl "http://localhost:3000/exercises?limit=10&category=strength" \
  -H "x-api-key: $EXERCISEDB_API_KEY"
```

List exercises updated after a timestamp:

```bash
curl "http://localhost:3000/exercises?updated_since=2026-06-15T10:00:00.000Z&include_deprecated=true" \
  -H "x-api-key: $EXERCISEDB_API_KEY"
```

Fetch one exercise:

```bash
curl http://localhost:3000/exercises/slug/push-up \
  -H "x-api-key: $EXERCISEDB_API_KEY"
```

Search exercises by name, alias, or exact tag:

```bash
curl "http://localhost:3000/exercises/search?q=press&limit=10" \
  -H "x-api-key: $EXERCISEDB_API_KEY"
```

Fetch multiple exercise records:

```bash
curl "http://localhost:3000/exercises/bulk?ids=exercise-id-1,exercise-id-2" \
  -H "x-api-key: $EXERCISEDB_API_KEY"
```

Fetch reference metadata:

```bash
curl http://localhost:3000/metadata -H "x-api-key: $EXERCISEDB_API_KEY"
curl http://localhost:3000/muscles -H "x-api-key: $EXERCISEDB_API_KEY"
curl http://localhost:3000/equipment -H "x-api-key: $EXERCISEDB_API_KEY"
curl http://localhost:3000/categories -H "x-api-key: $EXERCISEDB_API_KEY"
```

Fetch sync metadata:

```bash
curl http://localhost:3000/sync/metadata \
  -H "x-api-key: $EXERCISEDB_API_KEY"
```

Fetch changed exercise records since a local cache timestamp:

```bash
curl "http://localhost:3000/sync/exercises?updated_since=2026-06-15T10:00:00.000Z&limit=100" \
  -H "x-api-key: $EXERCISEDB_API_KEY"
```

Manage developer account keys and usage:

```bash
curl http://localhost:3000/me -H "x-api-key: $EXERCISEDB_API_KEY"
curl http://localhost:3000/me/keys -H "x-api-key: $EXERCISEDB_API_KEY"
curl -X POST http://localhost:3000/me/keys \
  -H "Content-Type: application/json" \
  -H "x-api-key: $EXERCISEDB_API_KEY" \
  -d "{\"label\":\"Mobile app\"}"
curl http://localhost:3000/me/usage -H "x-api-key: $EXERCISEDB_API_KEY"
```

Protected responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

## Client Sync Strategy

Mobile and web clients should treat the API as a public catalog source of truth and keep a local cache.

Recommended flow:

1. Call `GET /sync/metadata` to read the current catalog version and latest change timestamp.
2. For a first sync, call `GET /sync/exercises?limit=100` until `pagination.hasMore` is false.
3. Store returned `data.exercises` by `id`.
4. Apply `data.tombstones` by removing or marking local records whose `changeType` is `deleted` or `deprecated`.
5. Save the latest processed sync timestamp locally.
6. For future syncs, call `GET /sync/exercises?updated_since=<saved timestamp>&limit=100`.
7. If `pagination.nextCursor` is present, request the next page with `cursor=<nextCursor>` until no more pages remain.

Use `include_deprecated=true` only when the client needs deprecated exercise records for migration or cleanup UI.

## Scripts

- `npm run dev` - start the API with nodemon
- `npm start` - start the API with Node
- `npm run fixtures:validate` - validate Phase 2 reference and sample exercise fixtures
- `npm run seed:reference` - upsert reference fixtures into Supabase
- `npm run seed:sample` - upsert reference fixtures and sample exercises into Supabase
- `npm test` - run the test suite
- `npm run lint` - run ESLint
- `npm run format` - format files with Prettier
- `npm run format:check` - check formatting

## Seed And Import Fixtures

Phase 2 fixture data lives under `data/`:

- `data/reference/` - muscles, equipment, categories, flags, and joint regions
- `data/exercises/sample-exercises.json` - 12 sample exercises for pipeline validation

Hosted Supabase import scripts require these `.env` values:

```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-server-side-key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in a public client.

## Project Structure

```text
src/
  app.js
  config/
    env.js
    supabaseEnv.js
  constants/
    rateLimits.js
    service.js
  import/
    catalogFixtureFiles.js
    catalogImportPlans.js
    catalogSeeder.js
  middleware/
    apiKeyAuth.js
    errorHandler.js
    notFound.js
  repositories/
    authRepository.js
    exerciseMappers.js
    exerciseQueries.js
    exerciseRepository.js
    referenceRepository.js
    syncRepository.js
  routes/
    auth.js
    exercises.js
    health.js
    references.js
    sync.js
  security/
    apiKeys.js
    passwords.js
  services/
    authService.js
    exerciseService.js
    referenceService.js
    syncService.js
  supabase/
    restClient.js
  validation/
    catalogFixtures.js
data/
  reference/
  exercises/
scripts/
  validate-fixtures.js
  seed-reference-data.js
  import-sample-exercises.js
tests/
  env.test.js
  health.test.js
docs/
  openapi.yaml
```

## Current Status

Phase 0 is the backend foundation. Phase 1 created and applied the hosted Supabase schema. Phase 2 adds validated fixture data and repeatable seed/import scripts. Phase 3 public catalog read endpoints are implemented. Phase 4 sync endpoints are implemented for metadata, incremental exercise sync, tombstones, and cursor pagination. Phase 5 protects catalog/sync/reference endpoints with API keys, tracks usage, exposes developer account/key endpoints, returns rate limit headers, and gates premium exercise rows by tier.
