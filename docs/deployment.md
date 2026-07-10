# Deployment

Three things deploy separately from one repository. They share no build.

| Component | Root         | Build               | Serves                    |
| --------- | ------------ | ------------------- | ------------------------- |
| API       | `.`          | `npm ci --omit=dev` | `api.harshitbishnoi.dev`  |
| Docs      | `website/`   | `npm run build`     | `docs.harshitbishnoi.dev` |
| Dashboard | `dashboard/` | `npm run build`     | `app.harshitbishnoi.dev`  |

All three sit under one registrable domain. That is a requirement, not a
preference — see [Why the domains matter](#why-the-domains-matter).

---

## Before the first deploy

### Migrations

There is no migration runner. `supabase/migrations/*.sql` are applied in order
against the hosted project, through the Supabase CLI or the SQL editor.
**Migrations have no `down`** — read each one before applying it.

All thirteen are already applied to the current hosted project. A _new_ project
needs them run from `001` in order, before the API that depends on them starts.

### Environment

Every value is injected by Render at runtime. None belongs in the image, in a
Docker `ARG`, or in git.

| Variable                    | Required    | Notes                                                                   |
| --------------------------- | ----------- | ----------------------------------------------------------------------- |
| `NODE_ENV`                  | yes         | Must be `production`. Controls the `Secure` flag on the session cookie. |
| `PORT`                      | no          | Render injects it.                                                      |
| `LOG_LEVEL`                 | no          | Defaults to `info`.                                                     |
| `SUPABASE_URL`              | yes         |                                                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | yes         | Full database access. Never expose to a browser.                        |
| `DASHBOARD_ORIGINS`         | yes         | `https://app.harshitbishnoi.dev`. Comma-separated for more than one.    |
| `LEMON_SQUEEZY_*`           | for billing | Six values. Catalog and sync boot without them.                         |

The dashboard needs `VITE_API_BASE_URL` at **build** time. Vite inlines it, so
changing it means a rebuild, not a restart.

> **`NODE_ENV` must be `production`.** `buildSessionCookieOptions` sets `Secure`
> only when `NODE_ENV === 'production'`. Deploy with anything else and session
> cookies travel over plain HTTP.

---

## Why the domains matter

The session cookie is `SameSite=Lax`. A browser sends a `Lax` cookie on a
cross-origin request **only when both sites share a registrable domain**.

```
api.harshitbishnoi.dev  +  app.harshitbishnoi.dev    same site, cookie sent
exercisedb-api.onrender.com + exercisedb-app.onrender.com   cross-site, cookie dropped
```

In the second case the dashboard fails in a way that is hard to read.
`POST /auth/login` returns `200` and sets a cookie. The very next `GET /me`
returns `401`, because the browser never sent it back. CORS is configured
correctly and it still fails. Nothing in the logs explains it.

Subdomains of `harshitbishnoi.dev` avoid this entirely, with no code change.

The alternative — `SameSite=None; Secure` in `src/constants/sessions.js` —
permits genuinely cross-site sends and therefore requires CSRF protection, which
this API does not have. Do not reach for it.

`.dev` is on the HSTS preload list, so browsers refuse plain HTTP on it. Render
provisions TLS automatically, so `Secure` cookies always have a channel.

---

## Render

### API — Web Service

| Setting           | Value               |
| ----------------- | ------------------- |
| Root Directory    | _(blank)_           |
| Runtime           | Node                |
| Build Command     | `npm ci --omit=dev` |
| Start Command     | `node server.js`    |
| Health Check Path | `/health`           |

**Never `npm start`.** npm does not forward `SIGTERM` to the child process, so
the graceful shutdown handler never runs and every deploy severs in-flight
requests mid-response.

Render's free tier spins a service down when idle; the first request afterwards
pays a multi-second cold start. Acceptable for a portfolio, poor for an API other
developers integrate against. Use a paid instance if anyone depends on it.

### Docs — Static Site

Root Directory `website`, build `npm ci && npm run build`, publish
`.vitepress/dist`.

The build runs `scripts/sync-spec.js`, which copies `docs/openapi.yaml` into
`website/public/`. It reads a path outside its root directory; Render clones the
whole repository, so this resolves.

### Dashboard — Static Site

Root Directory `dashboard`, build `npm ci && npm run build`, publish `dist`,
with `VITE_API_BASE_URL=https://api.harshitbishnoi.dev`.

The dashboard imports the design system from
`website/.vitepress/theme/design-system.css` rather than copying it, so there is
one source of design values. That path also resolves outside its root directory.
If the build fails on a missing stylesheet, this is why.

### Custom domains

Add `api.` to the Web Service, `app.` and `docs.` to the two static sites. Render
issues certificates automatically. Then confirm `DASHBOARD_ORIGINS` matches the
dashboard's final origin exactly, scheme included.

---

## Health checks

`GET /health` is a **liveness** check. It returns `200` without authentication
and touches no external service, deliberately: a Supabase outage must not make
Render restart an otherwise healthy instance.

There is **no readiness endpoint**. Nothing verifies database connectivity before
an instance receives traffic. If a deploy starts before Supabase is reachable,
the first requests `500` — each retried three times first. `GET /health/ready`
running one trivial query would close this.

---

## After the first deploy

1. **Register the Lemon Squeezy webhook** at
   `https://api.harshitbishnoi.dev/webhooks/lemon-squeezy`, subscribed to the
   `subscription_*` events, and set `LEMON_SQUEEZY_WEBHOOK_SECRET` to match.
   Until it exists, checkout completes and the tier never changes — the tier is
   updated by the webhook, not by the checkout redirect.

2. **Rotate the Lemon Squeezy API key.** It is an account-level credential, not a
   test key, and it has been pasted into a chat transcript.

3. **Verify `SIGTERM` reaches Node.** Deploy, tail the logs, redeploy, and look
   for `shutdown signal received` followed by `graceful shutdown complete`. The
   handler has only ever been exercised in-process on Windows, which has no
   POSIX signals. This is the one part of the shutdown path never run for real.

4. **Regenerate the Postman collection** if the spec changed:
   `npm run postman:generate`.

---

## Operating it

Logs are JSON. Every line inside a request carries `requestId`; every error
response carries the same value in its body and in `X-Request-Id`. A `5xx` tells
the caller nothing by design, so the request id is how you find the line with the
stack trace:

```bash
grep '"requestId":"485fa7dd-..."' | jq .
```

Transient database failures retry three times with backoff before surfacing.
There is no circuit breaker: if Supabase is down rather than flaky, every request
pays three attempts plus backoff before failing.
