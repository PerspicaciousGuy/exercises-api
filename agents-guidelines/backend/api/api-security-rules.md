# API Security Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> API-specific security rules informed by OWASP API risks, including transport, auth, authorization, exposure, resource protection, and third-party consumption.

---

## API Security

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