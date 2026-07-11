---
layout: home

hero:
  name: ExerciseDB API
  text: A public exercise catalog for fitness apps
  tagline: Browse, search, and sync thousands of exercises into your own app. Rich classification data, sync-friendly endpoints, and a free tier.
  actions:
    - theme: brand
      text: Get an API key
      link: https://app.harshitbishnoi.dev/register
    - theme: alt
      text: Get started
      link: /getting-started
    - theme: alt
      text: API reference
      link: /api-reference

features:
  - title: Rich exercise data
    details: Every exercise carries muscles, equipment, category, difficulty, movement pattern, mechanics, plane of motion, laterality, media, aliases, and tags — not just a name and a picture.
  - title: Built for local caching
    details: Sync endpoints return only what changed since your last sync, with tombstones for deleted and deprecated records. Your app stays fast offline.
  - title: Relationships that matter
    details: Variations, progressions, and regressions are first-class. Build a programme that scales up or down with one request.
  - title: Honest rate limits
    details: Quotas are per API key and reset daily. Every response tells you what is left, and a 429 tells you exactly when to retry.
---

<div class="landing">

## One request, real data

No SDK, no setup. Send your key, get exercises back.

::: code-group

```bash [Request]
curl https://api.harshitbishnoi.dev/exercises?limit=1 \
  -H "x-api-key: exdb_XEtT1o…"
```

```json [Response]
{
  "success": true,
  "data": [
    {
      "id": "8c1e5a10-0000-4000-8000-000000000001",
      "slug": "barbell-back-squat",
      "name": "Barbell Back Squat",
      "status": "active",
      "category": "strength",
      "difficulty": "intermediate",
      "movementPattern": "squat",
      "tags": ["compound", "lower-body"],
      "updatedAt": "2026-06-15T10:00:00.000Z"
    }
  ],
  "pagination": { "limit": 1, "offset": 0 }
}
```

:::

That is a **summary**. Ask for one exercise by id and you also get the
description, ordered instructions, coaching tips, breathing cues,
contraindications, mechanics, and programming data.

## Why not just scrape a dataset?

You can find a list of exercise names anywhere. What you cannot easily find is
everything around them.

### Relationships, curated by hand

A flat list tells you a barbell back squat exists. It does not tell you that a
goblet squat is the regression, a front squat is the variation, and a pause squat
is the progression. `GET /exercises/{id}/related` returns all three groups in one
request — which is what lets you build a programme that scales with a user
instead of a menu they scroll past.

### Sync that tells you what was deleted

A dataset you copy once starts rotting immediately. `GET /sync/exercises` returns
only what changed since your last sync, and — critically — a list of
**tombstones** for records that were deprecated or deleted. Without those, a
removed exercise lingers in your app forever. That is the failure a raw dump
cannot warn you about.

### Ids that do not move

Every exercise has a stable UUID and a stable slug. Use the id as your local
primary key and it will still resolve next year. Re-scraping a dataset means
re-reconciling it, every time.

## Plans

Every account starts on **Free**. No card, no trial clock.

| | Free | Basic | Pro | Enterprise |
| --- | --- | --- | --- | --- |
| **Requests per day** | 1,000 | 10,000 | 100,000 | 1,000,000 |
| **Full catalog** | ✓ | ✓ | ✓ | ✓ |
| **Sync endpoints** | ✓ | ✓ | ✓ | ✓ |
| **Premium exercises** | — | — | ✓ | ✓ |

Quotas are counted per API key and reset at midnight UTC. Every response carries
`X-RateLimit-Remaining`, so you always know where you stand, and a `429` carries
`Retry-After` telling you exactly when to try again.

Premium exercises are **filtered out** of list and search responses on the tiers
without access — you see a shorter list, never a broken one.

::: tip Upgrading is not a code change
Your tier lives on your API key. Upgrade in the dashboard and the same key
returns more.
:::

## Start building

Create an account, copy your key, and make your first call in about two minutes.

<div class="landing__cta">
  <a class="landing__button" href="https://app.harshitbishnoi.dev/register">Get an API key</a>
  <a class="landing__button landing__button--alt" href="/getting-started">Read the quickstart</a>
</div>

</div>

<style scoped>
.landing {
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--ex-space-8) var(--ex-space-5) var(--ex-space-9);
}

.landing h2 {
  margin-top: var(--ex-space-8);
  padding-top: var(--ex-space-6);
  border-top: 1px solid var(--ex-color-border);
  font-size: var(--ex-text-3xl);
  letter-spacing: var(--ex-tracking-tight);
}

.landing h2:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.landing h3 {
  margin-top: var(--ex-space-6);
  font-size: var(--ex-text-xl);
}

.landing table {
  display: table;
  width: 100%;
}

.landing__cta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ex-space-3);
  margin-top: var(--ex-space-6);
}

.landing__button {
  display: inline-block;
  padding: var(--ex-space-3) var(--ex-space-6);
  border-radius: var(--ex-radius-full);
  font-weight: var(--ex-weight-semibold);
  color: var(--ex-color-on-brand);
  background: var(--ex-color-brand);
  border: 1px solid transparent;
  transition: background var(--ex-duration-base) var(--ex-ease-standard);
}

.landing__button:hover {
  background: var(--ex-color-brand-hover);
  text-decoration: none;
}

.landing__button--alt {
  color: var(--ex-color-text);
  background: transparent;
  border-color: var(--ex-color-border-strong);
}

.landing__button--alt:hover {
  background: var(--ex-color-surface-sunken);
  border-color: var(--ex-color-brand);
}
</style>
