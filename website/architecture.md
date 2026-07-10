# Architecture

Why this API is shaped the way it is, and what was deliberately left out.

## Version 1 is a public catalog, and nothing else

The catalog is curated, read-only, and shared by every consumer. There is no
user-created exercise, no workout generation, no food database, no end-user
accounts. Those live in your app.

That constraint is what makes everything else simple. Because no request can
modify the catalog, every response is cacheable, every client can hold a full
local copy, and the sync protocol only ever has to describe changes flowing one
way.

**Private custom exercises are postponed, not forgotten.** They are the single
change most likely to break these assumptions: the moment a row belongs to one
account, list endpoints need row-level authorisation, sync becomes per-user, and
the "same request, same answer" property that justifies aggressive caching is
gone. Doing that before the public catalog is stable would mean redesigning it
twice. The schema already carries the seams — every exercise has a `status` and
an owner-less identity — so the addition is additive rather than a rewrite.

## Layers

```
routes/         HTTP: parse, validate with Zod, shape the response
services/       Domain rules. Knows nothing about HTTP or Postgres.
repositories/   Data access. Knows nothing about HTTP.
supabase/       Transport: a hand-rolled PostgREST client.
```

Each layer is constructed by a factory that takes its dependencies as arguments,
and `createApp()` wires them. That is what lets a route test inject a fake
service without a database, and why the suite runs in under three seconds with
no container.

There is no ORM. Data access goes through `src/supabase/restClient.js` against
PostgREST, with raw SQL migrations. The catalog's queries are simple and its
schema is stable; an ORM would have bought abstraction over a surface that does
not move.

## Sync is the load-bearing design

The catalog is large and changes monthly. A fitness app should not call this API
on every screen — it should hold a local copy and refresh what moved.

Three decisions follow, and each has a failure mode that is invisible if you get
it wrong:

**Pagination is over change _events_, not exercises.** An exercise created and
then updated inside your window is one record from two events. So a page bounded
by `limit=100` events routinely returns fewer than 100 exercises, and a client
that loops until the list is short stops early and silently loses data. Page on
`hasMore`.

**Tombstones are the only deletion signal.** A record that disappears is
announced exactly once. Ignore `data.tombstones` and deleted exercises linger in
your app forever, because an incremental sync only ever returns what changed.

**The watermark is read before the page, not after.** `latestChangeAt` is
captured server-side before the first page is read and carried inside the opaque
cursor, so every page of one sync reports the same value. A record written while
you were paging keeps a later timestamp and arrives on your next run. Had the
server recomputed it per page, committing the last page's value would have
skipped that record permanently.

The full protocol is in the [sync guide](/sync-guide).

## Two credentials, on purpose

**API keys** authenticate machines. They are long-lived, quota-bearing, hashed
with SHA-256, and returned in plaintext exactly once.

**Sessions** authenticate a human in a browser. They expire, they are revocable
server-side, they are `httpOnly` so scripts cannot read them, and they consume no
quota.

They are separate because an API key cannot do a dashboard's job: the page whose
purpose is to _list and rotate your keys_ could never hold one, since the
plaintext is shown only at creation — and revoking your last key would lock you
out. For the same reason, logging in does not mint a key.

CORS follows the same split. The catalog is open to every origin, because it is a
public API authenticated by a header. The cookie paths — `/auth`, `/me`,
`/billing` — are restricted to an allowlist, because `Access-Control-Allow-Origin: *`
is invalid alongside credentials, and reflecting an arbitrary origin would let any
website drive a signed-in developer's dashboard.

## Errors say what happened; responses say nothing extra

Errors are [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457).
Branch on `code`, which is stable; `detail` is prose and may be reworded.

A `5xx` replaces `detail` with a generic message so internals never leak. The
`requestId` — in the body, and in the `X-Request-Id` header — is the compensating
affordance: meaningless to an attacker, decisive for an operator, who can find
the one log line carrying the stack trace.

Success responses keep a `{ success, data }` envelope. It is a locked-in public
contract: changing it would touch every endpoint and every consumer for a
cosmetic gain. The errors were changed while the API had zero consumers, which
was the only moment it was free.

## Billing is provider-neutral

`billingService` depends on an interface — `verifySignature`, `parseWebhookEvent`,
`tierForVariantId`, `createCheckout` — never on Lemon Squeezy directly, and the
schema stores `billing_provider` alongside the customer and subscription ids.

A tier changes when the provider's webhook arrives, not when checkout returns.
Deliveries are deduplicated on `sha256(raw body)`, because Lemon Squeezy sends
neither a unique event id nor a timestamp header — which also means the
timestamp-based replay window most webhook guidance recommends is not
implementable for this provider.

## What is deliberately absent

- **No ORM.** Raw SQL and a thin PostgREST client.
- **No per-IP rate limiting.** Quotas are per API key and daily, because this is
  a metered developer API where every caller is identified. A per-IP window would
  make one company behind one NAT share a quota.
- **No readiness probe.** `/health` is liveness only, and touches no external
  service, so a database outage cannot trigger a restart loop.
- **No job queue.** Webhooks are processed synchronously — one database update.
- **No circuit breaker.** Database calls retry three times with backoff.

Each of these is a place the design will need to change if the traffic changes.
None of them is an accident.
