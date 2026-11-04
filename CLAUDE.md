# CLAUDE.md

Opus plans in this repo; Codex writes the code (its copy of these rules is in `AGENTS.md`).

## Sync with the Frevo app

This repo is the exercises API for Frevo, the iOS workout app. We own the catalog data, the API and
`npm run export:catalog`. The app lives in GitHub `PerspicaciousGuy/FitTrackV2`, branch `dev`. The two
sides talk only through `docs/EXERCISES-API-SYNC.md` in that repo.

- **Read `docs/EXERCISES-API-SYNC.md` at the start of every session**, before any catalog work.
- The FitTrackV2 clone is at `D:\Projects\FitTrackV2`, kept for that one file. Run
  `git pull --rebase origin dev` there before reading or writing it.
- Edit only our parts of the file: the *Status* and *Answer / where* columns, our own *Log* lines
  (`**YYYY-MM-DD (API):**`, newest first, append only) and the API side of *Contract*. Never touch the
  app's requests, Log lines or Contract text.
- Stage only `docs/EXERCISES-API-SYNC.md` in FitTrackV2, never `ios-strive/`, `backend/` or other docs.
  Push to `dev` only with the owner's OK.
- Answer in the file before large changes: when a request asks for a proposal or sample first, wait for
  the app's OK there before changing the whole catalog.
- Never change or reuse an exercise `id`. The app keys all user history on it.
- Add aliases freely. Ask in the file before removing or renaming one: the app matches old history by
  name or alias, so a removed alias can orphan it.
- Announce any new `trackingType`, equipment slug or muscle slug in the file (a Contract line) before it
  reaches an export, so the app can map it.
