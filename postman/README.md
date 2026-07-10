# Postman collection

`exercisedb-api.postman_collection.json` — 28 requests across every endpoint,
grouped by tag.

## Import and use

1. In Postman: **Import** → select the JSON file.
2. Open the collection's **Variables** tab and set `apiKey` to your key.
3. Set `baseUrl` if you are not running the API on `http://localhost:3000`.

Authentication is configured once on the collection, so every request inherits
the `x-api-key` header. The four public endpoints (`/health`, `/auth/register`,
`/auth/login`, `/auth/logout`) override it with no auth.

## It is generated, not hand-written

The collection is produced from `docs/openapi.yaml`, which is the source of
truth for the API contract. Regenerate it after any spec change:

```bash
npm run postman:generate
```

Do not edit the JSON by hand — the next regeneration will overwrite it. Fix the
spec instead.

## What it does not cover

The webhook endpoint is present but not usefully callable from Postman: it
requires an `X-Signature` HMAC over the exact raw request body, and Postman
would have to compute that in a pre-request script. Test webhooks with the curl
recipe in the root README instead.

Session-cookie auth is not exercised here either. Postman will hold the cookie
after `POST /auth/login`, so `/me/*` works, but the collection's default is the
API key.
