# Getting Started

You will make your first authenticated request in about two minutes. There are
three steps: register, copy your API key, call an endpoint.

The base URL is `https://api.harshitbishnoi.dev`. Running the API locally
instead? Swap it for `http://localhost:3000`.

## 1. Register a developer account

```bash
curl -X POST https://api.harshitbishnoi.dev/auth/register \
  -H 'content-type: application/json' \
  -d '{
    "email": "alice@example.com",
    "password": "a-long-passphrase",
    "name": "Alice"
  }'
```

Passwords must be at least 8 characters. The response is `201 Created`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "0f1c…",
      "email": "alice@example.com",
      "name": "Alice",
      "tier": "free",
      "isAdmin": false,
      "isActive": true,
      "createdAt": "2026-07-09T10:00:00.000Z"
    },
    "apiKey": {
      "id": "7ba2…",
      "label": "Default",
      "key": "exdb_XEtT1o…"
    }
  }
}
```

::: danger Copy the key now
`apiKey.key` is the only time the plaintext key is ever returned. The server
stores a SHA-256 hash of it and cannot show it to you again. If you lose it,
create a new key with `POST /me/keys` and revoke the old one.
:::

## 2. Make your first call

Send the key in an `x-api-key` header:

```bash
curl https://api.harshitbishnoi.dev/exercises?limit=2 \
  -H "x-api-key: exdb_XEtT1o…"
```

An `Authorization: Bearer exdb_…` header works identically, if that fits your
HTTP client better.

```json
{
  "success": true,
  "data": [
    {
      "id": "8c1e5a10-0000-4000-8000-000000000001",
      "slug": "barbell-back-squat",
      "name": "Barbell Back Squat",
      "status": "active",
      "category": "strength",
      "difficulty": "intermediate",
      "movementPattern": "squat",
      "tags": ["compound", "lower-body"],
      "updatedAt": "2026-06-15T10:00:00.000Z"
    }
  ],
  "pagination": { "limit": 2, "offset": 0 }
}
```

List endpoints return **summaries**. Fetch `GET /exercises/{id}` for the full
record — instructions, coaching cues, contraindications, mechanics, and
programming data.

Every catalog, sync, account, and billing endpoint requires a key. The only
exceptions are `GET /health`, `POST /auth/register`, and `POST /auth/login`.

## 3. Understand your quota

The free tier allows **1,000 requests per day**, reset at midnight UTC. Every
response carries your current standing:

| Header                  | Meaning                                  |
| ----------------------- | ---------------------------------------- |
| `X-RateLimit-Limit`     | Requests allowed per day on your tier    |
| `X-RateLimit-Remaining` | Requests left today                      |
| `X-RateLimit-Reset`     | ISO 8601 timestamp when the quota resets |

Exceed it and you get `429 Too Many Requests` with a `Retry-After` header giving
the seconds to wait.

## Errors

Every error is [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
with content type `application/problem+json`:

```json
{
  "type": "https://docs.harshitbishnoi.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "limit must be less than or equal to 100",
  "instance": "/exercises?limit=500",
  "code": "VALIDATION_ERROR",
  "requestId": "485fa7dd-03b1-44e1-ae56-6b88d13b652b"
}
```

Branch on `code` — it is stable. `detail` is written for humans and may be
reworded. `type` is a stable URI identifying the error class.

`requestId` also comes back in the `X-Request-Id` header. Quote it when you
report a problem: on a `5xx` the `detail` is deliberately generic, and the
request id is the only way to find the server log line behind it.

## Where next

Read the [API reference](/api-reference) for every endpoint, parameter, and
response shape.

If you are building a mobile app, do not call the API on every screen. Sync the
catalog into a local database once, then refresh only what changed. The
[sync guide](/sync-guide) walks through the whole loop.
