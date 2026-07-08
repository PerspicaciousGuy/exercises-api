# General API Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Protocol-agnostic API design rules for contracts, versioning, auth boundaries, validation, errors, pagination, filtering, rate limits, observability, and documentation.

---

## General API Principles

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