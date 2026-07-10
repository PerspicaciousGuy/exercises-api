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

1. For a first sync, call `GET /sync/exercises?limit=100` until `pagination.hasMore` is false, following `pagination.nextCursor`.
2. Store returned `data.exercises` by `id`.
3. Apply `data.tombstones`: `changeType: "deleted"` means remove the local record, `"deprecated"` means flag it.
4. After the final page, save `data.latestChangeAt` as your watermark, in the same local transaction as the records.
5. For future syncs, call `GET /sync/exercises?updated_since=<watermark>&limit=100`.

`limit` bounds change events, not exercises, so a full page may return fewer than
`limit` records. Page on `hasMore`, never on `exercises.length`.

Every page of one sync reports the same `latestChangeAt`, captured before the
first page was read, so a record written mid-sync arrives on the next run rather
than being skipped.

Use `include_deprecated=true` only when the client needs deprecated exercise records for migration or cleanup UI. Deprecated records are then returned in `data.exercises` with `status: "deprecated"` and are not tombstoned.

The full walkthrough is in [the sync guide](website/sync-guide.md).

## Billing

Paid tiers are sold through Lemon Squeezy. The catalog and sync endpoints boot
without billing credentials — only `POST /billing/checkout` and the webhook
endpoint require them.

### Configuration

Set these in `.env` (see `.env.example`). Every value comes from your Lemon
Squeezy dashboard; the variant ids are the subscription products that map to
each tier.

```
LEMON_SQUEEZY_API_KEY=
LEMON_SQUEEZY_STORE_ID=
LEMON_SQUEEZY_WEBHOOK_SECRET=
LEMON_SQUEEZY_VARIANT_ID_BASIC=
LEMON_SQUEEZY_VARIANT_ID_PRO=
LEMON_SQUEEZY_VARIANT_ID_ENTERPRISE=
```

### Buying a tier

```bash
curl -X POST http://localhost:3000/billing/checkout \
  -H "x-api-key: $EXERCISEDB_API_KEY" \
  -H "content-type: application/json" \
  -d '{"tier":"pro"}'
```

Responds `201` with a `Location` header and a `checkoutUrl`. The developer's
account id travels to Lemon Squeezy as `checkout_data.custom.user_id` and comes
back on every subscription webhook, which is how a payment is linked to an
account.

### Subscription lifecycle

`active` and `on_trial` grant the tier matching the purchased variant. Every
other status — `cancelled`, `expired`, `paused`, `past_due`, `unpaid` — drops
the account to `free` **immediately**, not at period end.

### Testing webhooks locally

Lemon Squeezy must reach your machine, so expose the local port first:

```bash
npx localtunnel --port 3000
# or: ngrok http 3000
```

In the Lemon Squeezy dashboard, add a webhook pointing at
`https://<your-tunnel>/webhooks/lemon-squeezy`, set the signing secret to match
`LEMON_SQUEEZY_WEBHOOK_SECRET`, and subscribe to the `subscription_*` events.
Put the store in test mode and pay with card `4242 4242 4242 4242`.

To exercise the endpoint without Lemon Squeezy, sign a body yourself:

```bash
BODY='{"meta":{"event_name":"subscription_created","custom_data":{"user_id":"<uuid>"}},"data":{"id":"sub_1","attributes":{"status":"active","variant_id":"<pro variant id>","customer_id":1,"renews_at":null,"ends_at":null}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$LEMON_SQUEEZY_WEBHOOK_SECRET" -hex | sed 's/.* //')

curl -X POST http://localhost:3000/webhooks/lemon-squeezy \
  -H "content-type: application/json" \
  -H "x-signature: $SIG" \
  -d "$BODY"
```

The signature is an HMAC-SHA256 hex digest of the exact raw bytes, so the body
must not be reformatted between signing and sending.

Deliveries are deduplicated on `sha256(body)`. Lemon Squeezy sends no event id
and no timestamp header, so a byte-identical redelivery is the only reliable
duplicate signal — and a timestamp-based replay window is not possible.

## Logging

Structured JSON via Pino, pretty-printed in development, silent under
`NODE_ENV=test`. Set `LOG_LEVEL` to one of `fatal`, `error`, `warn`, `info`,
`debug`, `trace`, `silent`.

Every request gets an `X-Request-Id`, echoed in the response header and repeated
as `requestId` in any error body. Send your own to trace a call across services;
it is sanitised before it reaches a log line or a header.

A 5xx response tells the caller nothing (`"An unexpected error occurred"`) by
design. The `requestId` is how you find the log line that has the stack trace:

```bash
grep '"requestId":"485fa7dd-..."' server.log
```

Credentials are redacted by the logger itself — passwords, keys, tokens, and the
`authorization`, `cookie`, `x-api-key`, and `x-signature` headers — so a careless
`logger.info(req.headers)` cannot leak one.

## Deployment

The API, the docs site, and the dashboard deploy separately and share no build.
See [docs/deployment.md](docs/deployment.md) for Railway and Render, the
environment variables, and the post-deploy checklist.

A `Dockerfile` is committed for platforms that prefer it: Node 20, multi-stage,
devDependencies dropped, non-root user, healthcheck on `/health`.

> Start the API with `node server.js`, never `npm start` — npm does not forward
> `SIGTERM`, so graceful shutdown never runs and deploys sever in-flight
> requests.

Architecture and the reasoning behind the design are in
[website/architecture.md](website/architecture.md).

## Resilience

Database calls retry transient failures — connection resets, `5xx`, `429` — with
exponential backoff and jitter, up to three attempts.

Retries are gated on the HTTP method. A `GET` that dies mid-flight is replayed. A
`POST` is not: it may have reached Postgres and committed before the socket
died, and replaying it would insert the row twice. Non-idempotent requests retry
only on `429`, which is refused before any work happens.

On `SIGTERM` the server stops accepting connections, lets in-flight requests
finish, and exits — with a 10-second backstop so a hung request cannot hold a
deploy open forever.

## Client Examples

`examples/` holds a complete client in JavaScript, Python, Swift, Dart, and
Kotlin. Each authenticates, handles an RFC 9457 error by its `code`, and runs the
full sync loop. See [examples/README.md](examples/README.md).

`postman/` holds a Postman collection generated from `docs/openapi.yaml`.
Regenerate it after any spec change with `npm run postman:generate`; do not edit
the JSON by hand.

## Developer Dashboard

`dashboard/` is a Vite + Vue app where developers manage their account, API
keys, usage, and plan. See [dashboard/README.md](dashboard/README.md).

It authenticates with a browser session, not an API key. `POST /auth/login` and
`POST /auth/register` set an `httpOnly`, `SameSite=Lax` `exdb_session` cookie;
`POST /auth/logout` revokes it server-side. `/me/*` and `/billing/checkout`
accept either a session or an API key. Sessions consume no daily quota.

An API key could not work here: the plaintext value is returned exactly once, so
the page that lists keys could never hold one, and revoking your last key would
lock you out. For the same reason `POST /auth/login` no longer issues an API key
on every call, as it once did — create keys explicitly with `POST /me/keys`.

Set `DASHBOARD_ORIGINS` to the origins allowed to send that cookie. Only `/auth`,
`/me`, and `/billing` are restricted to them; the public catalog stays open to
every origin.

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
