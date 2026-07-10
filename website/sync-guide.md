# Sync Guide

The catalog is large and changes rarely. A fitness app should hold a local copy
and refresh only what moved — not call the API on every screen.

This guide covers the whole loop: the first full sync, incremental refreshes, and
the two failure modes that quietly corrupt a local copy.

## The shape of the loop

```
1. GET /sync/exercises  → page until hasMore is false
2. commit data.latestChangeAt → this is your watermark
3. next time, send it as updated_since
```

Every sync response carries `data.latestChangeAt`: the timestamp of the newest
change in the catalog at the moment your sync began. Store it once the last page
lands, and send it back as `updated_since` next time.

::: tip The watermark is captured for you
The server reads `latestChangeAt` **before** it reads the page of changes, and
carries that same value across every page of one sync. So a record written while
you were paging keeps a later timestamp and arrives on your next run rather than
being skipped. Every page of a given sync returns an identical `latestChangeAt`;
whichever one you commit is correct.
:::

## 1. First sync

Page through `GET /sync/exercises` with no `updated_since`. Omitting it means
"everything".

```bash
curl 'http://localhost:3000/sync/exercises?limit=100' -H "x-api-key: exdb_…"
```

```json
{
  "success": true,
  "data": {
    "exercises": [{ "id": "8c1e…", "slug": "barbell-back-squat", "…": "…" }],
    "tombstones": [],
    "latestChangeAt": "2026-07-02T09:14:00.000Z"
  },
  "pagination": {
    "limit": 100,
    "nextCursor": "eyJvZmZzZXQiOjEwMH0",
    "hasMore": true
  }
}
```

`latestChangeAt` is `null` only when the catalog has never recorded a change.

Sync returns **full detail records**, not the summaries `GET /exercises` returns.
One pass gives you everything you need to render an exercise offline.

## 2. Paging

Pass `nextCursor` back as `cursor` until `hasMore` is `false`.

```bash
curl 'http://localhost:3000/sync/exercises?limit=100&cursor=eyJvZmZzZXQiOjEwMH0' \
  -H "x-api-key: exdb_…"
```

Cursors are opaque. They are base64 today; treat them as strings you echo back
and never construct or parse. An unparseable cursor returns `400` with code
`VALIDATION_ERROR`.

::: danger Do not loop on `exercises.length`
`limit` bounds the number of **change events** read, not exercises returned. An
exercise created and then updated inside your window is one record from two
events. Deleted records are dropped from `exercises` entirely. So a full page of
100 events routinely yields fewer than 100 exercises.

`hasMore` is the only correct signal. `while (exercises.length === limit)`
terminates early and silently loses records.
:::

## 3. Incremental sync

Send your stored watermark:

```bash
curl 'http://localhost:3000/sync/exercises?updated_since=2026-07-02T09:14:00.000Z' \
  -H "x-api-key: exdb_…"
```

The comparison is strictly greater than, so passing back the exact timestamp you
last committed will not redeliver that change. No overlap, no duplicates.

To check whether a sync is worth running at all, call `GET /sync/metadata` — a
single cheap request. If its `latestChangeAt` equals your stored watermark,
nothing has changed and you can skip the sync. This is optional: an incremental
sync with nothing to return is already inexpensive.

## 4. Applying a page

Two arrays come back. Order matters.

`data.exercises` — insert or update these, keyed on `id`.

`data.tombstones` — records that left the active catalog:

```json
{
  "exerciseId": "8c1e5a10-0000-4000-8000-000000000001",
  "changeType": "deleted",
  "changedAt": "2026-07-02T09:14:00.000Z",
  "catalogVersion": 12
}
```

Branch on `changeType`:

| `changeType` | Meaning                             | Local action                |
| ------------ | ----------------------------------- | --------------------------- |
| `deleted`    | Removed from the catalog for good   | Delete your row             |
| `deprecated` | Still exists, no longer recommended | Flag it; stop suggesting it |

A tombstone always means the record is not in `data.exercises`. Which change
types appear depends on `include_deprecated`:

- **`include_deprecated=false`** (the default) — deprecated records are withheld,
  so they arrive as `deprecated` tombstones. Deleted records arrive as `deleted`
  tombstones.
- **`include_deprecated=true`** — deprecated records are returned in
  `data.exercises` carrying `status: "deprecated"`. They are **not** tombstoned,
  because they are not gone. Only `deleted` tombstones appear.

Pass `include_deprecated=true` when you are migrating users off retired exercises
and still need to display them; read `status` to tell active from deprecated.

::: warning Tombstones are the only deletion signal
An exercise that disappears never simply stops appearing. It arrives once, as a
tombstone. Ignore the array and deleted exercises linger in your app forever —
and because incremental syncs only return what changed, you will never see it
again.
:::

## 5. Commit the watermark

Only after the final page — `hasMore: false` — store `data.latestChangeAt`.

Write the records and the watermark in a **single local transaction**. If the
watermark commits and the records do not, the next sync asks for changes after a
point whose data you never wrote, and those exercises are lost until the next
time they happen to change.

## A complete client

```js
async function sync(db, apiKey) {
  const since = db.getWatermark();
  let cursor = null;
  let watermark = since;
  const pages = [];

  do {
    const params = new URLSearchParams({ limit: '100' });
    if (since) params.set('updated_since', since);
    if (cursor) params.set('cursor', cursor);

    const page = await get(`/sync/exercises?${params}`, apiKey);
    pages.push(page.data);
    watermark = page.data.latestChangeAt ?? watermark;
    cursor = page.pagination.nextCursor;
  } while (cursor); // nextCursor is null exactly when hasMore is false

  db.transaction(() => {
    for (const { exercises, tombstones } of pages) {
      for (const exercise of exercises) db.upsertExercise(exercise);
      for (const stone of tombstones) {
        if (stone.changeType === 'deleted') db.deleteExercise(stone.exerciseId);
        else db.markDeprecated(stone.exerciseId);
      }
    }
    db.setWatermark(watermark);
  });
}
```

Every page reports the same `latestChangeAt`, so reading it from the last one is
the same as reading it from the first.

Buffering pages in memory is fine for this catalog. If it grows, stream each page
into a staging table and swap at the end — the requirement is that the watermark
and the records commit together, not that you hold them in RAM.

## Quota

Each page is one request against your daily quota. A first sync of a
2,000-exercise catalog at `limit=100` costs roughly 21 requests: well inside the
free tier's 1,000 per day. An incremental sync with nothing to return costs one.

Do not sync on every app launch. Once a day, or on a pull-to-refresh, is right
for a catalog that changes monthly.

## Reference data

Muscles, equipment, categories, and flags are not part of the exercise sync.
Fetch them once from `GET /metadata` and cache them. `catalogVersion` in
`/sync/metadata` moves when they change, which is your cue to refetch.

## Where next

Endpoint-by-endpoint parameters and response schemas are in the
[API reference](/api-reference).
