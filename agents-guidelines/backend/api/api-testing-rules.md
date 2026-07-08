# API Testing Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> API-specific testing rules for endpoint contracts, security boundaries, integration coverage, and lifecycle flows.

---

## API Testing

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