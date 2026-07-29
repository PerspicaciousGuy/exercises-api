# Analyzing Coverage

A user built a workout: bench press, overhead press, a couple of push-downs. Is
it balanced, or is it all push and no pull? `POST /analyze/coverage` answers that
for any set of exercises, in one call.

It's **stateless** — you send a list of exercise ids and get back an analysis.
Nothing is stored. Send the workout a user is looking at right now and describe it
back to them.

## The call

Post the exercise ids as a JSON body.

::: code-group

```js [SDK]
import { createClient } from '@exercisedb/sdk';
const client = createClient({ apiKey: process.env.EXERCISEDB_API_KEY });

const coverage = await client.analyze.coverage([benchId, pullUpId]);
```

```bash [curl]
curl -X POST 'https://api.harshitbishnoi.dev/analyze/coverage' \
  -H "x-api-key: exdb_…" \
  -H 'content-type: application/json' \
  -d '{ "exerciseIds": ["7b1088e6-…", "a2c9f1b0-…"] }'
```

:::

The report describes what the set trains:

```json
{
  "success": true,
  "data": {
    "exerciseCount": 2,
    "unknownExerciseIds": [],
    "muscles": {
      "primary": [
        { "slug": "chest", "count": 1 },
        { "slug": "lats", "count": 1 }
      ],
      "secondary": [
        { "slug": "front-delts", "count": 1 },
        { "slug": "biceps", "count": 1 },
        { "slug": "triceps", "count": 1 }
      ]
    },
    "balance": {
      "movementPatterns": [
        { "slug": "push", "count": 1 },
        { "slug": "pull", "count": 1 }
      ],
      "pushCount": 1,
      "pullCount": 1,
      "primaryMuscleGroupCount": 2
    }
  }
}
```

## Reading the report

- **`muscles.primary` / `muscles.secondary`** — which muscles the set trains, and
  in how many of the exercises. A muscle appearing under `primary` with a high
  `count` is heavily worked; a muscle absent from `primary` entirely is a gap.
  Counts are sorted most-trained first.
- **`balance.movementPatterns`** — how the set distributes across the eight
  movement patterns.
- **`balance.pushCount` / `pullCount`** — the classic balance check. `push` counts
  push and squat patterns; `pull` counts pull and hinge. A workout with
  `pushCount: 5, pullCount: 0` is the imbalance this field exists to surface.
- **`primaryMuscleGroupCount`** — how many distinct muscles the set hits as a
  primary mover. A low number over many exercises means the workout is narrow.

The report is **descriptive, not prescriptive**. It tells you what is and isn't
covered; it doesn't tell the user what to add. That's a deliberate choice — you
know your app's programming logic; the API gives you the honest picture to build
on.

## Unknown ids are reported, not fatal

If an id doesn't resolve to a real exercise — a typo, a malformed id, a stale
reference — it lands in `unknownExerciseIds` and the analysis proceeds on the
rest:

```json
{
  "exerciseCount": 2,
  "unknownExerciseIds": ["not-a-real-id"],
  "…": "…"
}
```

::: warning Every id unknown is a 404
If *none* of the ids resolve, the endpoint returns `404` with code
`NO_EXERCISES_FOUND` — there's nothing to analyze. As long as at least one id is
valid, you get a report plus the unknowns list.
:::

## Limits

Send between 1 and 50 exercise ids. An empty list or more than 50 returns `400`
with code `VALIDATION_ERROR`. Fifty covers any realistic single workout; for
analyzing a whole program, call once per session.
