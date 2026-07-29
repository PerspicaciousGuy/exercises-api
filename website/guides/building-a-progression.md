# Building a Progression

Your user can do a chest press machine and wants to work up to a barbell bench
press. What's the path between them?

`GET /exercises/{id}/path?to={targetId}` walks the
[progression ladder](/concepts/relationship-graph) and returns the shortest
ordered chain from where the user is to where they want to be.

## Finding the path

Pass the starting exercise as the path parameter and the goal as `to`.

::: code-group

```js [SDK]
import { createClient } from '@exercisedb/sdk';
const client = createClient({ apiKey: process.env.EXERCISEDB_API_KEY });

const path = await client.exercises.path(chestPressMachineId, barbellBenchId);
```

```bash [curl]
curl 'https://api.harshitbishnoi.dev/exercises/{id}/path?to={targetId}' \
  -H "x-api-key: exdb_…"
```

:::

The response is the ordered chain — start first, goal last, each a summary:

```json
{
  "success": true,
  "data": [
    { "slug": "chest-press-machine", "difficulty": "beginner", "…": "…" },
    { "slug": "dumbbell-bench-press", "difficulty": "beginner", "…": "…" },
    { "slug": "barbell-bench-press", "difficulty": "intermediate", "…": "…" }
  ]
}
```

Read it as a route: chest press machine → dumbbell bench press → barbell bench
press. Each hop is one curated step. Render it as a checklist, a roadmap, or the
"next up" card in a training plan.

## When there's no path

Progressions are directed and per-family, so plenty of pairs simply aren't
connected. In that case `data` is `null` — **not** an error, and not an empty
array:

```json
{ "success": true, "data": null }
```

```js [SDK]
const path = await client.exercises.path(fromId, toId);
if (path === null) {
  // no progression route — offer the goal directly, or a regression
}
```

Three things return `null`, all correctly:

- **Different ladders.** A box squat can't reach a pistol squat — they're on
  separate squat lines that don't connect, because progressing from one to the
  other isn't a real step.
- **Wrong direction.** Asking to path from `barbell-bench-press` *to*
  `chest-press-machine` returns `null`. Progressions only point up the ladder;
  you don't "progress" to something easier. For the downward step, use
  regressions.
- **The same exercise.** Path from an exercise to itself returns a single-element
  list — a valid, trivial path.

::: tip One step at a time
If you only want the immediate next move rather than the whole route to a distant
goal, skip pathfinding and read `GET /exercises/{id}/progressions` directly — it
returns the exercises one rung up. Pathfinding is for "get me from here to that
specific goal".
:::

## Walking the ladder directly

For a "what's next" feature, the single-step endpoints are simpler than a full
path:

::: code-group

```js [SDK]
const harder = await client.exercises.progressions(id); // one rung up
const easier = await client.exercises.regressions(id); // one rung down
```

```bash [curl]
curl 'https://api.harshitbishnoi.dev/exercises/{id}/progressions' -H "x-api-key: exdb_…"
curl 'https://api.harshitbishnoi.dev/exercises/{id}/regressions' -H "x-api-key: exdb_…"
```

:::

Both return summary lists. An empty list means the exercise is at the top (no
progressions) or bottom (no regressions) of its ladder, or isn't on a ladder at
all — see [the graph concepts](/concepts/relationship-graph) for why empty is
honest.
