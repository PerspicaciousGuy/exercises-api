# GraphQL API Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> GraphQL-specific schema, resolver, performance, security, error-handling, and schema-evolution rules.

---

## GraphQL-Specific Rules

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