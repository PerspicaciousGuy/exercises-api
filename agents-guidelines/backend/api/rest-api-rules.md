# REST API Design Guidelines

<!-- meta
target: HTTP/1.1, HTTP/2
last_reviewed: 2026-06
sources: restfulapi.net, datatracker.ietf.org (RFC 3986, RFC 7231, RFC 7807, RFC 9457, RFC 8977, RFC 9110)
extends: none
-->

> Language-agnostic REST API design rules. Apply these to every REST API regardless of framework or language. These rules cover design decisions only — URL naming, versioning, pagination, error format, idempotency, and documentation. Implementation rules (middleware, validation, auth) are covered in the framework-specific files.
>
> When a rule here conflicts with a framework-specific file, the framework file wins on implementation. This file wins on design.

---

## Table of Contents

1. [URL and Resource Naming](#1-url-and-resource-naming)
2. [HTTP Methods](#2-http-methods)
3. [HTTP Status Codes](#3-http-status-codes)
4. [Versioning](#4-versioning)
5. [Request and Response Format](#5-request-and-response-format)
6. [Error Response Format](#6-error-response-format)
7. [Pagination](#7-pagination)
8. [Filtering and Sorting](#8-filtering-and-sorting)
9. [Idempotency](#9-idempotency)
10. [API Documentation](#10-api-documentation)
11. [Anti-Patterns](#11-anti-patterns)

---

## 1. URL and Resource Naming

### Core rules

- URLs identify **resources** (nouns), not actions (verbs). The HTTP method expresses the action.

```
# ✅ Resource-based
GET    /users
GET    /users/{id}
POST   /users
PATCH  /users/{id}
DELETE /users/{id}

# ❌ Action-based
POST /getUsers
POST /createUser
POST /deleteUser/{id}
POST /updateUserEmail
```

- Use **plural nouns** for collection resources.

```
# ✅
/users
/orders
/blog-posts

# ❌
/user
/order
/blogPost
```

- Use **kebab-case** for multi-word path segments. Never camelCase or snake_case in URLs.

```
# ✅
/blog-posts
/user-profiles
/shipping-addresses

# ❌
/blogPosts
/userProfiles
/shipping_addresses
```

- Use **lowercase** for all path segments. URLs are case-sensitive per RFC 3986 — enforce lowercase.

```
# ✅
/users/{id}/addresses

# ❌
/Users/{id}/Addresses
```

- Never use a trailing slash. It adds no meaning and causes duplicate URL ambiguity.

```
# ✅
/users

# ❌
/users/
```

### Nested resources

Use nesting to express relationships between resources. Limit to **2 levels of nesting maximum**.

```
# ✅ One level — clear parent-child
GET /users/{userId}/orders
GET /orders/{orderId}/items

# ✅ Two levels — acceptable
GET /users/{userId}/orders/{orderId}/items

# ❌ Three levels — too deep, restructure
GET /users/{userId}/orders/{orderId}/items/{itemId}/reviews
```

When nesting gets too deep, flatten by using query parameters or making the child resource top-level with a filter:

```
# ✅ Flattened
GET /reviews?itemId={itemId}
GET /items/{itemId}
```

### Resource IDs in URLs

Always use UUIDs or opaque IDs in URLs. Never expose sequential integer IDs — they leak record count and enable enumeration attacks.

```
# ✅
GET /users/01j5k8x3p9q2r4n7m6w1v0t8

# ❌ Leaks record count, enables enumeration
GET /users/1
GET /users/2
```

### Special actions

When an operation cannot be modelled as a resource, use a sub-resource noun that represents the action's result.

```
# ✅ Actions as sub-resources
POST /users/{id}/activation      # activate a user
POST /orders/{id}/cancellation   # cancel an order
POST /sessions                   # create a session (login)
DELETE /sessions/{id}            # delete a session (logout)

# ❌ Verbs in the URL
POST /users/{id}/activate
POST /orders/{id}/cancel
```

---

## 2. HTTP Methods

Use HTTP methods as defined by RFC 7231. Do not repurpose them.

| Method | Purpose | Idempotent | Safe |
|---|---|---|---|
| `GET` | Retrieve a resource or collection | Yes | Yes |
| `POST` | Create a new resource | No | No |
| `PUT` | Replace a resource entirely | Yes | No |
| `PATCH` | Update a resource partially | No | No |
| `DELETE` | Remove a resource | Yes | No |
| `HEAD` | Same as GET but response body omitted | Yes | Yes |
| `OPTIONS` | Describe available methods | Yes | Yes |

### Rules

- `GET` must never modify state. A GET request must be safe to retry without side effects.
- Use `POST` for creating resources. The response must include the created resource and a `Location` header pointing to the new resource URL.
- Use `PUT` only for full resource replacement — every field must be provided. Use `PATCH` for partial updates.
- `PATCH` with a body containing only the fields to update. Fields absent from the body are left unchanged.
- `DELETE` returns `204 No Content` on success with no body.
- Never use `POST` for everything. Each method has a defined semantic — use it.

```
# ✅ Correct method usage
POST /users                   # create
GET  /users/{id}              # read
PATCH /users/{id}             # partial update
PUT  /users/{id}              # full replace
DELETE /users/{id}            # delete

# ❌ Tunneling everything through POST
POST /users/get
POST /users/update
POST /users/delete
```

---

## 3. HTTP Status Codes

Always return the most specific, accurate status code. Never return `200 OK` for an error.

### Success codes

| Code | Meaning | When to use |
|---|---|---|
| `200 OK` | Success | Successful GET, PUT, PATCH |
| `201 Created` | Resource created | Successful POST that creates a resource |
| `202 Accepted` | Accepted for async processing | Request received, not yet processed |
| `204 No Content` | Success, no body | Successful DELETE, or PUT/PATCH with no response body |

### Client error codes

| Code | Meaning | When to use |
|---|---|---|
| `400 Bad Request` | Malformed request | Invalid JSON, missing required fields, type mismatch |
| `401 Unauthorized` | Not authenticated | Missing or invalid auth token |
| `403 Forbidden` | Authenticated but not authorised | Valid token, insufficient permissions |
| `404 Not Found` | Resource does not exist | ID not found |
| `405 Method Not Allowed` | HTTP method not supported | POST on a read-only endpoint |
| `409 Conflict` | State conflict | Duplicate unique field, optimistic lock conflict |
| `410 Gone` | Resource permanently deleted | Deleted resource with no replacement |
| `422 Unprocessable Entity` | Validation failure | Valid JSON structure but semantically invalid data |
| `429 Too Many Requests` | Rate limit exceeded | Always include `Retry-After` header |

### Server error codes

| Code | Meaning | When to use |
|---|---|---|
| `500 Internal Server Error` | Unexpected server error | Unhandled exceptions |
| `502 Bad Gateway` | Upstream dependency failed | Failed call to an external service |
| `503 Service Unavailable` | Server temporarily unavailable | Maintenance, overload — always include `Retry-After` |
| `504 Gateway Timeout` | Upstream dependency timed out | External service timeout |

### Rules

- Never return `200` with an error body (`{ "success": false, "error": "..." }`). Use the correct 4xx or 5xx code.
- Distinguish `401` from `403`. `401` means the client is not identified. `403` means the client is identified but lacks permission.
- Use `422` for semantic validation errors (field value out of range, business rule violation). Use `400` for structural errors (malformed JSON, wrong type).
- Always include `Retry-After` with `429` and `503`.
- Always include a `Location` header with `201 Created` pointing to the new resource.

---

## 4. Versioning

Version every public API. Unversioned APIs cannot evolve without breaking clients.

### Strategy — URI versioning

Use URI path versioning. It is explicit, visible in logs, and easy to route.

```
/api/v1/users
/api/v2/users
```

### Rules

- Always prefix the version with `v` followed by a single integer: `v1`, `v2`. Never `v1.2` or `v2024`.
- Set the version at the API root level, not per-resource. All resources in an API share the same version.
- Never remove a version without a deprecation period. Minimum deprecation notice: 6 months.
- A new major version is required when making breaking changes:
  - Removing a field from a response
  - Changing a field's type
  - Removing an endpoint
  - Changing the meaning of an existing field
- A new major version is NOT required for:
  - Adding a new optional field to a response
  - Adding a new endpoint
  - Adding a new optional query parameter
- Maintain at most 2 major versions simultaneously. When v3 is released, set a deprecation date for v1.
- Add a `Deprecation` header to responses from deprecated versions:

```
Deprecation: Sat, 01 Jan 2027 00:00:00 GMT
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: <https://api.example.com/v2/users>; rel="successor-version"
```

---

## 5. Request and Response Format

### Content type

Always use JSON. Set `Content-Type: application/json` on all responses with a body.

```
Content-Type: application/json
Accept: application/json
```

### Field naming

Use `camelCase` for JSON field names in JS/TS APIs. Use `snake_case` for Python APIs. Be consistent — never mix within the same API.

```json
// ✅ JS/TS API — camelCase
{
  "userId": "abc123",
  "firstName": "Alice",
  "createdAt": "2026-01-15T10:30:00Z"
}

// ✅ Python API — snake_case
{
  "user_id": "abc123",
  "first_name": "Alice",
  "created_at": "2026-01-15T10:30:00Z"
}
```

### Dates and times

Always use ISO 8601 format for dates and timestamps. Always include timezone (UTC preferred).

```json
// ✅
{
  "createdAt": "2026-01-15T10:30:00Z",
  "date": "2026-01-15"
}

// ❌
{
  "createdAt": 1705313400,
  "date": "01/15/2026"
}
```

### Response envelope

Do not wrap every response in a generic `{ data: ..., status: ... }` envelope. Return the resource directly for single resources. For collections, include pagination metadata.

```json
// ✅ Single resource — return directly
{
  "id": "abc123",
  "name": "Alice",
  "email": "alice@example.com"
}

// ✅ Collection — include pagination metadata
{
  "items": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6IjEyMyJ9",
    "hasMore": true
  }
}

// ❌ Unnecessary envelope on single resource
{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "Alice"
  }
}
```

### Null vs absent fields

Never return `null` for fields that simply do not apply to the resource. Omit the field entirely. Only return `null` when `null` is a meaningful value distinct from "not present".

```json
// ✅ Omit fields that don't apply
{
  "id": "abc123",
  "name": "Alice"
}

// ❌ Null pollution
{
  "id": "abc123",
  "name": "Alice",
  "deletedAt": null,
  "archivedAt": null,
  "parentId": null
}
```

---

## 6. Error Response Format

Use **RFC 9457** (Problem Details for HTTP APIs) as the error response format. It is an IETF standard designed specifically for this purpose.

### Standard error response shape

```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more fields failed validation.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    },
    {
      "field": "password",
      "message": "Must be at least 8 characters"
    }
  ]
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `type` | Yes | A URI that identifies the error type. Must be stable and documentable. |
| `title` | Yes | Short human-readable summary of the error type. Never changes for the same `type`. |
| `status` | Yes | The HTTP status code. Must match the actual HTTP response status. |
| `detail` | No | Human-readable explanation specific to this occurrence. |
| `instance` | No | URI of the request that caused the error. |
| `errors` | No | Extension — array of field-level errors for validation failures. |

### Rules

- Always use the same error format across every endpoint. Never mix formats.
- `type` must be a stable URI. It does not need to resolve to anything, but it should be documentable. Use `https://api.yourdomain.com/errors/[error-code]` format.
- Never expose stack traces, internal error messages, or database errors in the response body. Log them server-side, return only `detail` and `title`.
- For validation errors (400, 422), always include an `errors` array with per-field details. A generic "Validation failed" message without field details is not acceptable.
- `title` describes the error type, not the instance. "Validation Error" is correct. "Email must be valid" is too specific for `title` — put it in `detail` or `errors`.
- Set `Content-Type: application/problem+json` on error responses.

---

## 7. Pagination

Never return unbounded collections. Every list endpoint must be paginated.

### Cursor-based pagination (default)

Use cursor-based (keyset) pagination for all list endpoints. It performs consistently at scale and does not degrade as the dataset grows.

```
# Request
GET /users?limit=20&cursor=eyJpZCI6IjEyMyJ9

# Response
{
  "items": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6IjE0MyJ9",
    "hasMore": true,
    "limit": 20
  }
}
```

### Offset-based pagination (when required)

Use offset-based pagination only when the client requires jumping to a specific page (e.g. admin dashboards, reporting). Never use it as the default for high-volume or user-facing endpoints.

```
# Request
GET /users?page=3&limit=20

# Response
{
  "items": [...],
  "pagination": {
    "page": 3,
    "limit": 20,
    "total": 243,
    "totalPages": 13,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

### Rules

- Default `limit` must be defined and applied even when the client does not send it. Default: 20.
- Maximum `limit` must be enforced server-side. Clients cannot request unlimited results. Maximum: 100 (adjust per use case).
- Cursor values must be opaque to clients. Use base64-encoded JSON, not raw IDs. Never let clients construct or modify cursor values.
- Always include `hasMore` (cursor) or `hasNextPage` / `hasPreviousPage` (offset) in the response. Never make the client infer this from item count.
- Always return `total` and `totalPages` for offset pagination. Never require the client to calculate them.
- Cursor-based pagination must use a stable, unique field as the sort key (e.g. `id`, `createdAt + id`). Pagination over a non-unique field produces inconsistent results.
- Query parameter names: use `cursor`, `limit` (cursor-based); `page`, `limit` (offset-based). Be consistent across all endpoints.

---

## 8. Filtering and Sorting

### Filtering

Use query parameters for filtering. Name filters after the resource field they filter.

```
# ✅ Field-based filters
GET /users?role=admin
GET /users?isActive=true
GET /orders?status=pending&createdAfter=2026-01-01

# ❌ Generic filter parameter
GET /users?filter=role:admin
```

### Date range filters

Use `{field}After` and `{field}Before` for date range filtering.

```
GET /orders?createdAfter=2026-01-01T00:00:00Z
GET /orders?createdBefore=2026-01-31T23:59:59Z
GET /orders?createdAfter=2026-01-01&createdBefore=2026-01-31
```

### Sorting

Use a `sort` query parameter. Support multiple fields with comma separation. Prefix with `-` for descending order.

```
# Single field ascending
GET /users?sort=createdAt

# Single field descending
GET /users?sort=-createdAt

# Multiple fields
GET /users?sort=-createdAt,name
```

### Sparse fieldsets

Support a `fields` parameter to allow clients to request only the fields they need. This reduces response payload size.

```
GET /users?fields=id,name,email
```

### Rules

- Filter parameters must be optional. Omitting a filter returns all records (subject to pagination).
- Validate all filter values server-side. Invalid filter values return `400`.
- Never silently ignore unknown query parameters. Return `400` with a clear message if an unrecognised parameter is provided.
- Sort fields must be whitelisted. Never allow arbitrary field sorting — it can expose internal fields or cause performance issues.
- Default sort order must be defined and documented for every list endpoint. Never return results in non-deterministic order.
- Always include the applied sort and filters in the response metadata when they are non-default.

---

## 9. Idempotency

`POST` and `PATCH` are not idempotent by definition. Implement idempotency keys to allow safe retries.

### Idempotency-Key header

Clients send a unique `Idempotency-Key` header with non-idempotent requests. The server stores the response and returns the same response for duplicate requests with the same key.

```
# Request
POST /orders
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "userId": "abc123",
  "items": [...]
}

# Response (first request)
HTTP/1.1 201 Created
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

# Response (duplicate request with same key)
HTTP/1.1 201 Created  ← same status
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

### Rules

- Require `Idempotency-Key` on all endpoints that create or modify critical resources (payments, orders, account creation).
- The idempotency key must be a UUID v4 generated by the client. Document this requirement.
- Store idempotency keys and their responses for at least 24 hours. After expiry, treat the key as new.
- Return `409 Conflict` if the same key is used with a different request body.
- Return the original response (same status code and body) for duplicate requests within the idempotency window.
- Always echo the `Idempotency-Key` back in the response header.

---

## 10. API Documentation

Every public API must be documented with an OpenAPI 3.1 specification.

### Required documentation per endpoint

- HTTP method and path
- Short description
- All path parameters with types and constraints
- All query parameters with types, defaults, and whether required
- Request body schema (for POST, PUT, PATCH)
- All possible response schemas (success and error cases)
- Authentication requirements
- Rate limiting information

### OpenAPI structure

```yaml
openapi: 3.1.0
info:
  title: My API
  version: 1.0.0
  description: API description

paths:
  /users/{id}:
    get:
      summary: Get a user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
      security:
        - bearerAuth: []
```

### Rules

- Always document all 4xx and 5xx responses, not only the success case.
- Keep the OpenAPI spec in the repository alongside the code. Never let it go stale.
- Generate the spec from code annotations where possible (e.g. `@nestjs/swagger`, `fastify-swagger`). Hand-written specs drift from the implementation.
- Never document internal or admin endpoints in the public OpenAPI spec.
- Always document rate limits in the spec and in response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).

### Required response headers

Include these headers on every response:

| Header | Purpose |
|---|---|
| `Content-Type` | Always `application/json` or `application/problem+json` |
| `X-Request-Id` | Unique ID for tracing — echo the request ID or generate one |
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Required with `429` and `503` — seconds to wait before retrying |

---

## 11. Anti-Patterns

**Never do these.**

### URL design

- Verbs in URLs: `/getUsers`, `/createUser`, `/deleteOrder`.
- camelCase or snake_case in path segments: `/blogPosts`, `/user_profiles`.
- Trailing slashes: `/users/`.
- Exposing sequential integer IDs: `/users/1`, `/users/2`.
- More than 2 levels of nesting: `/users/{id}/orders/{id}/items/{id}/reviews`.
- Uppercase letters in path segments.
- File extensions in URLs: `/users.json`, `/orders.xml`.

### HTTP methods

- Using `POST` for all operations regardless of semantics.
- `GET` requests that modify state.
- `DELETE` that returns a body.
- Using `PUT` for partial updates — use `PATCH`.

### Status codes

- Returning `200` with `{ "success": false }` in the body.
- Using `400` for everything including auth failures, not-found, and server errors.
- Not distinguishing `401` from `403`.
- Not including `Retry-After` with `429` and `503`.
- Not including `Location` header with `201 Created`.

### Versioning

- No versioning at all — makes it impossible to evolve the API without breaking clients.
- Versioning with decimals: `v1.2`, `v2.0`.
- Per-resource versioning instead of API-level versioning.
- Removing a version without a deprecation period.

### Responses

- Returning `null` for absent optional fields instead of omitting them.
- Inconsistent field naming (mixing camelCase and snake_case).
- Timestamps as Unix integers instead of ISO 8601 strings.
- Different error formats per endpoint.
- Exposing internal error details, stack traces, or database errors in responses.

### Pagination

- Returning unbounded collections with no pagination.
- Offset pagination on high-volume user-facing endpoints.
- Not enforcing a maximum `limit` — clients can request millions of records.
- Opaque cursor values that are actually raw IDs — clients can enumerate records.
- Non-deterministic default sort order.

### Documentation

- No OpenAPI spec.
- Spec that only documents the success case.
- Spec committed separately from the code and allowed to go stale.
- Rate limits undocumented.
