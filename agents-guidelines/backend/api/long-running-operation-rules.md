# Long-Running API Operation Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Rules for APIs that accept work asynchronously and expose job/status resources.

---

## Long-Running Operations

These apply when an API operation takes more than a few seconds to complete.

### The 202 Accepted Pattern
- Never block a request waiting for a long-running operation to finish — return `202 Accepted` immediately
- Include a `Location` header pointing to a status endpoint where the client can poll for progress
- Include a `Retry-After` header suggesting how long the client should wait before polling
- Return a unique job/task ID in the response body

### Status Endpoint
- The status endpoint must return the current state of the job: `pending`, `processing`, `completed`, `failed`
- On completion, return the result directly or redirect to the result resource using `303 See Other`
- On failure, return a structured error in the same format as all other API errors
- Include progress information when available (percentage, items processed, estimated time remaining)

### Robustness
- Persist job state to a database — not in-memory, not in the application process
- Implement a TTL for completed job records — do not keep them in the database forever
- Use idempotency keys so duplicate requests do not create duplicate jobs
- Include correlation IDs that trace the request across the API, queue, and worker

### Notification Options
- Discuss with the user whether clients should poll for status or receive a webhook callback on completion
- If webhooks are used, follow `webhook-rules.md`

---