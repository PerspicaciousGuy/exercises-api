# The Relationship Graph

Every exercise in the catalog is connected to others by curated relationships.
This graph is what turns a flat list of 157 exercises into something you can
reason about — "what can I do instead", "what comes next", "am I training this
evenly". The V2 endpoints ([substitutes](/guides/finding-substitutes),
[coverage](/guides/analyzing-coverage), [progression paths](/guides/building-a-progression))
all read this graph. This page explains what the edges mean before you use them.

## Three kinds of edge

Each exercise carries three relationship lists, returned together by
`GET /exercises/{id}/related` and individually by the `/variations`,
`/progressions`, and `/regressions` endpoints.

| Relationship | Meaning | Direction |
| --- | --- | --- |
| **Variation** | A peer — the same movement done a different way (equipment, grip, angle) at broadly the same difficulty. | Symmetric |
| **Progression** | A harder movement that builds on this one — the next step up. | Directed (easier → harder) |
| **Regression** | An easier movement that leads up to this one — the step down. | Directed (harder → easier) |

A variation is a sideways move; a progression is a step up a ladder. Both matter,
and they are not interchangeable. `dumbbell-bench-press` is a *variation* of
`barbell-bench-press` (peer, swap the implement). `push-up` is a *regression* of
`dumbbell-bench-press` (genuinely easier, a rung down). Mixing the two is the most
common modelling mistake, and this catalog is curated specifically to avoid it.

## The edges are curated and reciprocal

These relationships are not computed from tags or muscle overlap. Each one is
reviewed by a human, because "shares a muscle and is harder" produces nonsense —
a barbell curl shares the biceps with a chin-up and is technically easier, but a
curl is not a step toward a pull-up. The graph only contains edges that are the
*same movement, one honest step apart*.

Two guarantees follow from that curation:

- **Relationships are reciprocal.** If A lists B as a variation, B lists A back.
  If A progresses to B, then B regresses to A. You never have to reconcile a
  one-sided edge.
- **Empty is honest, not missing.** Many exercises — most isolation and accessory
  movements — have no progression or regression, and that is correct. A cable
  lateral raise is a peer of other raises, not a rung on a ladder. An empty list
  means "there is genuinely no such relationship", not "we haven't filled it in".

::: tip Summaries, not details
Relationship endpoints return **summaries** (`id`, `slug`, `name`, `difficulty`,
`movementPattern`, `tags`, …), not full detail records. Fetch the full record
with `GET /exercises/{id}` when you need instructions or programming data. See
[the overview](/overview) for the summary-vs-detail split.
:::

## The progression ladder

Progressions and regressions form directed ladders — chains of increasing
difficulty within a single movement family. The push-up ladder, for example:

```
knee-push-up → incline-push-up → push-up → decline-push-up → dip
```

Each arrow is one reviewed step. Ladders branch (an exercise can progress to more
than one harder movement) and different families are separate ladders — the
barbell-squat line and the pistol-squat line don't connect, because progressing
from one to the other isn't a real training step.

This ladder structure is what [progression pathfinding](/guides/building-a-progression)
walks: given a start and a goal in the same family, it returns the ordered chain
between them.

::: warning Not every pair is connected
Because ladders are per-family and directed, plenty of exercise pairs have no
path between them — they're on different ladders, or you asked to go *down* one
(progressions only point up). That's a real answer, not an error. The pathfinding
guide covers how the API reports it.
:::

## Where to go next

- [Finding substitutes](/guides/finding-substitutes) — variations filtered by the
  equipment a user actually has.
- [Building a progression](/guides/building-a-progression) — walk the ladder from
  where a user is to where they want to be.
- [Analyzing coverage](/guides/analyzing-coverage) — what a set of exercises
  trains, and where it's unbalanced.
