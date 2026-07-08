# API Health Check Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Rules for liveness and readiness endpoints on deployed APIs.

---

## API Health Checks

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