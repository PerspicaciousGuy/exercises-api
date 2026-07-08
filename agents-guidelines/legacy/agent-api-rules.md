# API Development Rules

This prompt extends the Master Agentic Development Prompt (`AGENTS.md`). It governs how you design, build, and maintain APIs — both REST and GraphQL. All rules in `AGENTS.md` still apply. This file adds API-specific constraints.

---

## 1. General API Principles

These apply to every API regardless of type.

### Design First, Code Second
- Before writing any endpoint or resolver, define the contract — what goes in, what comes out
- Discuss the resource model and relationships with the user before implementation
- If the user provides no API spec, propose one and wait for approval
- Model the API around business entities and domain concepts — never mirror internal database tables directly

### Versioning
- Every API must be versioned from day one
- REST: version in the URL path (`/api/v1/...`) — not in headers
- GraphQL: version through schema evolution — deprecate fields, never remove them without discussion
- Never introduce breaking changes to an existing version
- Breaking changes include: removing a field, renaming a field, changing a field's type, changing a status code's meaning, removing an endpoint

### Authentication & Authorization
- Never build an endpoint without asking how it is authenticated
- Never hardcode auth tokens, API keys, or secrets
- Always distinguish between authentication (who are you) and authorization (what can you do)
- Every endpoint must have an explicit access control rule — no endpoint is "open by default" unless the user says so
- Enforce authorization checks server-side on every request — never rely on client-side enforcement
- Use non-sequential identifiers (UUIDs) for resource IDs to prevent enumeration attacks

### Input Validation
- Validate every input — type, shape, length, range
- Validate at the API boundary, not deep inside business logic
- Reject invalid input early with a clear error message
- Never trust client-provided IDs for authorization — always verify server-side
- Use allowlists for accepted values when possible — not denylists
- Sanitize all string inputs to prevent injection attacks (SQL, NoSQL, XSS, command injection)

### Error Responses
- Every API must use a consistent error response shape across all endpoints
- Define the error shape once and reuse it everywhere
- Errors must include: a machine-readable code, a human-readable message, and the HTTP status code (REST) or error extension (GraphQL)
- Never expose stack traces, internal paths, raw database errors, or implementation details in error responses
- Propose an error shape to the user before building if none exists
- Include a correlation/request ID in every error response for traceability

### Pagination
- Any endpoint that returns a list must support pagination — no exceptions
- Discuss pagination strategy before implementing: offset-based, cursor-based, or keyset
- Always return total count or a "has more" indicator alongside paginated results
- Default page size must be a named constant, never a magic number
- Set a maximum page size to prevent clients from requesting unbounded result sets

### Filtering & Sorting
- Any list endpoint should support filtering by relevant fields — discuss which fields before implementing
- Use query parameters for filtering — never path segments
- Support sorting with a consistent parameter name across all endpoints (e.g. `sort=field:asc`)
- Filtering and sorting must compose with pagination — filter first, sort second, then paginate
- Validate all filter and sort field names — reject unknown fields with a clear error

### Rate Limiting & Throttling
- If consuming an external API, always ask about rate limits before writing the first call
- If building an API, flag rate limiting as a requirement to the user — do not silently skip it
- Never build retry logic without exponential backoff and a maximum retry count
- Include rate limit information in response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Return `429 Too Many Requests` with a `Retry-After` header when a client exceeds the limit
- Apply stricter limits to sensitive endpoints (login, password reset, account creation)

### Logging & Observability
- Log every incoming request: method, path, status code, duration
- Never log request or response bodies containing sensitive data (passwords, tokens, PII)
- Use structured logging (JSON) — not unstructured text
- Include a correlation/request ID in every log entry for traceability
- Generate a unique request ID at the API boundary if the client does not provide one
- Log all failed authentication and authorization attempts — these are security-relevant events

### Documentation
- Every API must have machine-readable documentation
- REST: OpenAPI/Swagger spec — generated from code or maintained alongside it
- GraphQL: Schema must be self-documenting with descriptions on every type and field
- Documentation is not optional and is not "later" — it ships with the API
- Document every error code the API can return and what it means
- Include request and response examples for every endpoint

---

## 2. REST-Specific Rules

These apply only when building or modifying REST APIs.

### URL Design
- Use plural nouns for resources: `/users`, `/orders`, `/products`
- No verbs in URLs — the HTTP method is the verb
- Nest resources to express relationships: `/users/:id/orders`
- Maximum 2 levels of nesting — deeper relationships use query parameters or separate endpoints
- Use kebab-case for multi-word URL segments: `/order-items`, not `/orderItems`
- Never put actions in the URL path — use the appropriate HTTP method instead
- URLs should be lowercase — never mix cases

### HTTP Methods
- `GET` — read, never causes side effects
- `POST` — create a new resource
- `PUT` — full replacement of a resource
- `PATCH` — partial update of a resource
- `DELETE` — remove a resource
- Never use `GET` for operations that change state
- Never use `POST` as a catch-all for everything
- Disable HTTP methods that are not used — do not leave unused methods accessible

### Status Codes
Use the correct status code. These are the minimum required:

| Code | When to Use |
|------|-------------|
| `200` | Successful GET, PUT, PATCH, or DELETE |
| `201` | Successful POST that creates a resource |
| `202` | Request accepted for async processing |
| `204` | Successful request with no response body |
| `304` | Resource not modified (conditional request) |
| `400` | Client sent invalid input |
| `401` | Not authenticated |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate resource, version mismatch) |
| `410` | Resource permanently removed (deprecated endpoint) |
| `422` | Input is well-formed but semantically invalid |
| `429` | Rate limited |
| `500` | Unexpected server error |

- Never return `200` with an error message in the body
- Never return `500` for client errors

### Request & Response
- `GET` requests use query parameters — never a request body
- `POST`, `PUT`, `PATCH` use a request body — never query parameters for data mutation
- Response bodies must use a consistent wrapper — propose one to the user if none exists
- Always return the created/updated resource in the response body after `POST`, `PUT`, or `PATCH`
- Use `Content-Type: application/json` — no other format unless explicitly discussed
- Always set the `Content-Type` response header — never rely on the client to guess

### Idempotency
- `GET`, `PUT`, `DELETE` must be idempotent — calling them multiple times produces the same result
- `POST` is not idempotent by default — if it needs to be, use an idempotency key and discuss with the user
- Document which endpoints are idempotent and which are not

### Content Negotiation & Compression
- Support `Accept-Encoding` for response compression — prefer Brotli (`br`), fall back to Gzip
- Always include `Vary: Accept-Encoding` in compressed responses so caches work correctly
- Do not compress responses smaller than 1KB — the overhead outweighs the savings
- Do not compress already-compressed binary formats (JPEG, PNG, MP4, ZIP)
- Offload compression to the reverse proxy or CDN when possible — not application code

---

## 3. GraphQL-Specific Rules

These apply only when building or modifying GraphQL APIs.

### Schema Design
- Design the schema first, implement resolvers second
- Every type, field, and argument must have a description — no undocumented schema elements
- Use `input` types for mutations — never pass raw scalar arguments
- Model the schema around business domain concepts — never expose raw database tables
- Fields are nullable by default in GraphQL — use non-null (`!`) only when you can guarantee a value
- Implement the `Node` interface with globally unique IDs for consistent client-side caching
- Naming conventions:
  - Types: PascalCase (`User`, `OrderItem`)
  - Fields: camelCase (`firstName`, `createdAt`)
  - Enums: UPPER_SNAKE_CASE values (`ACTIVE`, `PENDING_REVIEW`)
  - Mutations: verb + noun (`createUser`, `updateOrder`, `deleteProduct`)
  - Queries: noun or noun phrase (`user`, `orders`, `productById`)

### Queries vs Mutations vs Subscriptions
- Queries must never cause side effects — read only
- Mutations must always return the affected object(s) — never return void
- Subscriptions require explicit discussion before implementation — never add silently
- Never put write operations in a query resolver

### Performance & Security
- Implement query depth limiting — never allow unbounded nested queries
- Implement query complexity analysis for production APIs
- Always use DataLoader or equivalent batching to prevent N+1 queries
- Never expose introspection in production unless explicitly approved by the user
- Limit maximum query size (bytes) to prevent abuse
- Use persisted queries in production — clients send a hash instead of the full query string
- Standardize on `POST` for all GraphQL operations to avoid leaking query data in URLs and logs

### Error Handling
- Use the standard GraphQL `errors` array — never invent a custom error mechanism
- Include a `code` field in error extensions for machine-readable error types
- Partial success is valid in GraphQL — return `data` and `errors` together when appropriate
- Never throw raw exceptions from resolvers — always catch and return structured errors
- Never expose internal error messages in production — mask them with a reference ID for debugging

### Schema Evolution
- Never remove a field — deprecate it first with `@deprecated(reason: "...")` and discuss removal timeline with the user
- Adding fields is always safe — removing or renaming is a breaking change
- Never change a field's type — add a new field instead and deprecate the old one
- Track usage of deprecated fields — do not remove until traffic drops to zero or the agreed timeline passes

---

## 4. Caching

These apply when building or consuming APIs where response caching is relevant.

### HTTP Caching (REST)
- Use `Cache-Control` headers to define caching policy for every endpoint — never leave it undefined
- Use `private` for user-specific responses — never cache authenticated responses on shared caches (CDNs)
- Use `no-store` for sensitive data (financial, medical, PII) — it must never be cached
- Use `no-cache` when the client should always revalidate before using a cached response
- Set `max-age` to a sensible duration — discuss with the user, never guess

### Conditional Requests (ETags)
- Implement `ETag` headers for resources that change infrequently — this reduces bandwidth significantly
- The ETag should be a hash of the response body or a version identifier
- Support `If-None-Match` on `GET` requests — return `304 Not Modified` if the resource has not changed
- Support `If-Match` on `PUT`/`PATCH`/`DELETE` requests — return `409 Conflict` if the resource has changed since the client last read it

### Cache Invalidation
- Invalidate or update cache entries when the underlying data changes — stale caches are bugs
- Add TTL jitter (small random variation) to cache expiration times to prevent cache stampedes
- Discuss caching strategy with the user before implementing — wrong caching is worse than no caching

### GraphQL Caching
- GraphQL responses are harder to cache at the HTTP level — discuss caching strategy explicitly
- Consider field-level or resolver-level caching for expensive operations
- Use cache hints or `@cacheControl` directives where the framework supports them

---

## 5. Long-Running Operations

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
- If webhooks are used, follow the webhook rules in Section 9

---

## 6. Database & Data Layer

These apply when the API interacts with a database.

### Migrations
- Never modify an existing migration file — always create a new migration
- Never run destructive operations (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`) without explicit user confirmation
- Schema changes must be flagged in the Pre-Execution Plan, even if they are within scope
- Migrations must be reversible — every `up` must have a corresponding `down`
- Test migrations against a clean database before reporting them as done

### Queries
- Never use `SELECT *` — always specify the columns you need
- Every query that filters by user input must use parameterized queries — never string concatenation
- Never write raw SQL unless the ORM/query builder cannot express the query — flag it in the report
- Index every column used in `WHERE`, `JOIN`, or `ORDER BY` clauses — or flag it as a known performance issue
- Be aware of N+1 query patterns — use eager loading, joins, or batching to prevent them

### Data Integrity
- Every foreign key relationship must have an explicit constraint at the database level
- Discuss cascading deletes with the user before implementing — never assume `CASCADE`
- Never store derived data that can be computed — unless explicitly discussed as a performance optimization
- Soft delete over hard delete unless the user specifies otherwise
- Use database-level unique constraints for fields that must be unique — not application-level checks alone

### Transactions
- Wrap related write operations in a database transaction — partial writes are data corruption
- Keep transactions as short as possible to reduce lock contention
- Never hold a transaction open while waiting for external services (HTTP calls, queue operations)

---

## 7. API Security

Extends Section 7 (Security) of `AGENTS.md` with API-specific rules. Informed by the OWASP API Security Top 10.

### Transport
- Every API must be served over HTTPS — never HTTP in staging or production
- Set CORS policy explicitly — never use `*` for allowed origins in production
- Set appropriate security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
- Disable unnecessary HTTP methods at the server level

### Authentication
- Never build custom auth (JWT signing, password hashing, etc.) without explicit instruction — prefer established libraries
- Token expiry must be explicit and short-lived — never issue tokens that never expire
- Refresh tokens must be stored securely — never in localStorage, never in URL params
- Rotate refresh tokens on every use — a used refresh token is invalid

### Authorization (OWASP API1, API3, API5)
- Enforce object-level authorization on every request — verify that the requesting user owns or has access to the specific resource (prevents BOLA)
- Enforce property-level authorization — never return fields the user is not authorized to see (prevents BOPLA)
- Enforce function-level authorization — verify the user's role permits the operation (prevents BFLA)
- Deny access by default — explicitly grant, never implicitly allow

### Data Exposure
- Never return fields the client did not ask for — use explicit serializers or field selection
- Never return internal IDs (database auto-increment IDs) if they can leak information — discuss with the user
- Never return password hashes, even as null — exclude the field entirely
- Mask or exclude PII from all log output
- Use allowlists for response fields — never rely on denylists to hide sensitive data

### Resource Protection (OWASP API4, API6)
- Apply rate limiting on all endpoints — apply stricter limits to sensitive business flows (login, payments, account creation)
- Set execution timeouts on all operations to prevent resource exhaustion
- Validate user-supplied URLs before the server fetches them — prevent SSRF attacks

### Third-Party API Consumption (OWASP API10)
- Treat data from third-party APIs as untrusted — validate and sanitize all responses
- Never assume a third-party API response is well-formed or safe
- Implement timeouts and circuit breakers when calling external services

---

## 8. Webhooks

These apply when building or consuming event-driven integrations.

### Sending Webhooks
- Use `POST` with a JSON body for all webhook deliveries
- Include a signature header (HMAC-SHA256 of the raw body using a shared secret) so the receiver can verify authenticity
- Include a unique event ID in every delivery for idempotency
- Include a timestamp in the signature to enable replay protection
- Implement retries with exponential backoff and jitter — do not retry indefinitely
- Set a maximum retry count and a dead-letter queue for permanently failed deliveries
- Log all delivery attempts, successes, and failures

### Receiving Webhooks
- Always verify the signature before processing the payload — reject unsigned or invalid requests
- Use constant-time comparison when verifying signatures to prevent timing attacks
- Validate the timestamp — reject events older than a reasonable window (e.g. 5 minutes) to prevent replay attacks
- Acknowledge receipt immediately with `200 OK` — process the payload asynchronously in a background job
- Implement idempotency — use the event ID to ensure duplicate deliveries are handled safely
- Store the raw payload before processing — this enables replay if processing fails later

### Reconciliation
- Never rely solely on webhooks for data consistency — they can be lost or delayed
- Implement periodic API polling (daily or weekly) to reconcile state with the source of truth
- Flag to the user when a webhook-based integration has no reconciliation strategy

---

## 9. File Uploads

These apply when the API handles file uploads.

### Validation
- Whitelist allowed file extensions and MIME types — reject everything else
- Validate the file's actual content (magic bytes) — never trust the client-provided `Content-Type` or extension
- Scan uploaded files for malware when handling user-generated content — discuss with the user before skipping
- Sanitize filenames — never use the user-provided filename for storage; generate a unique name (UUID) on the server

### Size Limits
- Enforce file size limits at the server/proxy level (e.g. Nginx `client_max_body_size`) and at the application level
- Define maximum file size as a named constant — never a magic number
- Return `413 Payload Too Large` when the limit is exceeded

### Storage
- Never store uploaded files in the application directory or anywhere accessible via the web server
- Prefer managed object storage (S3, GCS, Azure Blob) over the local filesystem for production
- For large files, use presigned upload URLs so the client uploads directly to storage — not through the API server
- Implement a cleanup policy for orphaned or incomplete uploads

### Chunked & Resumable Uploads
- For files larger than a defined threshold, support chunked or resumable uploads — discuss the threshold with the user
- Never load an entire large file into memory — use streaming

---

## 10. Health Checks

These apply to every API deployed to any environment.

### Required Endpoints
- Every API must expose at least one health check endpoint
- Use separate endpoints for different check types:
  - `/health/live` (or `/livez`): Is the process alive? — must be lightweight, no dependency checks
  - `/health/ready` (or `/readyz`): Can the API handle traffic? — checks critical dependencies (database, cache, external services)

### Implementation Rules
- Health checks must be fast — no heavy database queries, no file system scans
- Liveness checks must never depend on external services — a database outage should not cause restarts
- Readiness checks should verify connectivity to critical dependencies, not perform functional tests
- Never expose sensitive information in health check responses (connection strings, internal IPs, versions)
- Return `200 OK` when healthy, `503 Service Unavailable` when unhealthy
- Health check endpoints must not require authentication

---

## 11. Batch & Bulk Operations

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
- For large batch operations, use the long-running operations pattern (Section 5) — return `202 Accepted` and process asynchronously
- Never allow a batch operation to run longer than the server's request timeout

---

## 12. Deprecation & API Lifecycle

These apply when sunsetting endpoints, fields, or entire API versions.

### REST Deprecation
- Set the `Deprecation` header on deprecated endpoints to signal consumers programmatically
- Set the `Sunset` header with a specific date after which the endpoint will be removed
- Include a `Link` header pointing to migration documentation or the replacement endpoint
- After the sunset date, return `410 Gone` — not `404`
- Track usage of deprecated endpoints — do not remove until traffic drops to zero or the agreed deadline passes

### GraphQL Deprecation
- Use `@deprecated(reason: "...")` on deprecated fields — never silently remove them
- Adding fields is always safe — removing or renaming is a breaking change
- Never change a field's type — add a new field and deprecate the old one
- Track query patterns that use deprecated fields before removal

### Communication
- Deprecation must be communicated through multiple channels: HTTP headers, documentation, and direct outreach to known consumers
- Define a standard sunset period (typically 3–12 months depending on consumer base) — discuss with the user
- Consider "brownout" periods — temporarily disable the deprecated endpoint for short windows before final removal to force consumers to notice
- Document the migration path clearly — never deprecate without an alternative

---

## 13. Concurrency & Conflict Resolution

These apply when multiple clients may modify the same resource simultaneously.

### Optimistic Locking
- Default to optimistic locking for most APIs — it scales better and avoids blocking
- Include a `version` field (integer) or `updatedAt` timestamp in every mutable resource
- On update, verify the version matches the current value — reject with `409 Conflict` if it does not
- Use the database-level atomic check (`WHERE version = :expected_version`) — never check-then-update in application code

### HTTP Conditional Requests
- Use `ETag` headers to represent the current version of a resource
- Support `If-Match` on `PUT`/`PATCH`/`DELETE` — reject with `412 Precondition Failed` if the ETag does not match
- This integrates naturally with the caching rules in Section 4

### Conflict Response
- When a conflict is detected, return `409 Conflict` with a clear message explaining what happened
- Include the current version of the resource in the conflict response so the client can compare and retry
- Document the conflict resolution strategy for every mutable endpoint

---

## 14. Testing

Extends Section 11 (Testing Awareness) of `AGENTS.md` with API-specific patterns.

### Minimum Coverage
- Every endpoint must have at minimum: one success case, one validation failure case, one auth failure case
- Test the API contract (status codes, response shapes) — not just "does it return 200"
- Test edge cases: empty lists, missing optional fields, boundary values, maximum page sizes

### Security Testing
- Test authorization boundaries: verify that User A cannot access User B's resources
- Test rate limiting: verify that exceeding the limit returns `429`
- Test input validation: send malformed, oversized, and malicious payloads

### Integration Testing
- Never mock the database in integration tests — use a test database
- Test webhook deliveries end-to-end when applicable
- Test long-running operations through the full lifecycle (submit, poll, complete/fail)

### Testing Discipline
- API tests are always a separate explicit task — never bundled with feature implementation
- Never modify existing tests unless explicitly asked

---

## 15. Applying This Prompt

- This file is used alongside `AGENTS.md`, not instead of it
- All rules in `AGENTS.md` apply unless this file explicitly overrides them (none currently do)
- If a project is not an API project, this file does not apply
- If only REST or only GraphQL is being used, only the relevant section applies — ignore the other
- Sections are cumulative — if you are building webhooks, Section 8 applies in addition to all general sections
