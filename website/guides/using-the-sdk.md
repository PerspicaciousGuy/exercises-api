# Using the SDK

`@exercisedb/sdk` is a thin, typed JavaScript client. If you're building in
JavaScript or TypeScript, it removes the boilerplate every hand-written client
repeats — auth headers, the response envelope, error handling, pagination — and
gives you autocomplete for the whole catalog and graph.

It's optional. Everything the SDK does is a plain HTTP call you can make yourself;
the SDK just makes the common path shorter and typed.

## Install

```bash
npm install @exercisedb/sdk
```

It has zero runtime dependencies and uses the platform `fetch`. Node 18+ or any
modern browser works out of the box; for older runtimes, pass your own `fetch`.

## Create a client

```js
import { createClient } from '@exercisedb/sdk';

const client = createClient({ apiKey: process.env.EXERCISEDB_API_KEY });
```

The key is sent as `x-api-key` on every request. See
[Getting Started](/getting-started) for how to obtain one.

## What you get

Methods are grouped by resource and return the data directly — the
`{ success, data }` envelope is unwrapped for you.

```js
// Catalog
const { exercises } = await client.exercises.list({ muscle: 'chest' });
const bench = await client.exercises.getBySlug('barbell-bench-press');

// Graph intelligence
const subs = await client.exercises.substitutes(bench.id, { equipment: ['dumbbell', 'bench'] });
const path = await client.exercises.path(fromId, toId); // ordered chain, or null
const coverage = await client.analyze.coverage([id1, id2, id3]);

// Reference tables
const { muscles, equipment } = await client.reference.metadata();
```

The full surface: `client.exercises` (`list`, `listAll`, `search`, `get`,
`getBySlug`, `bulk`, `related`, `variations`, `progressions`, `regressions`,
`substitutes`, `path`), `client.analyze` (`coverage`), and `client.reference`
(`metadata`, `muscles`, `equipment`, `categories`, `exerciseFlags`,
`jointRegions`).

## Paging without the loop

`list()` returns one page. To walk every match without managing offsets yourself,
use the async iterator — it pages transparently and stops when the catalog does:

```js
for await (const exercise of client.exercises.listAll({ muscle: 'quadriceps' })) {
  console.log(exercise.slug);
}
```

This gets right the thing hand-written loops get wrong — it pages until the API
says there's no more, rather than guessing from page length.

## Errors carry the request id

A non-2xx response throws an `ExerciseDBError` carrying the API's
[RFC 9457 problem details](/overview), including the `requestId` you'll want when
asking for support:

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

Branch on `error.code` — it's the stable, machine-readable member, the same one
documented on each endpoint in the [API Reference](/api-reference).

## Types

The client ships its own types (`index.d.ts`), so TypeScript and JSDoc-aware
editors get full autocomplete with no `@types` package. The types are generated
from the client's source, so they can't drift from what the methods actually do —
`movementPattern` autocompletes to the exact eight patterns, `path()` is typed as
"summaries or `null`", and so on.

## Configuration

```js
createClient({
  apiKey: '…', // required
  baseUrl: 'https://…', // optional, defaults to the production API
  fetch: customFetch // optional, defaults to globalThis.fetch
});
```

Point `baseUrl` at `http://localhost:3000` to develop against a local instance.
