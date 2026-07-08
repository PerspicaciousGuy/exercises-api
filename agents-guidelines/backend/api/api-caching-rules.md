# API Caching Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> HTTP, conditional request, cache invalidation, and GraphQL caching rules for APIs.

---

## API Caching

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