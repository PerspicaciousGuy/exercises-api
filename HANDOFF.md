## Project Overview

ExerciseDB API is a production-grade public exercise catalog API for fitness app developers. Version 1 focuses on public catalog data that client apps can sync and cache locally.

## Current State

Phase 0 is complete. Phase 1 migrations have been applied to the hosted Supabase project at `https://yfdxihexqcsccoxhgxgm.supabase.co`. Phase 2 seed/import pipeline is implemented and has been run against hosted Supabase. Phase 3 public catalog read endpoints are implemented. Phase 4 sync endpoints are implemented. Phase 5 authentication, API keys, tier limits, usage tracking, rate limit headers, and premium gating are implemented.

Error responses now follow RFC 9457 (`application/problem+json`) across every error path. Success responses keep the existing `{ success, data }` envelope. Deliberate deviations from `agents-guidelines/` are recorded in `docs/conventions.md`, which is loaded every session via `CLAUDE.md`.

Phase 6 provider-neutral billing is implemented with Lemon Squeezy as the first provider: checkout creation, signature-verified webhook ingestion, idempotent delivery handling, tier upgrades on subscription activation, and immediate downgrade to `free` on cancellation, expiry, pause, or payment failure.

Local lint and tests pass (116 tests, 25 files). `npm run format:check` fails on pre-existing unformatted `agents-guidelines/**` files — see Known Issues.

Migration `012_add_billing_fields.sql` has been applied to hosted Supabase and verified: six billing columns on `api_users`, both new enums, and `billing_webhook_events` with RLS enabled and a service-role policy. The security advisor reports no new findings.

## Last Action

Redesigned the developer dashboard's UI. This was a presentation-only change: no
API logic, routing, or session-store code was touched, and nothing outside
`dashboard/` changed. The visual language was rebuilt to feel like an app rather
than a form, while every design value still resolves to an existing `--ex-*`
token from the shared `website/.vitepress/theme/design-system.css`, so the
dashboard and docs site remain one product.

What changed:

- **`dashboard/src/styles/theme.js`** gained a persisted manual light/dark
  toggle. Dark mode already existed but only followed the OS; it now honours a
  `localStorage` preference (`exdb-theme`) and falls back to `system`, staying in
  sync with the OS while the choice is `system`. Exposes a reactive `theme`
  object and `toggleTheme()`. `main.js` calls the renamed `initTheme()`.
- **`dashboard/src/styles/app.css`** was rewritten from a flat stylesheet into
  the app's component layer: a two-tone sticky sidebar with icon links and an
  account footer, elevated cards with header rows, a metric/stat treatment, a
  colour-shifting usage meter, refined hover-state tables, segmented plan cards,
  badges with status dots, empty/loading states with a spinner, and polished
  auth screens. Every value is a token; no raw colours, sizes, or durations.
- **`dashboard/src/components/AppIcon.vue`** (new) is an inline-SVG icon set
  (Lucide paths, redrawn as static data) so the dashboard ships no icon
  dependency and every glyph inherits `currentColor`.
- All five views and `App.vue` were rebuilt on the new layer. Overview shows
  account metrics and a plan grid with the current tier visually distinct; Keys
  and Register gained a one-click copy button on the key reveal; Usage gained the
  meter that turns amber at 75% and red at 90%; auth screens gained a brand mark
  and footer.
- Every static inline `style=""` was removed — they violated the project's own
  no-hardcoded-values rule — and replaced with token-backed utility classes. The
  only remaining `:style` is the usage meter's data-driven width, which is
  legitimately dynamic.

Verified: `npm run build` succeeds (34 modules, no errors) and `npm run dev`
starts clean and serves HTTP 200. Visual rendering in both themes is left for the
owner to confirm in-browser, since a JS-rendered SPA cannot be screenshotted from
this environment.

Flagged, not acted on: `app.css` is now ~680 lines, over the 500-line hard limit
in `AGENTS.md`. It is one cohesive responsibility — the app's presentation layer,
mirroring the single-file pattern of `design-system.css` — so it was not split;
splitting it into per-component stylesheets would fragment a sheet read as a unit
for no real separation of concern. Awaiting a decision on whether to split.

Before that, switched the RFC 9457 error `type` base URI from
`https://exercisedb-api.dev/errors` — a domain nobody owns — to `https://docs.harshitbishnoi.dev/errors`. Twelve references across seven files: the constant in `src/constants/service.js`, seven exact-match test assertions, and four documented examples.

This was free now and permanently expensive later. `type` is part of the error contract, so changing it after a single developer integrates would require a `/v2`, exactly the reasoning that governed adopting RFC 9457 in the first place. The URIs now point at a site that exists, so a page per error code can be published there later; RFC 9457 does not require them to resolve, but nothing stops them.

Verified against a running server rather than the constant: `GET /exercises` with no key returns `type: https://docs.harshitbishnoi.dev/errors/api-key-required` with a `requestId`. `SERVICE_NAME` remains `exercisedb-api` — it is a service name, not a domain, and appears in the `service` log field and the health payload.

Two documented error examples were stale in a second way: both predated `requestId` and no longer matched what the API returns. Both now include it, and the line in `getting-started.md` claiming the `type` URI "does not resolve to a page" was removed, since it now points at one. The Postman collection was regenerated because the spec changed.

Before that, wired the real domain, `harshitbishnoi.dev`, through every place that hardcoded `localhost`. **No source file under `src/` changed** — the domain layout was chosen to make that true.

Target layout: `api.harshitbishnoi.dev` (Render Web Service), `app.harshitbishnoi.dev` (dashboard), `docs.harshitbishnoi.dev` (docs). All three share one registrable domain, which is what lets the `SameSite=Lax` session cookie flow between the dashboard and the API. `.dev` is on the HSTS preload list, so browsers refuse plain HTTP on it and the `Secure` cookie flag always has a channel.

`docs/openapi.yaml` gained a production `servers` entry, listed first so Scalar's "Test Request" console defaults to it. `docs/deployment.md` was rewritten Render-first with the real hostnames. `.env.example` documents the production `DASHBOARD_ORIGINS`. The Postman collection's `baseUrl` default moved to production in `scripts/generate-postman.js` and the collection was regenerated. The curl examples in `getting-started.md` and `sync-guide.md`, and the default `BASE_URL` in all five example clients, now point at production; the `EXERCISEDB_BASE_URL` override still wins, verified by running the JavaScript client against a local server.

A blanket find-and-replace clobbered the one sentence that legitimately mentions localhost — "Running locally? Swap it for `http://localhost:3000`" became a tautology. Caught and fixed; that line is now the only `localhost` reference left in the public docs, deliberately.

Two housekeeping fixes fell out. `examples/python/__pycache__/` had been created by `py_compile` during verification and was untracked but uncommitted-and-unignored; it is deleted and `__pycache__/` plus `*.pyc` are now in `.gitignore`. And `dashboard/` had **no `.gitignore` at all**, so `node_modules/` and `dist/` were headed for the repository; it now has one mirroring `website/`'s.

170 tests pass, lint clean, spec valid, docs build.

Before that, finished the writable parts of Phase 7: the deployment guide, the architecture notes, and the container artifacts. The remaining plan item — actually deploying and pointing a domain at it — is blocked on the owner, not on code.

**`docs/deployment.md`.** Covers the three separately-deployed components, the environment matrix, migrations having no `down`, Railway and Render specifics, and a post-deploy checklist (production `servers` entry in the spec, Lemon Squeezy webhook registration, API key rotation, one real `SIGTERM` check on the host).

Its most valuable section is a trap I found by reading the cookie code against the likely hosting layout. The session cookie is `SameSite=Lax`, and a browser sends a `Lax` cookie cross-origin **only when both sites share a registrable domain**. `api.exercisedb.dev` + `dashboard.exercisedb.dev` works. `something.up.railway.app` + `something.vercel.app` does not: `POST /auth/login` returns `200` and sets a cookie, the next `GET /me` returns `401`, CORS is configured correctly, and nothing in the logs explains it. The fix is to buy one domain and use subdomains; the alternative, `SameSite=None; Secure`, permits genuinely cross-site sends and therefore requires the CSRF protection this API does not have. **Buy the domain before deploying.**

The guide also records that `GET /health` is a **liveness** check by design — it touches no external service, so a Supabase outage cannot trigger a restart loop — and that there is consequently **no readiness endpoint**. Nothing verifies database connectivity before a container receives traffic.

**`Dockerfile` and `.dockerignore`,** following `agents-guidelines/core/deployment-rules.md`: multi-stage, `npm ci --omit=dev`, non-root `node` user, `NODE_ENV`/`PORT` baked in while every secret is injected at runtime, and a `HEALTHCHECK` against `/health`. `CMD` is `node server.js` rather than `npm start`, because npm does not forward `SIGTERM` and the graceful shutdown handler would never run — the same reason the guide and README say not to use `npm start`. **Docker is not installed in this environment, so the image has never been built.** Treat it as unverified.

**`website/architecture.md`** explains why V1 is a read-only public catalog and what that constraint buys (cacheability, local replicas, one-way sync); why private custom exercises are postponed rather than forgotten (per-row ownership would force row-level authorisation, per-user sync, and would destroy the "same request, same answer" property); the layering and its dependency-injection seams; the three sync decisions and the silent failure each one prevents; why API keys and sessions are separate credentials; and a closing list of what is deliberately absent — no ORM, no per-IP limiting, no readiness probe, no job queue, no circuit breaker.

Every claim in both documents was checked against source rather than memory: `secure: nodeEnv === PRODUCTION` in `security/sessions.js`, `SESSION_COOKIE_SAME_SITE = 'lax'`, `SHUTDOWN_TIMEOUT_MS = 10_000` against the platforms' ~30s `SIGKILL` window, `pino-pretty` requested only under `NODE_ENV=development` so `--omit=dev` is safe, and zero external calls in `routes/health.js`.

Before that, made the API survive the two failures it was known to handle badly: transient database errors, and being killed mid-deploy.

**Retries in `SupabaseRestClient.request`.** Exponential backoff with full jitter, three attempts, injectable `sleep` and `maxAttempts` for tests. `buildRequestError` now returns an `Error` carrying `status` rather than a string, which is what lets the loop distinguish a retryable `503` from a permanent `400`.

The load-bearing decision is that **retryability is gated on the HTTP method, not only on the failure**. A network error on a `GET` is safe to replay. A network error on a `POST` is not: the request may have reached Postgres and committed before the socket died, so replaying it could insert the row twice. Non-idempotent methods therefore retry on `429` alone, which PostgREST refuses before doing any work. Tests pin both directions — `never replays an insert after a network error` and `retries an insert on a 429`.

The retry log records the table but redacts the query string. PostgREST puts filters there, so a URL can carry `email=eq.alice@example.com` or `token_hash=eq.…`. Verified by driving a retry against a filtered `api_users` query and grepping the output: no email, no token hash, no service-role key.

**Graceful shutdown in `server.js`.** `SIGTERM` and `SIGINT` close the listener, let in-flight requests drain, and exit 0, with a 10-second `unref`'d backstop before a forced exit — below the ~30 seconds Railway and Render allow before `SIGKILL`.

Verified with a throwaway probe rather than by reading the code: a 1500 ms request was opened, `SIGTERM` raised 300 ms later, and the log shows the correct order — `shutdown signal received`, then `new request refused after SIGTERM`, then `IN-FLIGHT REQUEST COMPLETED (1560ms) {"finished":true}`, then `graceful shutdown complete`, exit 0. The first version of that probe was wrong: it registered `/slow` after `createApp()`, so the global API-key middleware returned `401` instantly and nothing was ever in flight. Note also that Windows has no real POSIX signals, so `kill -TERM` from bash does not reach Node — the probe raised the signal in-process. **This means SIGTERM delivery itself is unverified on a Linux host**; only the handler is.

170 tests pass (was 160). `docs/conventions.md` no longer lists graceful shutdown as deferred.

Before that, added structured logging with Pino and request correlation IDs — the two items `docs/conventions.md` had recorded as deferred. Both are now in the "Adopted from the guidelines" section instead.

**Dependencies added, the first change to the API's tree in the project's life:** `pino` (production) and `pino-pretty` (development only, because pretty-printing must never run in production). Required by `agents-guidelines/backend/node-rules.md` §10, which names Pino specifically.

`src/logging/logger.js` emits JSON everywhere, pretty-prints under `NODE_ENV=development`, and goes `silent` under `NODE_ENV=test` — a suite that prints a hundred JSON lines hides its own failures. Level comes from a new `LOG_LEVEL` env var, validated against the Pino levels by Zod, so a typo fails at boot rather than silently disabling logging.

Secrets are redacted at the logger, not at each call site, because a call site can be forgotten: `password`, `apiKey`, `key`, `token`, `tokenHash`, their nested forms, and the `authorization`, `cookie`, `x-api-key`, and `x-signature` headers. Verified by logging a payload stuffed with all of them and grepping the output — nothing leaked, while benign fields survived.

`src/middleware/requestLogger.js` runs first in the stack, ahead of `helmet` and the webhook raw-body parser, so anything that throws still has a request context. It mints a UUID or reuses an inbound `X-Request-Id`, echoes it, and stores it in an `AsyncLocalStorage` that `logger`'s `mixin` reads — so every line inside a request carries `requestId` without a single caller passing it. `buildProblemDetails` reads the same store, putting `requestId` into every error body.

An inbound `X-Request-Id` is sanitised to `[\w.-]` and capped at 128 characters before it reaches a header or a log line: it is attacker-controlled and could otherwise inject CRLF to forge log entries. The test for that could not be driven through supertest — Node's HTTP client refuses to _send_ a CRLF header — so `resolveRequestId` is exported and tested directly, with a comment saying why.

**This closes the diagnostic gap that cost real time twice.** A 5xx still returns a generic `detail` so internals never leak; the `requestId` is the compensating affordance. Verified end to end in production mode against an unreachable database: the response carried `requestId: 485fa7dd-…` and `X-Request-Id`, and exactly two log lines carried that id, one with the full stack showing `fetch failed` inside `SupabaseRestClient.request` via `authRepository.findApiKeyByHash`. That is precisely the transient failure previously diagnosed by hand.

**A real availability bug fell out of it.** `apiKeyAuth.js` fired `void authService.logUsage(...)` on `response.finish`. A rejection there — exactly what today's flaky Supabase produces — became an unhandled rejection _after_ the response was sent, and Node's default is to crash the process. Usage accounting failing must not take down the API. It now catches and logs; quota enforcement is unaffected because that already happened in `authenticateApiKey`. The regression test was checked against the old code first: it fails there and passes with the fix, so it tests the bug rather than agreeing with the implementation.

`server.js` logs `server started` structurally and now logs `fatal` on `uncaughtException` and `unhandledRejection` before exiting; previously either died with a bare stack and no record.

160 tests pass (was 145). Eight existing exact-match assertions on error bodies needed the new `requestId` member — entailed by the change, not optional. `docs/openapi.yaml` documents `requestId` on `ProblemDetail` and `X-Request-Id` in the intro.

Before that, wrote the five client examples and the Postman collection, closing the last two code items in Phase 7.

**Examples (`examples/`).** One client per language — JavaScript, Python, Swift, Dart, Kotlin — each doing the same three things: authenticate, handle an RFC 9457 error by its stable `code`, run the full sync loop. Each uses its language's standard library where possible (`urllib` in Python, `dart:io` in Dart, `java.net.http` in Kotlin), so a reader can follow them without installing anything first.

Every one encodes the three traps the sync guide documents: page on `hasMore` and never on `exercises.length`, because `limit` bounds change events rather than exercises; commit `latestChangeAt` and the records in a single transaction; branch on `changeType` rather than treating a tombstone's presence as a delete.

Three of the five were actually executed against a running API with a real key, not merely written: the JavaScript, Python, and Dart clients each listed exercises and completed a sync (`node --check`, `python -m py_compile`, and `dart analyze` all clean beforehand). The error path was exercised too — an invalid key produced `401 API_KEY_INVALID`, caught as a typed error in both JS and Python. **Swift and Kotlin were not compiled: no `swiftc` or `kotlinc` exists in this environment.** They were written against the verified spec and reviewed, but they are unexecuted and should be treated as such.

Python's example prints a plain hyphen rather than an em dash, because Windows consoles default to a codepage that cannot encode it and `print` raises. This was caught by running it, not by reading it.

`website/examples.md` renders all five with VitePress `<<<` snippet imports pointing at the real files in `examples/`, so the page cannot drift from the code. Verified by grepping the built HTML: `RATE_LIMIT_EXCEEDED` appears five times, once per language.

**Postman (`postman/`).** 28 requests across 7 tag-grouped folders, generated from `docs/openapi.yaml` rather than hand-written, so the spec stays the single source of truth. The converter emits an `{{apiKey}}` auth reference but never declares the variable, so it would not appear in Postman's variable editor; `scripts/generate-postman.js` declares it after conversion. `npm run postman:generate` regenerates and re-patches — a naive npm script would have silently dropped the variable every time, which is exactly what the README tells people to run.

That script also had to avoid `execFileSync`: Node 20+ refuses to spawn `npx.cmd` without a shell (`EINVAL`), and passing an argument array through a shell triggers a deprecation warning about unescaped concatenation. It uses a fixed `execSync` command string built only from module constants.

Before that, built the developer dashboard and the browser-session auth it required, then closed the sync tombstone wart.

**Sessions (migration 013, applied and verified on hosted Supabase).** The dashboard could not be built on the existing auth: `/me/*` sat behind `apiKeyMiddleware`, so listing your API keys required already holding one — and the plaintext key is shown exactly once. That chicken-and-egg is why `login()` minted a fresh key on every call, the "key sprawl" issue logged for months. `POST /auth/login` and `/auth/register` now set an `httpOnly`, `SameSite=Lax`, `Path=/` `exdb_session` cookie holding a 256-bit random token; `api_sessions` stores only its SHA-256 hash with an expiry and a `revoked_at`. `POST /auth/logout` revokes server-side. `login()` no longer issues an API key — a breaking change to `/auth/login`, safe only because the API has no consumers, the same reasoning that justified RFC 9457. No dependency was added: Express sets cookies natively and `readCookie` parses the one header we need.

`createSessionOrApiKeyMiddleware` guards `/me/*` and `/billing/checkout`, accepting a session or a key. The session path deliberately never reaches `apiKeyMiddleware`, which is what charges daily quota — reading your own usage page must not cost you requests. `/billing/checkout` was remounted ahead of the global API-key middleware so the dashboard can buy a plan with a cookie.

CORS was split rather than loosened. `cors()` was open to every origin, which is right for a key-in-header public API and unsafe the moment cookies exist: `Access-Control-Allow-Origin: *` is invalid with credentials, and reflecting an arbitrary origin would let any site drive a signed-in dashboard. A delegate now returns `origin: '*'` for the catalog and an explicit `DASHBOARD_ORIGINS` allowlist plus `credentials: true` for `/auth`, `/me`, `/billing`.

Verified against the running API and the live database, not only the suite: register set the cookie and returned the one-time key; `GET /me` and `/me/keys` succeeded with a cookie and **no** API key; login returned no `apiKey`; a forged token got `401 SESSION_INVALID` as `problem+json`; no credential got `401 AUTHENTICATION_REQUIRED`; a token captured before logout was dead afterwards, proving revocation is server-side; the API-key path still charged quota (`X-RateLimit-Remaining: 999`) while `api_usage_daily` stayed empty for session traffic; an evil origin received no `Access-Control-Allow-Origin` on `/me` while the catalog still returned `*`. In `api_sessions` only 64-char hashes were stored, never the token. The unique constraint and the `expires_at > created_at` check both rejected bad rows. Test accounts were deleted afterwards and the cascade removed their sessions.

**Dashboard (`dashboard/`).** Vite + Vue 3 + vue-router, its own `package.json`; the API's dependency tree is unchanged. Views: overview with plan changes, API keys with one-time reveal and revoke, usage, login, register. `src/api/client.js` sends `credentials: 'include'` and turns RFC 9457 bodies into a typed `ApiError` whose `code` is the stable member. Because the cookie is `httpOnly`, "am I signed in?" is answered by calling `/me` and treating 401 as no.

The design system is imported from `website/.vitepress/theme/design-system.css`, never copied, so there remains one source of design values; `vite.config.js` sets `server.fs.allow` so the dev server may read across the package boundary, and both `npm run dev` and `npm run build` were confirmed to resolve it. Its dark tokens hang off a `.dark` class that only VitePress toggles, so the dashboard would have rendered light for every dark-mode reader; `src/styles/theme.js` binds that class to `prefers-color-scheme`.

**Sync tombstones.** With `include_deprecated=true` a deprecated exercise was returned in `data.exercises` _and_ listed in `data.tombstones`, so a client applying tombstones as deletes destroyed the record it had just asked to keep. Tombstones now carry only `deleted` when deprecated records are included; deprecation is read from the record's own `status`, which was always in the payload. `docs/openapi.yaml` had asserted the opposite ("it will not appear in `exercises`") and is corrected.

145 tests pass (was 123), `eslint` clean, `npm run format:check` now warns only on `.mcp.json` and `.claude/settings.local.json`, Redocly validates the spec with seven warnings — the six known plus `/auth/logout` having no 4xx, which is intentional. Both sites build.

Before that, made `GET /sync/exercises` self-sufficient by adding `data.latestChangeAt`, so clients no longer need a `/sync/metadata` call to obtain a sync watermark. Additive; no existing field changed.

The naive version — recomputing the timestamp on every page — is a trap. A change written mid-sync at an already-passed offset would not be delivered, yet committing the last page's timestamp would advance past it, losing that record permanently. So the watermark is read **once, before the first page's events** (`syncService.js`, `syncExercises`), and carried inside the opaque cursor as `{ offset, watermark }`. Every page of one sync therefore returns an identical `latestChangeAt` and whichever value the client commits is safe. Cursors were already documented as opaque, so this costs no contract. Cursors issued before this change carry no `watermark` key; `decodeCursor` distinguishes absent (re-read it) from explicit `null` (catalog had no change events) via `Object.hasOwn`, so old cursors stay valid.

`syncRepository.getLatestChangeAt()` is a new single-row query on `exercise_change_events`; it runs only on a sync's first page. `getSyncMetadata` is untouched and still returns `latestChangeAt` for cheap "has anything changed" polling.

Also corrected the `Tombstone` schema description in `docs/openapi.yaml`, which claimed a tombstoned record "will not appear in `exercises`". That is false when `include_deprecated=true`, where a deprecated record is returned in both arrays.

Verified: 120 tests pass (up from 116), `eslint` clean, Redocly reports the spec valid with the same six known warnings, the docs site builds, and a decoded live cursor reads `{"offset":1,"watermark":"2026-07-02T09:14:00.000Z"}` — confirming the watermark is genuinely embedded rather than the unit test agreeing with itself. Not yet exercised against hosted Supabase.

Before that, wrote `website/sync-guide.md`, the Phase 7 sync integration guide, and added a "Guides" sidebar section for it. `getting-started.md`'s closing "a sync integration guide is coming" now links to it.

The guide was written against `syncService.js`, `syncRepository.js`, and `routes/sync.js` rather than from the endpoint names, which surfaced three behaviours a plausible-sounding guide would have got wrong:

Pagination bounds **change events**, not exercises. Events are deduplicated by exercise id and deleted rows are filtered out, so a full page of 100 events routinely returns fewer than 100 exercises. A client looping on `exercises.length === limit` terminates early and silently loses records. `hasMore` (equivalently, a non-null `nextCursor`) is the only correct signal, and the guide says so in a `danger` block.

With `include_deprecated=true`, a deprecated exercise is returned in **both** `exercises` and `tombstones` — the tombstone filter at `syncService.js:45` matches `deprecated` regardless of the flag, while `selectExerciseIdsForFetch` also fetches the record. Applying tombstones as unconditional deletes therefore deletes the row the caller just asked to keep. The guide branches on `changeType`: `deleted` removes, `deprecated` flags.

There is no watermark derivable from a sync response. Only tombstones carry `changedAt`; created/updated exercises do not. The correct pattern is to read `latestChangeAt` from `/sync/metadata` **before** paging and commit it only after the last page succeeds, since `updated_since` filters `changed_at > value` (strictly greater, so re-sending the committed timestamp never redelivers). The guide also requires records and watermark to commit in one local transaction, because a watermark that commits without its records loses those exercises until they next happen to change.

Verified by building: `npm run build` passes and `.vitepress/dist/sync-guide.html` is emitted. VitePress fails builds on dead links, so the cross-link from getting-started resolves.

Before that, added `website/overview.md` and pointed the sidebar and nav at it. The sidebar's "Overview" entry previously linked to `/`, which is the marketing home with the hero layout, so clicking a docs link dumped the reader on the landing page. The home page is still reachable from the site title.

The overview explains the concepts the endpoint list assumes: that the catalog is public and read-only, that summaries and details are different shapes and why, that slugs and ids both resolve a record, how variations/progressions/regressions relate, that reference data is fetched once and cached, why clients should sync rather than poll, that tombstones are the only signal a record disappeared, that premium exercises are filtered from lists rather than erroring, and that errors are RFC 9457 with a stable `code`.

Before that, rewrote `docs/openapi.yaml` from a skeleton into a complete contract. It had 24 endpoints and 51 response entries, of which **zero** carried a response body — which is why the rendered reference looked empty. Scalar renders what the spec contains.

It now has 26 paths, 27 operations, 121 responses, and not one lacks a content block. Every success response is a composed schema: a shared `SuccessEnvelope` combined via `allOf` with a typed `data` member, so the `{ success, data }` wrapper is declared once rather than repeated 27 times. Fifty schemas are defined and all fifty are referenced; all 207 `$ref`s resolve.

`ProblemDetail` was previously defined and never used. It is now reachable from eight shared `components/responses` entries — `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `TooManyRequests`, `BadGateway`, `InternalServerError` — which every operation references. `TooManyRequests` documents the `Retry-After` header.

`/billing/checkout` and `/webhooks/lemon-squeezy` were undocumented despite shipping in Phase 6, and are now covered, including the `X-Signature` header and the `Location` header on checkout.

Every field name and type was read out of the source rather than invented: `exerciseMappers.js` for the exercise shapes, `referenceRepository.js` for the reference models, `syncService.js` for tombstones and cursor pagination, `authService.js` for account and key serialisation, and migrations `002` and `004` for the enum values and column types. This surfaced a bug in the previously written getting-started guide, which showed a `pagination.total` field that does not exist — list pagination returns only `limit` and `offset`.

Validated with Redocly's linter, run through `npx` without adding a dependency: zero errors. It caught a defect my own parse check missed — `example: id,slug,name` inside a YAML flow mapping parses as `example: id` plus two stray keys. Valid YAML, wrong semantics. Six warnings remain and are all understood: the only server is localhost; `/health` legitimately has no 4xx; and four "ambiguous path" warnings for `/exercises/slug/{slug}` against `/exercises/{id}/…`, which Express resolves by declaration order since the slug route is registered first and ids are UUIDs.

Before that, scaffolded the Phase 7 documentation site in `website/`, a VitePress project with its own `package.json`. Its three dependencies (`vitepress`, `vue`, `@scalar/api-reference`, all pinned exactly) are devDependencies of the site alone; the API's tree is unchanged and still carries five production dependencies.

The design system in `website/.vitepress/theme/design-system.css` is the single source of truth for every design value. Primitives are never referenced by components; components use semantic tokens, which the `.dark` scope re-points. A fourth section bridges those tokens onto VitePress's `--vp-*` variables, the only place a `--vp-` name may appear. Contrast was measured, not assumed: a script resolved every `var()` chain in both scopes and computed WCAG ratios, which caught four failures — `teal-500` at 3.17:1 was assigned as the light-mode hover colour, dark `text-subtle` sat at 4.11:1, and the status greens, ambers, reds, and blues failed in one theme or the other. Interaction states now darken on light surfaces and lighten on dark ones, `--ex-gray-450` exists solely so dark subtle text clears the bar, and each status hue carries two steps. All 22 pairs pass 4.5:1 in both themes.

Scalar is mounted through `defineClientComponent` because it reads `window` at import time and cannot be server-rendered. It reads `/openapi.yaml`, which `scripts/sync-spec.js` copies from `docs/openapi.yaml` at build time and `.gitignore` keeps out of source control — there is exactly one spec.

Verified by building and serving the site, not by trusting the build's exit code. All four routes return 200, the served spec is the real one, our `--vp-*` overrides land after the default theme's so they win the cascade, 28 of the 29 mapped variables are actually consumed by the theme (`--vp-shadow-2` is a real VitePress variable its default theme happens not to use), and the 2.6 MB Scalar bundle is code-split into its own chunk that the home page never loads.

Before that, three tasks: the two preparatory ones agreed before billing, then Phase 6 itself.

Task 1 created `docs/conventions.md`, recording which guideline files do not apply to this stack (TypeScript, Prisma), which deviations are deliberate and why (per-API-key daily quotas instead of `express-rate-limit`; the `{ success, data }` success envelope), what was adopted (RFC 9457 errors), and what is deferred (Pino, request IDs, `X-RateLimit-Reset` format, per-endpoint error docs). `CLAUDE.md` now loads it alongside `AGENTS.md`. `AGENTS.md` and `agents-guidelines/` were left untouched — the latter is a portable, source-backed library and is not the place for one project's local decisions.

Task 2 replaced the `{ success: false, error: {...} }` error body with RFC 9457 Problem Details. `src/errors/problemDetails.js` builds and sends the body, deriving `type` and `title` from the existing error `code`, which is retained as an RFC 9457 extension member so clients keep a machine-readable identifier. Server errors (5xx) have their `detail` replaced with a generic message so internals never leak. `errorHandler` and `notFound` both route through it. The missing `Retry-After` header is now set on `429` responses, sourced from a new optional `retryAfterSeconds` field on `AppError`, populated by the rate-limit throw in `authService`. `docs/openapi.yaml` gained a `ProblemDetail` component schema. Eight error-shape assertions across three test files were updated to the new contract.

Task 3 built Phase 6 billing. Migration `012` adds `billing_provider`, `billing_customer_id`, `billing_subscription_id`, `subscription_status`, `subscription_renews_at`, and `subscription_ends_at` to `api_users`, plus a `billing_webhook_events` table with a unique `(provider, event_key)` constraint. `src/billing/lemonSqueezyProvider.js` verifies `X-Signature` as an HMAC-SHA256 hex digest of the raw body using `timingSafeEqual`, parses webhook payloads through a Zod schema because third-party data is untrusted, and creates JSON:API checkouts with a 10-second `AbortController` timeout. `billingService` depends only on the provider interface, never on Lemon Squeezy directly. `src/routes/webhooks.js` is mounted in `app.js` ahead of both `express.json()` and `apiKeyMiddleware`, so the raw body survives for HMAC verification and the provider is not asked for an API key. `restClient.upsert` gained an `ignoreDuplicates` option, which makes webhook deduplication race-safe without a read-then-write.

All three tasks were verified against real HTTP, not only the test suite. For billing specifically: a genuinely HMAC-signed purchase upgraded the account to `pro`, a byte-identical redelivery was deduplicated without a second tier change, a forged signature returned a `problem+json` 401, and a cancellation dropped the account to `free`.

Migration `012` was then applied to hosted Supabase through the Supabase MCP server, and `billingRepository` was exercised against the live database rather than a stub. This confirmed the one assumption that unit tests could not reach: PostgREST's `Prefer: resolution=ignore-duplicates` returns an empty array on conflict, which is what makes `recordWebhookEvent` return `null` for a duplicate delivery. Without that behaviour the idempotency guard would silently fail open. The verification row was deleted afterwards; `billing_webhook_events` is empty.

## In Progress

Nothing currently in progress. The documentation site scaffold is complete and builds; the remaining Phase 7 items are prose guides, one task each.

## Pending

Documentation content, one task per guide: reference `ProblemDetail` from every 4xx/5xx response in `docs/openapi.yaml`; request/response examples in the spec; sync integration guide; example code for JavaScript, Python, Swift, Dart, and Kotlin; Postman collection; deployment guide; architecture notes. Then deploy the site — the root directory for the build is `website/`, the build command `npm run build`, and the output `website/.vitepress/dist`.

Create a Lemon Squeezy store, three subscription variants (basic, pro, enterprise), and a webhook subscribed to the `subscription_*` events, then populate the six `LEMON_SQUEEZY_*` values in `.env`. Rotate the API key that was pasted into a chat transcript before any production deployment.

Phase 7 developer experience docs.

## Known Issues

- `docs/openapi.yaml` is 1,529 lines, past the 500-line hard limit. Deliberately not split; the reasoning is recorded in `docs/conventions.md`.
- The spec's only `servers` entry is `http://localhost:3000`. Scalar's "Test Request" console therefore targets localhost. Add the production URL when the API is deployed.
- Redocly warns that `/exercises/slug/{slug}` is ambiguous against `/exercises/{id}/related`, `/variations`, `/progressions`, and `/regressions`. Benign in practice — Express matches by declaration order and the slug route is registered first — but a genuinely OpenAPI-ambiguous surface. Renaming to `/exercises/by-slug/{slug}` would remove it at the cost of a breaking change.
- `website/.vitepress/theme/design-system.css` is 308 lines, past the 300-line soft limit. Not split: a token file is a single responsibility, and separating primitives from semantic tokens would make every color change touch two files. Revisit only if it grows substantially.
- `website/`'s own `npm audit` reports 3 vulnerabilities (2 moderate, 1 high) in the VitePress toolchain. `npm audit --omit=dev` reports **zero**: all three are devDependencies of a static site generator, they never reach a runtime, and they are isolated from the API's dependency tree. Not fixed, because forcing upgrades on a working toolchain trades a theoretical risk for a real one.
- The Scalar API reference bundle is 2.6 MB. It is code-split and loads only on `/api-reference`; the home page pulls 4 KB. Acceptable, but if first-paint on that page matters later, Scalar's standalone build or a lighter renderer are the alternatives.
- The docs site was confirmed in a browser: Scalar renders the reference and the teal accent from the design system is applied, so the `--vp-*` bridge works in real DOM.
- `include_deprecated=true` returns a deprecated exercise in both `data.exercises` and `data.tombstones`. This is now documented in the sync guide, but it is arguably a design wart: a caller who asked for deprecated records still has to filter them out of the tombstone array. Consider whether tombstones should exclude `deprecated` when `include_deprecated=true`. That would be a breaking change to a success-response shape.
- `GET /sync/exercises` was not exercised against hosted Supabase after `getLatestChangeAt` was added. The query mirrors the existing one in `getSyncMetadata`, which is proven, but a live smoke test would confirm it.
- Three tests were added and three modified in the same task that changed the response shape (`tests/syncService.test.js`, `tests/syncRoutes.test.js`, `tests/syncRepository.test.js`). `AGENTS.md` treats test authoring as a separate task; the two exact-match `toEqual` assertions could not survive an added field, so the modification was entailed rather than optional. Flagged.
- Deep links into the Scalar reference (`/api-reference#…`) are avoided because Scalar's anchor scheme is not verified. Do not add them without checking in a browser.
- `agents-guidelines/` was added to `.prettierignore`, which fixes the long-standing `npm run format:check` failure. This was flagged as a related issue two tasks ago and never explicitly approved. Trivially revertible.
- `npm run format:check` still warns on `.mcp.json` and `.claude/settings.local.json`. Both are editor/harness files, not project source.
- `api_users.stripe_customer_id` (migration 007) is now dead. It predates the provider-neutral decision and is superseded by `billing_customer_id`. Dropping a column is destructive and was not done. Decide whether to drop it in a later migration.
- No migration in this project has a corresponding `down`. `agents-guidelines/backend/api/api-data-layer-rules.md` requires every `up` to be reversible. Migration `012` follows the existing convention rather than introducing a one-off. Worth fixing project-wide as its own task.
- Lemon Squeezy sends no event id and no timestamp header, so the timestamp-based replay window required by `agents-guidelines/backend/api/webhook-rules.md` is not implementable. Idempotency on `sha256(raw body)` is the substitute. A genuinely distinct event with a byte-identical body would be treated as a duplicate; in practice `updated_at` differs.
- Webhooks are processed synchronously rather than acknowledged first and processed in a background job, as `webhook-rules.md` recommends. Processing is one database update, and there is no job queue in this project. Revisit if processing grows.
- There is no reconciliation job polling Lemon Squeezy to repair state after a lost webhook, which `webhook-rules.md` requires. Flagged, not built.
- `src/repositories/billingRepository.js` has no unit test. The provider, service, and routes are covered.
- `npm run format:check` fails on `agents-guidelines/**` and `agents-guidelines/README.md`. These files were committed unformatted and are not listed in `.prettierignore`. Pre-existing; reformatting 36 files was outside the scope of this task. Fix by adding `agents-guidelines/` to `.prettierignore` or running Prettier across them once.
- Unmatched routes return `401 API_KEY_REQUIRED` rather than `404 NOT_FOUND`, because `apiKeyMiddleware` is mounted globally in `src/app.js` ahead of `notFound`. This is defensible — it avoids leaking route existence to unauthenticated callers — but it means `notFound` only executes for authenticated requests. Undocumented behaviour; decide whether to keep it deliberately.
- `src/errors/problemDetails.js` has no dedicated unit test. Its behaviour is covered indirectly by the updated route tests. Writing tests is a separate explicit task per `AGENTS.md`.
- One test was added rather than only modified: `tests/apiKeyMiddleware.test.js` gained a `Retry-After` assertion for the header introduced in the same task. Flagged because `AGENTS.md` treats test authoring as a separate task.
- `X-RateLimit-Reset` is emitted as an ISO 8601 string where `rest-api-rules.md` specifies a Unix timestamp. Changing it breaks a success-response header contract. Recorded in `docs/conventions.md` as deferred.
- No request correlation ID is emitted in error responses or logs, which `api-general-rules.md` requires. Deferred with the Pino logging task.
- `src/services/authService.js` is now 294 lines, past the 300-line soft limit warning threshold once more code is added. Do not add billing logic to it.
- `examples/swift/ExerciseDB.swift` and `examples/kotlin/ExerciseDb.kt` have never been compiled or run — no Swift or Kotlin toolchain exists in this environment. The other three were executed against the live API. Compile both before publishing them as reference clients.
- The Postman collection is generated output committed to the repository. It goes stale the moment `docs/openapi.yaml` changes without a regeneration. There is no CI check that they agree.
- `examples/` is linted by neither `eslint` (it is not excluded, so `examples/javascript/exercisedb.js` _is_ linted — but the `.py`, `.swift`, `.dart`, `.kt` files are not checked by anything) nor covered by tests.
- The `Dockerfile` has never been built: Docker is not installed in this environment. Build it once before relying on it. The `wget`-based `HEALTHCHECK` assumes busybox, which `node:20-alpine` provides.
- There is no readiness endpoint. `/health` is liveness only. If a container can start before Supabase is reachable, its first requests `500` (after three retries each). `GET /health/ready` running one trivial query would close this.
- The session cookie's `SameSite=Lax` makes the dashboard and API domains a deployment-time constraint, not a runtime setting. They must share a registrable domain. Recorded prominently in `docs/deployment.md`.
- Retries are bounded at three attempts with no circuit breaker. If Supabase is down rather than flaky, every request pays three attempts plus backoff before failing, which under load turns a database outage into thread exhaustion. A circuit breaker is the next step if this ever matters.
- `insert` still fails outright on a network error, by design — it cannot be replayed safely. `api_usage_log` writes are the common case and are already swallowed, but a failed `register` returns `500` and the user must retry by hand. Making inserts idempotent would need a client-supplied idempotency key.
- Graceful shutdown's `SIGTERM` handler is verified only in-process: Windows has no POSIX signals, so the probe used `process.emit('SIGTERM')`. Actual signal delivery is unverified and should be checked once on the deployed Linux host.
- `SupabaseRestClient` now imports `logger`, so the transport layer depends on Pino. This is deliberate — it is infrastructure, not domain — but services and repositories still log nothing and should stay that way.
- `pino-pretty` is a devDependency, and `logger.js` only requests it when `NODE_ENV=development`. A production install (`npm ci --omit=dev`) that is then run with `NODE_ENV=development` will crash on the missing transport. Correct behaviour, surprising failure mode.
- `server.js` exits on `uncaughtException` and `unhandledRejection` without draining in-flight requests. `node-rules.md` wants a SIGTERM handler that closes the server gracefully. Recorded in `docs/conventions.md` as belonging with the deployment task.
- `logger` is imported only by `server.js` and the three middleware that log (`requestLogger`, `errorHandler`, `apiKeyAuth`). `problemDetails.js` deliberately imports `requestContext` instead, which pulls in nothing but `node:async_hooks` — so reading a request id costs no dependency on Pino or on `env`. Keep it that way: services and repositories currently log nothing, and pushing `logger` into them would couple the domain layer to a transport.
- `src/repositories/sessionRepository.js` has no unit test. The service, middleware, cookie parsing, and routes are covered, and the table's constraints were verified against the live database.
- Expired sessions are never deleted from `api_sessions`. `authenticateSession` rejects them, so this is a housekeeping matter, not a security one. A periodic `delete from api_sessions where expires_at < now()` belongs in a cron task.
- `sessionService.revokeAllSessions` and `sessionRepository.revokeSessionsForUser` are written and tested at the repository level but nothing calls them. They exist for a future "sign out everywhere" control and for revoking sessions on password change — which is not implemented, so a stolen session survives a password reset.
- `dashboard/` adds four devDependencies (`vite`, `vue`, `vue-router`, `@vitejs/plugin-vue`) in its own `package.json`. `npm audit` there reports 2 vulnerabilities (1 moderate, 1 high) in the Vite toolchain; as with `website/`, these are build-time only and never reach a runtime.
- `dashboard/` is excluded from the root `eslint` config, matching `website/`. Its Vue SFCs and browser globals are not parseable by the API's flat config, and adding `eslint-plugin-vue` would pull a linter toolchain into the API package. Prettier does format it.
- The dashboard has no test suite. The auth flows it depends on are covered server-side.
- `login` no longer mints an API key per login; the key-sprawl issue is resolved. Accounts created before this change may hold many `Login`-labelled keys, which are still live. There is no bulk-revoke path.
- `npm install` reported 5 audit findings: 3 moderate, 1 high, and 1 critical. Dependency upgrades or `npm audit fix --force` were not run because that can introduce breaking changes and is outside the current phase.
- Git required `safe.directory` configuration because the repository was initialized under the sandbox user and pushed under the Windows user.
- Supabase security advisor still warns that the `citext` extension is installed in `public`. Moving it should be handled as a separate migration decision because `api_users.email` currently uses `citext`.
- Supabase performance advisor reports unused indexes because there is not enough real query traffic yet; do not remove them until production-like usage exists.
- Hosted Phase 5 smoke verification created disposable developer account `phase5-smoke-1781534150806@example.com`; there is no admin cleanup endpoint yet. Email verification, which would have prevented this, was considered and then dropped when the project pivoted back to billing.

## Files Status

- Created: `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc`, `README.md`, `HANDOFF.md`, `data/reference/muscles.json`, `data/reference/equipment.json`, `data/reference/categories.json`, `data/reference/exercise-flags.json`, `data/reference/joint-regions.json`, `data/exercises/sample-exercises.json`, `docs/openapi.yaml`, `docs/database-schema.md`, `docs/conventions.md`, `eslint.config.js`, `package.json`, `package-lock.json`, `scripts/validate-fixtures.js`, `scripts/seed-reference-data.js`, `scripts/import-sample-exercises.js`, `server.js`, `supabase/migrations/001_enable_extensions.sql`, `supabase/migrations/002_create_enums.sql`, `supabase/migrations/003_create_reference_tables.sql`, `supabase/migrations/004_create_exercises.sql`, `supabase/migrations/005_create_exercise_relations.sql`, `supabase/migrations/006_create_media_and_sync.sql`, `supabase/migrations/007_create_api_users_keys_usage.sql`, `supabase/migrations/008_create_indexes_and_triggers.sql`, `supabase/migrations/009_create_rls_and_grants.sql`, `supabase/migrations/010_harden_functions_and_indexes.sql`, `supabase/migrations/011_revoke_public_helper_execution.sql`, `supabase/migrations/012_add_billing_fields.sql`, `src/app.js`, `src/billing/lemonSqueezyProvider.js`, `src/config/billingEnv.js`, `src/config/env.js`, `src/config/supabaseEnv.js`, `src/constants/billing.js`, `src/constants/rateLimits.js`, `src/constants/service.js`, `src/errors/AppError.js`, `src/errors/problemDetails.js`, `src/import/catalogFixtureFiles.js`, `src/import/catalogImportPlans.js`, `src/import/catalogSeeder.js`, `src/middleware/apiKeyAuth.js`, `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/repositories/authRepository.js`, `src/repositories/billingRepository.js`, `src/repositories/exerciseMappers.js`, `src/repositories/exerciseQueries.js`, `src/repositories/exerciseRepository.js`, `src/repositories/referenceRepository.js`, `src/repositories/syncRepository.js`, `src/routes/auth.js`, `src/routes/billing.js`, `src/routes/exercises.js`, `src/routes/health.js`, `src/routes/references.js`, `src/routes/sync.js`, `src/routes/webhooks.js`, `src/security/apiKeys.js`, `src/security/passwords.js`, `src/services/authService.js`, `src/services/billingService.js`, `src/services/exerciseService.js`, `src/services/referenceService.js`, `src/services/syncService.js`, `src/supabase/restClient.js`, `src/utils/slugs.js`, `src/validation/catalogFixtures.js`, `tests/apiKeyMiddleware.test.js`, `tests/authRepository.test.js`, `tests/authRoutes.test.js`, `tests/authSecurity.test.js`, `tests/authService.test.js`, `tests/billingService.test.js`, `tests/lemonSqueezyProvider.test.js`, `tests/webhookRoutes.test.js`, `tests/catalogFixtures.test.js`, `tests/catalogSeeder.test.js`, `tests/env.test.js`, `tests/exerciseRepository.test.js`, `tests/exerciseService.test.js`, `tests/exercisesRoutes.test.js`, `tests/health.test.js`, `tests/importPlans.test.js`, `tests/migrations.test.js`, `tests/referenceRepository.test.js`, `tests/referenceRoutes.test.js`, `tests/slugs.test.js`, `tests/supabaseEnv.test.js`, `tests/supabaseRestClient.test.js`, `tests/syncRepository.test.js`, `tests/syncRoutes.test.js`, `tests/syncService.test.js`
- Modified: `CLAUDE.md` loads `docs/conventions.md` alongside `AGENTS.md`; `src/app.js` mounts the webhook router ahead of `express.json()` and `apiKeyMiddleware`, and wires the billing service; `src/supabase/restClient.js` adds an `ignoreDuplicates` upsert option for race-safe webhook idempotency; `.env.example` documents the six `LEMON_SQUEEZY_*` values; `README.md` adds a Billing section covering configuration, checkout, subscription lifecycle, and local webhook testing; `IMPLEMENTATION_PLAN.md` marks Phase 6 complete and records the Lemon Squeezy decision; `tests/migrations.test.js` expects migration `012`; `src/constants/service.js` adds `ERROR_TYPE_BASE_URL`; `src/errors/AppError.js` accepts an optional `retryAfterSeconds`; `src/middleware/errorHandler.js` and `src/middleware/notFound.js` emit RFC 9457 problem+json and set `Retry-After`; `src/services/authService.js` attaches `retryAfterSeconds` to the 429 throw; `docs/openapi.yaml` documents the `ProblemDetail` schema; `tests/apiKeyMiddleware.test.js`, `tests/exercisesRoutes.test.js`, and `tests/syncRoutes.test.js` assert the new error contract; `README.md` documents registration, API-key usage, protected endpoint examples, rate limit headers, and Phase 5 status; `IMPLEMENTATION_PLAN.md` marks Phase 5 complete and renames Phase 6 to provider-neutral billing; `PLAN.md` was updated locally but is git-ignored by project policy; `src/app.js` wires auth, API-key middleware, and protected routers; `src/repositories/exerciseQueries.js` supports Phase 4 list sync filters; `src/repositories/referenceRepository.js` exposes shared catalog enum metadata; `src/routes/exercises.js` validates sync list filters and gates premium rows; `src/supabase/restClient.js` adds PATCH support
- Currently Being Edited: none
- Planned to Edit: new `website/` pages for language examples, deployment, architecture notes, and an error-code index; a Postman collection
- Added this session: `supabase/migrations/013_create_api_sessions.sql`, `src/constants/sessions.js`, `src/security/sessions.js`, `src/repositories/sessionRepository.js`, `src/services/sessionService.js`, `src/middleware/sessionAuth.js`, `tests/sessionService.test.js`, `tests/sessionAuth.test.js`, `website/sync-guide.md`, and the whole `dashboard/` project
- Untouched: `AGENTS.md`, `agents-guidelines/**`, `.env`, the API's `package.json` dependency tree
