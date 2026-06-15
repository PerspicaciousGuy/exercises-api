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
    service.js
  import/
    catalogFixtureFiles.js
    catalogImportPlans.js
    catalogSeeder.js
  middleware/
    errorHandler.js
    notFound.js
  routes/
    health.js
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

Phase 0 is the backend foundation. Phase 1 created and applied the hosted Supabase schema. Phase 2 adds validated fixture data and repeatable seed/import scripts.
