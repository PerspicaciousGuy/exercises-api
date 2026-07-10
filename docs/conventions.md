# Project Conventions

Deliberate deviations from `agents-guidelines/`, and the reasoning behind each.

`agents-guidelines/` is a portable, source-backed rules library shared across
projects. It is not edited to accommodate any single project. Where this project
knowingly departs from it, the departure is recorded here instead.

Read this alongside `AGENTS.md` before any execution.

---

## Rule files that do not apply

| File                            | Why                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `languages/typescript-rules.md` | This project is plain JavaScript (ESM). There is no TypeScript, no build step, no `tsconfig.json`.                                                         |
| `database/prisma-rules.md`      | There is no ORM. Data access goes through `src/supabase/restClient.js`, a hand-rolled PostgREST client, with raw SQL migrations in `supabase/migrations/`. |

`agents-guidelines/README.md` maps every Express stack to TypeScript. There is no
plain-JavaScript row. That is a gap in the map, not a defect in this codebase.

---

## Accepted deviations

### Rate limiting is per-API-key and daily, not per-IP and windowed

`backend/express-rules.md` mandates `express-rate-limit` with a 100-request /
15-minute per-IP window.

This project instead enforces tier-based daily quotas keyed on the API key, in
`src/middleware/apiKeyAuth.js` and `src/services/authService.js`, backed by the
`api_usage_daily` and `api_usage_log` tables.

**Why:** the guideline's per-IP window is designed for anonymous public
endpoints. This is a metered developer API where every caller is identified by
an API key and quotas are a billing concept, not an abuse-prevention concept. A
per-IP window would be both wrong (one company behind one NAT shares a quota)
and redundant.

`express-rate-limit` may still be added later as a secondary, coarse-grained
defence in front of the unauthenticated `/auth/*` endpoints. That would
complement the per-key quotas rather than replace them.

### Success responses use a `{ success, data }` envelope

`backend/api/rest-api-rules.md` says not to wrap single resources in a generic
envelope.

Every endpoint built in Phases 3 through 5 returns
`{ success: true, data: ..., pagination? }`. This is a **locked-in public API
contract**. Changing it would be a breaking change requiring a major version
bump, per that same rules file's versioning section.

**Why keep it:** the change would touch every route and every route test, the
envelope is a defensible and widely used style, and the benefit is cosmetic.

**Note the asymmetry:** error responses were _not_ grandfathered. They follow
RFC 9457 — see below. The two were decided separately because errors cost one
file to change and success responses cost the whole surface.

---

## Adopted from the guidelines

### Error responses follow RFC 9457 (`application/problem+json`)

All error paths emit RFC 9457 Problem Details, built in
`src/errors/problemDetails.js`.

The `code` field is retained as an RFC 9457 extension member, satisfying
`backend/api/api-general-rules.md`'s requirement for a machine-readable error
code alongside the standard `type` / `title` / `status` / `detail` members.

**Why this and not the envelope:** adopted while the API had zero consumers,
which was the only moment it was free. After a single developer integrates, the
same change costs a `/v2`.

### Structured logging with Pino

`backend/node-rules.md` mandates Pino. `src/logging/logger.js` configures it:
JSON everywhere, `pino-pretty` in development only, `silent` under
`NODE_ENV=test`, level from `LOG_LEVEL`.

Credentials are redacted at the logger rather than at each call site, because a
call site can be forgotten: `password`, `apiKey`, `key`, `token`, `tokenHash`,
their nested forms, and the `authorization`, `cookie`, `x-api-key`, and
`x-signature` headers.

### Request correlation IDs

`backend/api/api-general-rules.md` requires a request ID in every error response
and every log line, generated at the boundary when the client sends none.

`requestLogger` mints a UUID or sanitises an inbound `X-Request-Id`, echoes it,
and stores it in an `AsyncLocalStorage`. `logger`'s `mixin` reads that store, so
every line inside a request carries `requestId` without any caller passing it,
and `buildProblemDetails` adds the same value to every error body.

This is what makes a 5xx diagnosable. Its `detail` is deliberately generic so
internals never leak; the `requestId` is the compensating affordance, saying
nothing to an attacker while pointing an operator at the one log line with the
stack trace.

### Retries are gated on the HTTP method, not only on the failure

`SupabaseRestClient.request` retries transient failures with exponential backoff
and full jitter, up to three attempts.

What is retryable depends on the method. A network error on a `GET` is safe to
replay. A network error on a `POST` is **not**: the request may have reached
Postgres and committed before the socket died, so replaying it could insert the
row twice. Non-idempotent methods therefore retry on `429` alone, which PostgREST
refuses before doing any work.

The retry log records the table but redacts the query string, because PostgREST
puts filters there and a filter can carry an email address or a session token
hash.

### Graceful shutdown

`server.js` handles `SIGTERM` and `SIGINT` by closing the listener — refusing new
connections while in-flight requests finish — with a 10-second backstop before a
forced exit. The backstop is `unref`'d so it never keeps the process alive on its
own, and it sits below the ~30 seconds Railway and Render allow between `SIGTERM`
and `SIGKILL`.

---

## Deferred, not rejected

These guideline requirements are unmet. They are additive, break no contract,
and belong in their own task.

- **`console.*` in `scripts/`.** `backend/node-rules.md` forbids `console.log` in
  production code. The files under `scripts/` are one-shot CLI tools whose
  console output _is_ their interface; routing it through Pino would turn
  human-readable progress into JSON. `src/` and `server.js` contain none.
- **`X-RateLimit-Reset` format.** Emitted as an ISO 8601 string;
  `rest-api-rules.md` specifies a Unix timestamp. Changing it is a breaking
  change to a success-response header.
- **`docs/openapi.yaml` exceeds the 500-line hard limit** (1,529 lines). It is
  not split. An OpenAPI document is one artifact that tooling loads as a unit;
  splitting it means external `$ref`s plus a bundling step before Scalar can
  read it, trading a line count for real build complexity. Response bodies are
  defined once as composed schemas in `components` and referenced by path, so
  the file is repetitive by structure rather than by duplication.
