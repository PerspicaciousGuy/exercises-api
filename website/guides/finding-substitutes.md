# Finding Substitutes

Your user opened their workout and the plan says barbell bench press. They're at
home with a pair of dumbbells. What can they do instead?

`GET /exercises/{id}/substitutes` answers that: it returns the exercise's
[variations](/concepts/relationship-graph), optionally filtered to only those the
user can perform with the equipment they have.

## The basic call

Ask for an exercise's substitutes. Send the equipment the user has as a
comma-separated list of slugs.

::: code-group

```js [SDK]
import { createClient } from '@exercisedb/sdk';
const client = createClient({ apiKey: process.env.EXERCISEDB_API_KEY });

const subs = await client.exercises.substitutes(benchPressId, {
  equipment: ['dumbbell', 'bench']
});
```

```bash [curl]
curl 'https://api.harshitbishnoi.dev/exercises/{id}/substitutes?equipment=dumbbell,bench' \
  -H "x-api-key: exdb_…"
```

:::

The response is a list of exercise summaries the user can actually do:

```json
{
  "success": true,
  "data": [
    {
      "id": "7b1088e6-…",
      "slug": "dumbbell-bench-press",
      "name": "Dumbbell Bench Press",
      "status": "active",
      "category": "strength",
      "difficulty": "beginner",
      "movementPattern": "push",
      "tags": ["dumbbell", "push", "chest"],
      "updatedAt": "2026-07-29T01:09:40Z"
    }
  ]
}
```

Barbell bench press has five variations in the catalog (incline barbell, smith
machine, chest press machine, dumbbell, close grip). With only `dumbbell` and
`bench` on hand, exactly one survives the filter.

## How the filter decides

A variation is kept only when **every** piece of its equipment is in the list you
sent. Equipment-free (bodyweight) variations are always kept.

That "every" matters and trips people up. Ask for substitutes with only
`equipment=dumbbell` and you get **nothing** back — because `dumbbell-bench-press`
also needs a `bench`, which you didn't include. Send `dumbbell,bench` and it
appears.

::: tip It's an AND, not an OR
The filter is "can the user do this movement with what they have", so it requires
*all* of a variation's equipment. List everything the user has access to, not
just the headline item.
:::

## Omitting the filter

Leave `equipment` off entirely to get every variation, unfiltered — useful when
you want to show all alternatives and let the user pick.

::: code-group

```js [SDK]
const all = await client.exercises.substitutes(benchPressId);
```

```bash [curl]
curl 'https://api.harshitbishnoi.dev/exercises/{id}/substitutes' \
  -H "x-api-key: exdb_…"
```

:::

## What substitutes are — and aren't

Substitutes are **variations** — peers of the same movement. They are not
progressions or regressions. If you ask for substitutes for `barbell-bench-press`,
you'll get other presses, not `push-up` (which is a *regression* — easier, a rung
down the ladder). That's deliberate: a substitute should train the same thing at
the same level, not change the difficulty.

If you want an easier or harder alternative rather than a peer, reach for
[progressions and regressions](/concepts/relationship-graph) or the
[progression path](/guides/building-a-progression) instead.

::: warning An exercise with no variations returns none
Substitutes come from the curated variation edges. An exercise that has no
variations returns an empty list — even if something with the same muscles exists
elsewhere in the catalog. Empty means "no curated peer", which for many isolation
movements is the honest answer.
:::
