# Webhook Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Rules for sending, receiving, verifying, retrying, and reconciling webhook integrations.

---

## Webhooks

These apply when building or consuming event-driven integrations.

### Sending Webhooks
- Use `POST` with a JSON body for all webhook deliveries
- Include a signature header (HMAC-SHA256 of the raw body using a shared secret) so the receiver can verify authenticity
- Include a unique event ID in every delivery for idempotency
- Include a timestamp in the signature to enable replay protection
- Implement retries with exponential backoff and jitter — do not retry indefinitely
- Set a maximum retry count and a dead-letter queue for permanently failed deliveries
- Log all delivery attempts, successes, and failures

### Receiving Webhooks
- Always verify the signature before processing the payload — reject unsigned or invalid requests
- Use constant-time comparison when verifying signatures to prevent timing attacks
- Validate the timestamp — reject events older than a reasonable window (e.g. 5 minutes) to prevent replay attacks
- Acknowledge receipt immediately with `200 OK` — process the payload asynchronously in a background job
- Implement idempotency — use the event ID to ensure duplicate deliveries are handled safely
- Store the raw payload before processing — this enables replay if processing fails later

### Reconciliation
- Never rely solely on webhooks for data consistency — they can be lost or delayed
- Implement periodic API polling (daily or weekly) to reconcile state with the source of truth
- Flag to the user when a webhook-based integration has no reconciliation strategy

---