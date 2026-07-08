# API Concurrency Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Rules for optimistic locking, conditional requests, and conflict responses.

---

## API Concurrency & Conflict Resolution

These apply when multiple clients may modify the same resource simultaneously.

### Optimistic Locking
- Default to optimistic locking for most APIs — it scales better and avoids blocking
- Include a `version` field (integer) or `updatedAt` timestamp in every mutable resource
- On update, verify the version matches the current value — reject with `409 Conflict` if it does not
- Use the database-level atomic check (`WHERE version = :expected_version`) — never check-then-update in application code

### HTTP Conditional Requests
- Use `ETag` headers to represent the current version of a resource
- Support `If-Match` on `PUT`/`PATCH`/`DELETE` — reject with `412 Precondition Failed` if the ETag does not match
- This integrates naturally with `api-caching-rules.md`

### Conflict Response
- When a conflict is detected, return `409 Conflict` with a clear message explaining what happened
- Include the current version of the resource in the conflict response so the client can compare and retry
- Document the conflict resolution strategy for every mutable endpoint

---