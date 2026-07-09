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

---

## Deferred, not rejected

These guideline requirements are unmet. They are additive, break no contract,
and belong in their own task.

- **Structured logging.** `backend/node-rules.md` mandates Pino and forbids
  `console.log`. There is currently no logger.
- **Request correlation IDs.** `backend/api/api-general-rules.md` requires a
  request ID in every error response and every log line. There is no request-ID
  middleware, so `problemDetails` emits no correlation ID yet.
- **`X-RateLimit-Reset` format.** Emitted as an ISO 8601 string;
  `rest-api-rules.md` specifies a Unix timestamp. Changing it is a breaking
  change to a success-response header.
- **`docs/openapi.yaml` exceeds the 500-line hard limit** (1,529 lines). It is
  not split. An OpenAPI document is one artifact that tooling loads as a unit;
  splitting it means external `$ref`s plus a bundling step before Scalar can
  read it, trading a line count for real build complexity. Response bodies are
  defined once as composed schemas in `components` and referenced by path, so
  the file is repetitive by structure rather than by duplication.
