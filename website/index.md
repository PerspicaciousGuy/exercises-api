---
layout: home

hero:
  name: ExerciseDB API
  text: A public exercise catalog for fitness apps
  tagline: Browse, search, and sync a curated exercise catalog into your own app. Rich classification data, sync-friendly endpoints, and a free tier.
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
    details: Every exercise carries muscles, equipment, category, difficulty, movement pattern, mechanics, plane of motion, laterality, aliases, and tags — classification you can filter and program against, not just a name.
  - title: Built for local caching
    details: Sync endpoints return only what changed since your last sync, with tombstones for deleted and deprecated records. Your app stays fast offline.
  - title: Relationships that matter
    details: Variations, progressions, and regressions are first-class. Build a programme that scales up or down with one request.
  - title: Honest rate limits
    details: Quotas are per API key and reset daily. Every response tells you what is left, and a 429 tells you exactly when to retry.
---

<LandingPage />
