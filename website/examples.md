# Examples

A complete client in five languages. Each authenticates, handles an error, and
runs the full sync loop.

These are the real files from [`examples/`](https://github.com/PerspicaciousGuy/exercisedb-api/tree/main/examples),
included at build time rather than pasted, so they cannot drift from the code
you can actually run.

::: tip Read the sync guide first
The loop below will make more sense after [the sync guide](/sync-guide), which
explains why you page on `hasMore` and why the watermark is committed last.
:::

## Authenticate and list

Send your key in `x-api-key`. Every error is `application/problem+json`; branch
on the `code` member, which is stable.

## The sync loop

Three things every one of these clients gets right, and most hand-written
clients get wrong:

- **Page on `hasMore`, never on `exercises.length`.** `limit` bounds change
  _events_, not exercises, so a full page routinely returns fewer records.
- **Commit `latestChangeAt` and the records in one transaction.** It is identical
  on every page of a sync, so which page you read it from does not matter — but
  a watermark that lands without its records skips data permanently.
- **Branch on `changeType`.** `deleted` removes the row; `deprecated` flags it.

## Full source

::: code-group

<<< @/../examples/javascript/exercisedb.js [JavaScript]

<<< @/../examples/python/exercisedb.py [Python]

<<< @/../examples/swift/ExerciseDB.swift [Swift]

<<< @/../examples/dart/exercisedb.dart [Dart]

<<< @/../examples/kotlin/ExerciseDb.kt [Kotlin]

:::

## Where next

Every parameter and response shape is in the [API reference](/api-reference).
