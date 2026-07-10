# Deployment

Three things deploy separately: the API, the docs site, and the dashboard. They
share no build.

| Component | Root         | Build           | Output                    |
| --------- | ------------ | --------------- | ------------------------- |
| API       | `.`          | none            | `node server.js`          |
| Docs      | `website/`   | `npm run build` | `website/.vitepress/dist` |
| Dashboard | `dashboard/` | `npm run build` | `dashboard/dist`          |

---

## Before the first deploy

### 1. Apply migrations

There is no migration runner. `supabase/migrations/*.sql` are applied in order
against the hosted project, by the Supabase CLI or the SQL editor. **Migrations
have no `down`** — review each before applying.

The database must be migrated before the API that depends on it goes live.

### 2. Set the environment

Every value below is injected by the platform's secret manager at runtime. None
belongs in the image, in `ARG`, or in git.

| Variable                    | Required    | Notes                                                                   |
| --------------------------- | ----------- | ----------------------------------------------------------------------- |
| `NODE_ENV`                  | yes         | Must be `production`. Controls the `Secure` flag on the session cookie. |
| `PORT`                      | usually     | Most platforms inject it.                                               |
| `LOG_LEVEL`                 | no          | Defaults to `info`.                                                     |
| `SUPABASE_URL`              | yes         |                                                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | yes         | Full database access. Never expose to a browser.                        |
| `DASHBOARD_ORIGINS`         | yes         | Comma-separated. Only these may send the session cookie.                |
| `LEMON_SQUEEZY_*`           | for billing | Six values. The catalog and sync endpoints boot without them.           |

The dashboard needs `VITE_API_BASE_URL` at **build** time — Vite inlines it, so
changing it means rebuilding.

> **`NODE_ENV` must be `production`.** `buildSessionCookieOptions` only sets
> `Secure` when `NODE_ENV === 'production'`. Deploy with anything else and
> session cookies travel over plain HTTP.

---

## The cookie trap: pick your domains before you deploy

The session cookie is `SameSite=Lax`. A browser sends a `Lax` cookie on a
cross-origin request **only if the two sites share a registrable domain**.

```
api.exercisedb.dev  +  dashboard.exercisedb.dev   ✅ same site, cookie sent
exercisedb-api.up.railway.app + exercisedb.vercel.app   ❌ cross-site, cookie dropped
```

In the second case the dashboard will look broken in a way that is hard to read:
`POST /auth/login` returns `200` and sets a cookie, and the very next `GET /me`
returns `401`, because the browser never sent it back. CORS will be configured
correctly and it will still fail.

Two ways out:

1. **Put both on one registrable domain** — `api.` and `app.` subdomains. This is
   the recommended path and needs no code change.
2. Change the cookie to `SameSite=None; Secure` in
   `src/constants/sessions.js`. This permits genuinely cross-site sends and
   consequently requires CSRF protection, which this API does not have.

Option 1. Buy the domain first.

---

## Railway

Three services from one repository.

**API** — root `/`, no build command, start `node server.js`. Do not use
`npm start`: npm does not forward `SIGTERM` to the child, so the graceful
shutdown handler never runs and in-flight requests are severed on every deploy.

Railway builds with Nixpacks by default. To use the committed `Dockerfile`
instead, set the builder to Dockerfile — it pins Node 20, drops devDependencies,
runs as a non-root user, and defines a healthcheck.

Railway sends `SIGTERM` and allows roughly 30 seconds before `SIGKILL`. The
shutdown backstop is 10 seconds (`src/constants/server.js`), comfortably inside
it.

**Docs** — root `website/`, build `npm run build`, publish
`website/.vitepress/dist`.

**Dashboard** — root `dashboard/`, build `npm run build`, publish
`dashboard/dist`, with `VITE_API_BASE_URL` set to the deployed API URL.

## Render

Same shape. The API is a Web Service (`node server.js`); the docs and dashboard
are Static Sites. Render's health check path should be `/health`.

Render's free tier spins a service down when idle. The first request after that
pays a cold start, and a cron ping is the usual workaround.

---

## Health checks

`GET /health` is a **liveness** check. It returns `200` with no authentication
and touches no external service, deliberately: a Supabase outage must not cause
the platform to restart an otherwise healthy container.

There is **no readiness endpoint**. Nothing verifies database connectivity before
a container is sent traffic. If a deploy can start before Supabase is reachable,
the first requests will `500` — retried three times each, then failed. Adding
`GET /health/ready` that runs one trivial query is the fix.

---

## After the first deploy

1. **Add the production server to `docs/openapi.yaml`.** Its only `servers` entry
   is `http://localhost:3000`, so the API reference's "Test Request" console
   targets a machine that is not there. Then rebuild the docs site and
   regenerate the Postman collection (`npm run postman:generate`).

2. **Register the Lemon Squeezy webhook** at
   `https://<api-host>/webhooks/lemon-squeezy`, subscribed to the
   `subscription_*` events, and set `LEMON_SQUEEZY_WEBHOOK_SECRET` to match.
   Until this exists, checkout completes and the tier never changes — the tier is
   updated by the webhook, not by the checkout redirect.

3. **Rotate the Lemon Squeezy API key.** It is an account-level credential, not a
   test key.

4. **Verify `SIGTERM` handling once, on the host.** It has only ever been
   exercised in-process on Windows, which has no POSIX signals. Deploy, tail the
   logs, redeploy, and confirm you see `shutdown signal received` followed by
   `graceful shutdown complete` rather than a bare kill.

---

## Operating it

Logs are JSON. Every line inside a request carries `requestId`, and every error
response carries the same value in its body and in `X-Request-Id`. A `5xx` tells
the caller nothing by design; the request id is how you find the line that has
the stack:

```bash
grep '"requestId":"485fa7dd-..."' | jq .
```

Transient database failures retry three times with backoff before surfacing.
There is no circuit breaker: if Supabase is down rather than flaky, every request
pays three attempts plus backoff before failing.
