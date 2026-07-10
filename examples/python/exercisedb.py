"""ExerciseDB API client — Python 3.9+ (standard library only).

Run: EXERCISEDB_API_KEY=exdb_... python examples/python/exercisedb.py
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Iterator

BASE_URL = os.environ.get("EXERCISEDB_BASE_URL", "https://api.harshitbishnoi.dev")
API_KEY = os.environ.get("EXERCISEDB_API_KEY", "")
PAGE_SIZE = 100


class ApiError(Exception):
    """Errors are RFC 9457 problem+json. `code` is stable; `detail` is prose."""

    def __init__(self, problem: dict[str, Any]) -> None:
        super().__init__(problem.get("detail", "Request failed"))
        self.status = problem.get("status")
        self.code = problem.get("code")


def get(path: str) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{BASE_URL}{path}", headers={"x-api-key": API_KEY}
    )

    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise ApiError(json.loads(error.read())) from error


def list_exercises(limit: int = 5) -> list[dict[str, Any]]:
    return get(f"/exercises?limit={limit}")["data"]


def sync_pages(since: str | None) -> Iterator[dict[str, Any]]:
    """Yields every page of one sync.

    `limit` bounds change events, not exercises: an exercise created and then
    updated inside the window is one record from two events, and deleted records
    are dropped entirely. So follow the cursor, never `len(exercises)`.
    """
    cursor: str | None = None

    while True:
        query: dict[str, str] = {"limit": str(PAGE_SIZE)}
        if since:
            query["updated_since"] = since
        if cursor:
            query["cursor"] = cursor

        page = get(f"/sync/exercises?{urllib.parse.urlencode(query)}")
        yield page

        cursor = page["pagination"]["nextCursor"]
        if not cursor:
            return


def sync(store: "MemoryStore") -> None:
    since = store.watermark
    watermark = since
    pages: list[dict[str, Any]] = []

    for page in sync_pages(since):
        pages.append(page["data"])
        # Identical on every page of one sync: the server reads it before the
        # first page, so a record written mid-sync arrives on the next run
        # instead of being skipped.
        watermark = page["data"]["latestChangeAt"] or watermark

    # Records and watermark must commit together. A watermark that lands without
    # its records means the next sync starts after data you never wrote.
    with store.transaction():
        for data in pages:
            for exercise in data["exercises"]:
                store.upsert(exercise)

            for tombstone in data["tombstones"]:
                if tombstone["changeType"] == "deleted":
                    store.remove(tombstone["exerciseId"])
                else:
                    store.mark_deprecated(tombstone["exerciseId"])

        store.watermark = watermark


class MemoryStore:
    """Stand-in for your real database."""

    def __init__(self) -> None:
        self.exercises: dict[str, dict[str, Any]] = {}
        self.watermark: str | None = None

    def upsert(self, exercise: dict[str, Any]) -> None:
        self.exercises[exercise["id"]] = exercise

    def remove(self, exercise_id: str) -> None:
        self.exercises.pop(exercise_id, None)

    def mark_deprecated(self, exercise_id: str) -> None:
        if exercise_id in self.exercises:
            self.exercises[exercise_id]["status"] = "deprecated"

    def transaction(self) -> Any:
        import contextlib

        return contextlib.nullcontext()


def main() -> None:
    if not API_KEY:
        raise SystemExit("Set EXERCISEDB_API_KEY")

    try:
        for exercise in list_exercises(limit=3):
            # Plain hyphen, not an em dash: Windows consoles default to a
            # codepage that cannot encode it and raise on print.
            print(f"{exercise['slug']} - {exercise['name']}")
    except ApiError as error:
        if error.code == "RATE_LIMIT_EXCEEDED":
            raise SystemExit("Daily quota exhausted. Retry after midnight UTC.")
        raise

    sync(MemoryStore())


if __name__ == "__main__":
    main()
