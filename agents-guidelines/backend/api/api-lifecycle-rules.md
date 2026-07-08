# API Lifecycle Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Rules for API deprecation, sunset, migration communication, and lifecycle management.

---

## Deprecation & API Lifecycle

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