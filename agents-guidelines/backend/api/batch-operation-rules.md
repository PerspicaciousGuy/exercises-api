# Batch API Operation Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Rules for bulk endpoints, partial failures, atomicity, and large batch processing.

---

## Batch & Bulk Operations

These apply when the API needs to process multiple resources in a single request.

### Endpoint Design
- Use a dedicated bulk endpoint (e.g. `POST /api/v1/users/bulk`) — do not overload the single-resource endpoint unless explicitly discussed
- Accept an array of items in the request body
- Enforce a maximum batch size — define it as a named constant
- Document the maximum batch size in the API documentation

### Partial Failure Handling
- Batch operations will often partially succeed — never return a single `200` or `400` for the entire batch
- Return a `200 OK` (or `207 Multi-Status`) with an array of individual results, each containing its own status and error details
- Discuss atomicity with the user: should the batch be all-or-nothing, or is partial success acceptable?
- Document the atomicity behavior clearly

### Large Batches
- For large batch operations, use the long-running operations pattern in `long-running-operation-rules.md` — return `202 Accepted` and process asynchronously
- Never allow a batch operation to run longer than the server's request timeout

---