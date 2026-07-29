# @exercisedb/sdk

A thin, typed JavaScript client for the [ExerciseDB API](https://api.harshitbishnoi.dev).
Covers the public catalog and the graph-intelligence endpoints (substitutes,
coverage, progression paths). Zero runtime dependencies — uses the platform
`fetch`.

## Install

```bash
npm install @exercisedb/sdk
```

Requires Node 18+ or any modern browser (a global `fetch`). For older runtimes,
pass your own `fetch`.

## Quickstart

```js
import { createClient } from '@exercisedb/sdk';

const client = createClient({ apiKey: process.env.EXERCISEDB_API_KEY });

// List with filters
const { exercises } = await client.exercises.list({
  muscle: 'chest',
  difficulty: 'beginner'
});

// One exercise, full detail
const benchPress = await client.exercises.getBySlug('barbell-bench-press');

// Graph intelligence
const subs = await client.exercises.substitutes(benchPress.id, {
  equipment: ['dumbbell', 'bench']
});

const path = await client.exercises.path(fromId, toId); // ordered chain, or null

const coverage = await client.analyze.coverage([id1, id2, id3]);
```

Every method returns the `data` directly — the API's `{ success, data }` envelope
is unwrapped for you.

## Paging

`list()` returns a single page. To walk every match without managing offsets, use
the async iterator:

```js
for await (const exercise of client.exercises.listAll({
  muscle: 'quadriceps'
})) {
  console.log(exercise.slug);
}
```

## Errors

Non-2xx responses throw an `ExerciseDBError` carrying the API's RFC 9457 problem
details, including the `requestId` for support and log correlation:

```js
import { ExerciseDBError } from '@exercisedb/sdk';

try {
  await client.exercises.get('does-not-exist');
} catch (error) {
  if (error instanceof ExerciseDBError) {
    console.error(error.status, error.code, error.requestId);
  }
}
```

## Configuration

```js
createClient({
  apiKey: '...', // required
  baseUrl: 'https://...', // optional, defaults to the production API
  fetch: customFetch // optional, defaults to globalThis.fetch
});
```

## API surface

| Group              | Methods                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `client.exercises` | `list`, `listAll`, `search`, `get`, `getBySlug`, `bulk`, `related`, `variations`, `progressions`, `regressions`, `substitutes`, `path` |
| `client.analyze`   | `coverage`                                                                                                                             |
| `client.reference` | `metadata`, `muscles`, `equipment`, `categories`, `exerciseFlags`, `jointRegions`                                                      |

Types ship with the package (`index.d.ts`) — full autocomplete in TypeScript and
JSDoc-aware editors, no `@types` package needed.

## Types

The client is plain JavaScript with JSDoc; the shipped `.d.ts` files are generated
from that JSDoc, so the types always match the implementation.
