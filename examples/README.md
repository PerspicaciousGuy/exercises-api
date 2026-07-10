# Client examples

One file per language. Each does the same three things:

1. Authenticate with an API key.
2. List exercises, handling an RFC 9457 error by its stable `code`.
3. Run the incremental sync loop — cursor paging, tombstones, and the watermark.

They use each language's standard library where possible, so you can read them
without first installing anything.

| Language   | File                                                   | Requires                       |
| ---------- | ------------------------------------------------------ | ------------------------------ |
| JavaScript | [`javascript/exercisedb.js`](javascript/exercisedb.js) | Node 18+                       |
| Python     | [`python/exercisedb.py`](python/exercisedb.py)         | Python 3.9+                    |
| Swift      | [`swift/ExerciseDB.swift`](swift/ExerciseDB.swift)     | Swift 5.7+                     |
| Dart       | [`dart/exercisedb.dart`](dart/exercisedb.dart)         | Dart 3+                        |
| Kotlin     | [`kotlin/ExerciseDb.kt`](kotlin/ExerciseDb.kt)         | JVM 11+, kotlinx.serialization |

## Running them

```bash
export EXERCISEDB_API_KEY=exdb_…

node examples/javascript/exercisedb.js
python examples/python/exercisedb.py
dart run examples/dart/exercisedb.dart
```

Swift and Kotlin are written as library clients with a `main` entry point rather
than as single-file scripts, because neither runs usefully without a project.

## The three things they all get right

**Page on `hasMore`, not on `exercises.length`.** `limit` bounds change _events_,
not exercises. An exercise created and then updated inside your window is one
record from two events, and deleted records are dropped from `exercises`
entirely, so a full page routinely returns fewer records than `limit`. A loop
that stops when the list is short terminates early and silently loses data.

**Commit the watermark with the records, in one transaction.** `latestChangeAt`
is identical on every page of a sync — the server reads it before the first page,
so a record written mid-sync arrives on the next run rather than being skipped.
But if the watermark commits and the records do not, the next sync starts after
data you never wrote.

**Branch on `changeType`, not on the tombstone's existence.** `deleted` means
remove the local row. `deprecated` means flag it.

The reasoning behind each is in the [sync guide](../website/sync-guide.md).
