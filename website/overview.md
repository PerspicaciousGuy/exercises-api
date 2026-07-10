# Overview

ExerciseDB is a read-only catalog of exercises, designed to be pulled into your
own app rather than queried on every screen.

If you have five minutes, skip to [Getting Started](/getting-started). This page
explains the ideas the API is built on, so the endpoint list makes sense when you
reach it.

## The catalog is public and read-only

Every exercise in the catalog is curated and shared by all consumers. There is no
concept of a user-created exercise, and nothing you send can modify the catalog.
That makes the whole surface cacheable: the same request returns the same answer
for every developer.

Version 1 is deliberately narrow. No workout generation, no food database, no
end-user accounts. Those live in your app; the catalog is the raw material.

## Summaries and details are different shapes

List endpoints return **summaries** — enough to render a row or a card:

```
id, slug, name, status, category, difficulty, movementPattern, tags, updatedAt
```

Fetching a single exercise returns the **detail**, which adds everything a coach
would need: `description`, ordered `instructions`, `tips`, `breathingCues`,
`contraindications`, `mechanics`, `forceType`, `position`, `planeOfMotion`,
`laterality`, `loadType`, `skillType`, `jointRegions`, `flags`, and a free-form
`programming` object.

This split is why `GET /exercises` stays fast. Ask for details only when a user
opens something.

::: tip
`GET /exercises/bulk?ids=…` returns up to 50 **details** in one request. It is the
right call when you already know which exercises you need.
:::

## Slugs are stable, ids are canonical

Every exercise has a UUID `id` and a human-readable `slug` such as
`barbell-back-squat`. Both resolve the same record. Use the `id` as your local
primary key; use the slug for URLs and debugging.

## Exercises relate to each other

Three relationships are first-class, and each is its own endpoint:

- **Variations** — a different way to perform the same movement.
- **Progressions** — harder movements that build on this one.
- **Regressions** — easier movements that lead up to it.

`GET /exercises/{id}/related` returns all three groups in one request. This is
what lets you build a programme that scales with a user rather than a flat list.

## Reference data is separate, and rarely changes

Muscles, equipment, categories, exercise flags, and joint regions live behind
their own endpoints. Exercises reference them by slug.

Fetch them once with `GET /metadata`, which returns every reference table in a
single response, and cache the result. These change on the order of months.

## Sync, don't poll

The catalog is large and mostly static, so the API is built for clients that keep
a local copy.

1. `GET /sync/metadata` tells you the current `catalogVersion` and
   `latestChangeAt`. If neither moved, there is nothing to do.
2. `GET /sync/exercises` without `updated_since` performs a first full sync.
3. Later, pass `updated_since` with the timestamp of your last successful sync.
   You get back only what changed.

Responses carry two lists. `data.exercises` holds records to insert or update.
`data.tombstones` holds records that were **deprecated or deleted** — they will
not appear in `exercises`, and your local copy should remove or flag them.

Paging is cursor-based. Follow `pagination.nextCursor` until `hasMore` is false.
Cursors are opaque; never construct one.

::: warning
A tombstone is the only signal that a record disappeared. If you ignore
`tombstones`, deleted exercises will linger in your app forever.
:::

## Tiers gate premium content, not features

Every account starts on `free`, which allows 1,000 requests per day and excludes
exercises marked `isPremium`.

Premium exercises are **filtered out** of list, search, and relation responses
rather than causing an error — a free-tier client sees a shorter list, not a
broken one. Requesting a premium exercise directly returns `403`.

Quotas are per API key and reset at midnight UTC. `X-RateLimit-Remaining` tells
you where you stand; a `429` carries `Retry-After`.

Paid tiers are bought through `POST /billing/checkout`. A tier changes when the
billing provider's webhook arrives, not when checkout returns.

## Errors are machine-readable

Every error is [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457),
served as `application/problem+json`:

```json
{
  "type": "https://docs.harshitbishnoi.dev/errors/premium-access-required",
  "title": "Premium Access Required",
  "status": 403,
  "detail": "Premium content requires a pro or enterprise API tier",
  "instance": "/exercises/8c1e5a10-0000-4000-8000-000000000001",
  "code": "PREMIUM_ACCESS_REQUIRED",
  "requestId": "485fa7dd-03b1-44e1-ae56-6b88d13b652b"
}
```

Branch on `code`. It is stable and will not change. `detail` is written for
humans and may be reworded at any time. `requestId` is echoed in the
`X-Request-Id` header — quote it when reporting a problem.

## Next

Make your first call in [Getting Started](/getting-started), then browse the
[API Reference](/api-reference) for every parameter and response shape.
