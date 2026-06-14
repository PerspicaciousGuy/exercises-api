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
- `npm test` - run the test suite
- `npm run lint` - run ESLint
- `npm run format` - format files with Prettier
- `npm run format:check` - check formatting

## Project Structure

```text
src/
  app.js
  config/
    env.js
  constants/
    service.js
  middleware/
    errorHandler.js
    notFound.js
  routes/
    health.js
tests/
  env.test.js
  health.test.js
docs/
  openapi.yaml
```

## Current Status

Phase 0 is the backend foundation: package setup, Express app structure, environment validation, health endpoint, tests, linting, and docs placeholder.
