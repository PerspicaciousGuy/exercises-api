# Agents Guidelines Index

This folder contains stack-specific and workflow-specific rule modules used by `AGENTS.md`.

## Folder Map

- `core/` - cross-project workflow rules such as onboarding, Git, testing, security, deployment, and update discipline.
- `languages/` - language-level rules that apply before framework rules.
- `frontend/` - UI framework rules.
- `backend/` - server runtime and framework rules.
- `backend/api/` - REST, GraphQL, and focused API add-on rules.
- `database/` - database and ORM rules.
- `auth/` - authentication and authorization rules.

## Stack Loading Map

| Project type | Files to load |
|---|---|
| React SPA | `languages/typescript-rules.md` + `frontend/react-rules.md` |
| Next.js | `languages/typescript-rules.md` + `frontend/react-rules.md` + `frontend/nextjs-rules.md` |
| Node.js | `languages/typescript-rules.md` + `backend/node-rules.md` |
| Express API | `languages/typescript-rules.md` + `backend/node-rules.md` + `backend/express-rules.md` + `backend/api/rest-api-rules.md` |
| Fastify API | `languages/typescript-rules.md` + `backend/node-rules.md` + `backend/fastify-rules.md` + `backend/api/rest-api-rules.md` |
| NestJS API | `languages/typescript-rules.md` + `backend/node-rules.md` + `backend/nestjs-rules.md` + `backend/api/rest-api-rules.md` |
| Prisma | Add `database/prisma-rules.md` to the selected backend or Next.js stack. |
| Python | `languages/python-rules.md` |
| Tests | Add `core/testing-rules.md` to the selected stack. |
| Auth | Add `auth/auth-rules.md` when authentication or authorization is in scope. |
| Deployment | Add `core/deployment-rules.md` when infrastructure, hosting, CI/CD, or release work is in scope. |

## Focused API Add-Ons

Load these only when the task specifically involves the matching API concern.

| Task scope | File |
|---|---|
| General API contracts, validation boundaries, observability, documentation | `backend/api/api-general-rules.md` |
| GraphQL APIs | `backend/api/graphql-rules.md` |
| API caching, ETags, conditional requests | `backend/api/api-caching-rules.md` |
| Long-running jobs and `202 Accepted` flows | `backend/api/long-running-operation-rules.md` |
| Generic API database/data-layer work | `backend/api/api-data-layer-rules.md` |
| API-specific OWASP-style security | `backend/api/api-security-rules.md` |
| Webhooks | `backend/api/webhook-rules.md` |
| File uploads | `backend/api/file-upload-rules.md` |
| Health checks | `backend/api/health-check-rules.md` |
| Batch and bulk operations | `backend/api/batch-operation-rules.md` |
| Deprecation, sunset, and lifecycle | `backend/api/api-lifecycle-rules.md` |
| Optimistic locking and mutation conflicts | `backend/api/api-concurrency-rules.md` |
| API-specific tests | `backend/api/api-testing-rules.md` |

## Legacy Source Files

Archived source files live in `agents-guidelines/legacy/`. They are preserved for reference only and should not be loaded for new tasks unless the user explicitly asks to inspect old versions.

- `agents-guidelines/legacy/agent-api-rules.md` - original broad API prompt before the focused API split.
- `agents-guidelines/legacy/rest-api-rules.md` - archived REST API source copy kept for reference.

