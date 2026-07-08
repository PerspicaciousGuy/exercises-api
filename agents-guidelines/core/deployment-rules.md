# Deployment Guidelines

<!-- meta
target: Docker 27.x, GitHub Actions
last_reviewed: 2026-06
sources: docs.docker.com, docs.github.com/en/actions
extends: none
-->

> Deployment rules covering containerisation and CI/CD. Two sections — Docker and GitHub Actions — in one file. If either section grows large enough to warrant its own file, split by moving the section content to `docker-rules.md` or `ci-rules.md` respectively.
>
> These rules are language-agnostic and apply to any stack. Framework-specific deployment notes belong in the relevant framework file.

---

## Table of Contents

**Section A — Docker**
1. [Base Image Selection](#1-base-image-selection)
2. [Multi-Stage Builds](#2-multi-stage-builds)
3. [.dockerignore](#3-dockerignore)
4. [Layer Caching and Order](#4-layer-caching-and-order)
5. [Non-Root User](#5-non-root-user)
6. [Environment Variables and Secrets](#6-environment-variables-and-secrets)
7. [Health Checks](#7-health-checks)
8. [Graceful Shutdown](#8-graceful-shutdown)
9. [Image Security](#9-image-security)
10. [Docker Compose](#10-docker-compose)

**Section B — GitHub Actions**
11. [Workflow Structure](#11-workflow-structure)
12. [Pipeline Stages](#12-pipeline-stages)
13. [Secrets and Environment Variables](#13-secrets-and-environment-variables)
14. [Permissions](#14-permissions)
15. [Third-Party Actions](#15-third-party-actions)
16. [Environment Promotion](#16-environment-promotion)
17. [Complete Workflow Examples](#17-complete-workflow-examples)

**Section C — Anti-Patterns**
18. [Anti-Patterns](#18-anti-patterns)

---

# Section A — Docker

Source: `docs.docker.com/build/building/best-practices`

---

## 1. Base Image Selection

Source: `docs.docker.com/build/building/best-practices/#choose-the-right-base-image`

### Rules

- Always use official Docker images as base images. Never use community or unknown images.
- Always pin base images to a specific version tag. Never use `latest` — it changes without notice and breaks reproducibility.
- Use the smallest image that meets your requirements.

### Recommended base images by stack

| Stack | Build stage | Production stage |
|---|---|---|
| Node.js | `node:22-alpine` | `node:22-alpine` |
| Python | `python:3.13-slim` | `python:3.13-slim` |
| Go | `golang:1.23-alpine` | `gcr.io/distroless/static` or `alpine` |
| Static binary | Any build image | `scratch` or `distroless/static` |

**Alpine over Debian/Ubuntu for production.** Alpine images are significantly smaller and have fewer packages, which means a smaller attack surface.

**`slim` over full for Python.** `python:3.13-slim` removes most unnecessary packages from the full image.

**`distroless` for maximum security.** Google's distroless images contain only the application and its runtime dependencies — no shell, no package manager. Use when no shell access is needed in production.

```dockerfile
# ✅ Pinned version, Alpine variant
FROM node:22-alpine AS base

# ❌ Using latest — unpredictable
FROM node:latest

# ❌ Full Debian image — unnecessary packages
FROM node:22
```

---

## 2. Multi-Stage Builds

Source: `docs.docker.com/get-started/docker-concepts/building-images/multi-stage-builds`

Use multi-stage builds for every project. They separate the build environment from the production runtime, keeping the final image small and free of build tools.

### Node.js / TypeScript multi-stage build

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev

# Copy built output from build stage
COPY --from=build /app/dist ./dist

# Non-root user (see section 5)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Python multi-stage build

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Install dependencies
FROM python:3.13-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/packages -r requirements.txt

# Stage 2: Production runtime
FROM python:3.13-slim AS production
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY --from=deps /app/packages ./packages
COPY . .
ENV PYTHONPATH=/app/packages

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Rules

- Always use multi-stage builds — no exceptions.
- Name every stage explicitly (`AS deps`, `AS build`, `AS production`). Unnamed stages are harder to reference and debug.
- The production stage must not contain: compilers, build tools, test frameworks, dev dependencies, source files not needed at runtime, or the package manager cache.
- Add `# syntax=docker/dockerfile:1` as the first line to enable BuildKit features.

---

## 3. .dockerignore

Always include a `.dockerignore` file. Without it, the entire build context (including `node_modules`, `.git`, secrets) is sent to the Docker daemon on every build.

### Node.js / TypeScript

```dockerignore
# Dependencies
node_modules/
.npm/

# Build output
dist/
build/
.next/
out/

# Environment files
.env
.env.*
!.env.example

# Version control
.git/
.gitignore

# Tests and dev tools
coverage/
.nyc_output/
*.test.ts
*.spec.ts
__tests__/

# Editor
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Docker
Dockerfile*
docker-compose*
.dockerignore

# Logs
logs/
*.log

# TypeScript
*.tsbuildinfo
```

### Python

```dockerignore
# Virtual environment
.venv/
venv/
env/

# Python cache
__pycache__/
*.pyc
*.pyo
*.pyd
.Python

# Environment
.env
.env.*
!.env.example

# Version control
.git/
.gitignore

# Tests
.pytest_cache/
.coverage
htmlcov/

# Editor
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Docker
Dockerfile*
docker-compose*
.dockerignore
```

---

## 4. Layer Caching and Order

Source: `docs.docker.com/build/building/best-practices/#leverage-build-cache`

Docker caches each layer. A change in any layer invalidates all subsequent layers. Order instructions from least to most frequently changing to maximise cache hits.

### Correct order

```dockerfile
# 1. Base image (changes: never/rarely)
FROM node:22-alpine AS production
WORKDIR /app

# 2. System dependencies (changes: rarely)
RUN apk add --no-cache dumb-init

# 3. Package manifest files (changes: when deps change)
COPY package.json package-lock.json ./

# 4. Install dependencies (cached until package files change)
RUN npm ci --frozen-lockfile --omit=dev

# 5. Application source (changes: frequently)
COPY --from=build /app/dist ./dist
```

### Rules

- Copy `package.json` and lockfile before copying source code — dependency installs are cached until the manifest changes.
- Never `COPY . .` before installing dependencies — any source file change invalidates the dependency install cache.
- Group `RUN` commands with `&&` to reduce layers. Each `RUN` creates a new layer.
  ```dockerfile
  # ✅ Single layer
  RUN apk add --no-cache curl dumb-init && \
      rm -rf /var/cache/apk/*

  # ❌ Multiple unnecessary layers
  RUN apk add --no-cache curl
  RUN apk add --no-cache dumb-init
  ```
- Always clean up package manager caches within the same `RUN` command that installed packages.

---

## 5. Non-Root User

Source: `docs.docker.com/scout/policy` — Default Non-Root User policy

Never run containers as the root user. If the application is compromised, a non-root user limits what an attacker can do.

```dockerfile
# Node.js — Alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Node.js — Debian-based
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
USER appuser

# Python — Alpine
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser
```

### Rules

- Always create a dedicated non-root user and group for the application.
- Never run the production container as root.
- Set `USER` before the final `CMD` or `ENTRYPOINT`.
- Ensure the application working directory and any required files are owned by the non-root user.
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  RUN chown -R appuser:appgroup /app
  USER appuser
  ```
- Do not use UID 0 (root), UID 1 (daemon), or other system UIDs. Use a UID above 1000.

---

## 6. Environment Variables and Secrets

Source: `docs.docker.com/build/building/best-practices/#exclude-with-dockerignore`

### Rules — build-time

- Never use `ARG` or `ENV` to pass secrets into a Docker image. Even if overwritten in a later layer, the value is visible in the image history.

```dockerfile
# ❌ Secret in ARG — visible in image history
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# ✅ Inject secrets at runtime, not build time
# Pass via docker run -e or docker-compose environment
```

- Use `ARG` only for non-secret build-time configuration (e.g. build version, target platform).

### Rules — runtime

- Inject secrets via environment variables at runtime using Docker secrets, Kubernetes secrets, or the deployment platform's secret manager.
- Never hardcode environment-specific values (URLs, ports, feature flags) in the Dockerfile.
- Set `NODE_ENV=production` or `PYTHONUNBUFFERED=1` in the Dockerfile — these are not secrets and are correct to bake in.

```dockerfile
# ✅ Non-secret defaults baked in
ENV NODE_ENV=production \
    PORT=3000
```

---

## 7. Health Checks

Source: `docs.docker.com/reference/dockerfile/#healthcheck`

Every production container must define a health check. This tells Docker (and orchestrators like Kubernetes) whether the container is ready to receive traffic.

```dockerfile
# Node.js / Express / Fastify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Python / FastAPI / Flask
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

### Health check endpoint requirements

Every application must expose a `/health` endpoint that:
- Returns HTTP `200` when the application is ready to handle requests
- Returns a non-200 status or times out when the application is not ready
- Completes in under 2 seconds
- Does not require authentication

```ts
// Express — health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

### Health check parameters

| Parameter | Recommended value | Meaning |
|---|---|---|
| `--interval` | `30s` | Check every 30 seconds |
| `--timeout` | `5s` | Mark unhealthy if no response in 5s |
| `--start-period` | `10s` | Grace period for app startup |
| `--retries` | `3` | Mark unhealthy after 3 consecutive failures |

---

## 8. Graceful Shutdown

Use `dumb-init` or `tini` as the container's init process. Node.js and Python do not handle `SIGTERM` correctly when run as PID 1 in a container without an init process.

```dockerfile
# Alpine — install dumb-init
RUN apk add --no-cache dumb-init

# Use as entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

Always use the exec form (`["command", "arg"]`) for `ENTRYPOINT` and `CMD`, not the shell form (`command arg`). The shell form wraps the process in a shell, preventing signals from reaching the application.

```dockerfile
# ✅ Exec form — signals reach the process
CMD ["node", "dist/index.js"]

# ❌ Shell form — signals go to the shell, not the process
CMD node dist/index.js
```

The application must handle `SIGTERM` gracefully — see `node-rules.md` and `python-rules.md` process management sections.

---

## 9. Image Security

Source: `docs.docker.com/engine/security`, `docs.docker.com/scout/policy`

### Rules

- Scan images for vulnerabilities in CI before pushing to a registry. Use `docker scout cves` or an equivalent scanner (`trivy`, `grype`).
- Rebuild images regularly even when source code has not changed, to pick up base image security patches.
- Never include secrets, credentials, or private keys in any image layer.
- Remove unnecessary tools from the production image: no `curl`, `wget`, `bash`, `sh`, compilers, or package managers unless the application requires them.
- Never mount the Docker socket (`/var/run/docker.sock`) into a container unless explicitly required. It grants root-equivalent access to the host.
- Set `--read-only` where possible to make the container filesystem immutable at runtime.
- Drop all unnecessary Linux capabilities:
  ```
  docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myapp
  ```

---

## 10. Docker Compose

Use Docker Compose for local development only. Never use `docker-compose` for production deployments.

```yaml
# docker-compose.yml — local development only
services:
  app:
    build:
      context: .
      target: development    # build a dev-specific stage
    ports:
      - "3000:3000"
    volumes:
      - .:/app               # mount source for hot reload
      - /app/node_modules    # prevent host node_modules from overwriting container
    environment:
      - NODE_ENV=development
    env_file:
      - .env.local
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: myapp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Rules

- Always use `depends_on` with `condition: service_healthy` to wait for dependencies to be ready.
- Never commit `.env` files. Use `.env.example` as the template.
- Use named volumes for persistent data — not bind mounts — to avoid permission issues.
- Pin all image versions in `docker-compose.yml` — never `image: postgres:latest`.

---

# Section B — GitHub Actions

Source: `docs.github.com/en/actions`

---

## 11. Workflow Structure

### File location

All workflow files live in `.github/workflows/`. One file per purpose.

```
.github/
└── workflows/
    ├── ci.yml          # runs on every PR — lint, typecheck, test
    ├── deploy.yml      # runs on merge to main — build, push, deploy
    └── security.yml    # scheduled — dependency audit, image scan
```

### Basic workflow skeleton

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Restrict default token permissions globally
permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test
```

### Rules

- Name every workflow and every job clearly. The name appears in the GitHub UI — make it meaningful.
- Always pin `actions/checkout`, `actions/setup-node`, and all third-party actions to a specific version (see section 15).
- Use `ubuntu-latest` for the runner unless a specific version is required for reproducibility.
- Use `npm ci` (not `npm install`) in CI — it installs exactly what is in the lockfile.

---

## 12. Pipeline Stages

### What runs where

| Trigger | Jobs to run |
|---|---|
| Every push to any branch | Nothing — keep CI lightweight |
| Pull request opened/updated | lint, typecheck, unit tests, integration tests, security audit |
| Merge to `main` | Everything in PR + build Docker image + push to registry + deploy to staging |
| Manual trigger / tag | Deploy to production |

### CI workflow (runs on every PR)

```yaml
name: CI

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          NODE_ENV: test

  audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high
```

### Rules

- Use `needs` to define job dependencies and run jobs in parallel where possible.
- Run the fastest jobs first — linting and typechecking before tests.
- Use service containers for integration tests that need a database — do not mock the database in integration tests.
- Always run `npm audit` or `pip-audit` in CI and fail on high-severity vulnerabilities.

---

## 13. Secrets and Environment Variables

Source: `docs.github.com/en/actions/reference/security/secure-use`, `docs.github.com/en/actions/concepts/security/secrets`

### Rules

- Never store secrets as plaintext in workflow files. Always use GitHub Secrets.
- Always reference secrets via `${{ secrets.SECRET_NAME }}` — never interpolate them directly into shell commands.

```yaml
# ✅ Safe — secret passed as env var, not interpolated into shell
- name: Deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: ./deploy.sh

# ❌ Unsafe — secret interpolated into shell command, visible in logs
- name: Deploy
  run: DATABASE_URL=${{ secrets.DATABASE_URL }} ./deploy.sh
```

- Never `echo` a secret to the log.
- Never use secrets in `run` step names or job names — they appear in the UI.
- Scope secrets to the appropriate level:
  - Repository secrets: used by all workflows in the repo
  - Environment secrets: scoped to a specific deployment environment (staging, production)
  - Organisation secrets: shared across multiple repos

- Use environment secrets for production credentials. Require manual approval for environment secrets on production:
  ```yaml
  jobs:
    deploy-production:
      environment: production    # triggers required reviewer check
  ```

- Non-secret environment-specific values (feature flags, URLs) go in GitHub Variables (`${{ vars.VARIABLE_NAME }}`), not secrets.
- Rotate secrets periodically. Remove unused secrets immediately.

---

## 14. Permissions

Source: `docs.github.com/en/actions/reference/security/secure-use#minimum-permissions`

Set the default `GITHUB_TOKEN` permission to read-only. Increase only for specific jobs that need it.

```yaml
# Top-level — restrict all jobs by default
permissions:
  contents: read

jobs:
  deploy:
    permissions:
      contents: read
      packages: write    # only this job can push to registry
    steps:
      - ...
```

### Common permission requirements

| Action | Permission required |
|---|---|
| Check out code | `contents: read` |
| Push to registry | `packages: write` |
| Create a release | `contents: write` |
| Comment on a PR | `pull-requests: write` |
| Read issues | `issues: read` |

### Rules

- Set `permissions: contents: read` at the workflow level as the default.
- Only elevate permissions at the job level, not the workflow level, unless every job needs the higher permission.
- Never use `permissions: write-all` — it grants full access to everything.
- Prefer the `GITHUB_TOKEN` over personal access tokens. The `GITHUB_TOKEN` is short-lived and scoped to the repository.
- If a personal access token is required, use a service account, not a personal developer account.

---

## 15. Third-Party Actions

Source: `docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions`

### Pin to a commit SHA

Always pin third-party actions to a specific commit SHA, not a tag. Tags can be moved; commit SHAs are immutable.

```yaml
# ✅ Pinned to commit SHA — immutable
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

# ⚠️ Tag — can be moved by the action author
- uses: actions/checkout@v4

# ❌ Never use floating references
- uses: actions/checkout@main
- uses: actions/checkout@latest
```

For actions maintained by GitHub (`actions/*`, `github/*`), pinning to the major version tag (`@v4`) is acceptable since GitHub maintains tight control over these. Pin third-party actions to SHAs.

### Rules

- Audit every third-party action before using it. Check the action's source code and the publisher.
- Prefer actions maintained by GitHub, major cloud providers (AWS, Google, Azure), or widely trusted publishers.
- Keep a comment next to the SHA indicating the version it corresponds to.
- Use tools like Dependabot or Renovate to keep action versions current.
- Never use an action that requires excessive permissions for its stated purpose.

---

## 16. Environment Promotion

Environments define the deployment targets. Always use separate environments for staging and production.

```
main branch → staging (automatic)
              ↓ manual approval
           → production
```

### Environment configuration

```yaml
# deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      # ... build and deploy steps

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production    # requires manual approval
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      # ... build and deploy steps
```

### Rules

- Always deploy to staging before production. Never deploy directly to production.
- Require at least one manual approval for production deployments via environment protection rules.
- Use environment-scoped secrets for staging and production credentials — never share credentials between environments.
- Never use the same database, API key, or service account for both staging and production.
- Tag the Docker image with the Git commit SHA, not `latest`.

```yaml
- name: Build and push
  uses: docker/build-push-action@v6
  with:
    tags: |
      myregistry/myapp:${{ github.sha }}
      myregistry/myapp:latest   # only tag latest after successful deploy
```

---

## 17. Complete Workflow Examples

### Full CI/CD pipeline — Node.js

```yaml
name: CI/CD

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read
  packages: write

jobs:
  # Runs on both PR and push to main
  quality:
    name: Lint and Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint

  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm test
        env:
          NODE_ENV: test

  audit:
    name: Security Audit
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high

  # Only runs on push to main
  build-push:
    name: Build and Push Image
    runs-on: ubuntu-latest
    needs: [test, audit]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Log in to registry
        uses: docker/login-action@74a5d142397b4f367a81961eba4e8cd7edddf772 # v3.4.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@14487ce63c7a62a4a324b0bfb37086795e31c6c1 # v6.16.0
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-push
    environment: staging
    steps:
      - name: Deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.STAGING_DEPLOY_TOKEN }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          echo "Deploying $IMAGE_TAG to staging"
          # deployment command here

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production
    steps:
      - name: Deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.PRODUCTION_DEPLOY_TOKEN }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          echo "Deploying $IMAGE_TAG to production"
          # deployment command here
```

---

# Section C — Anti-Patterns

---

## 18. Anti-Patterns

**Never do these.**

### Docker — image and build

- Using `FROM latest` — always pin to a specific version.
- No multi-stage build — production image contains build tools, dev dependencies, and source files.
- `COPY . .` before installing dependencies — destroys layer caching.
- Secrets in `ARG` or `ENV` — visible in image history.
- No `.dockerignore` — entire project context sent to Docker daemon including `node_modules` and `.git`.
- Multiple `RUN` commands for the same operation instead of chaining with `&&`.
- Not cleaning up package manager cache in the same `RUN` layer that installed packages.

### Docker — runtime

- Running as root — any container escape gives attacker root on the host.
- No health check — orchestrators cannot determine container readiness.
- Shell form for `CMD` and `ENTRYPOINT` — signals do not reach the application.
- No init process (`dumb-init` or `tini`) — `SIGTERM` is not handled correctly when running as PID 1.
- Mounting Docker socket into a container — grants root-equivalent host access.
- No graceful shutdown handler — in-flight requests are dropped on container stop.

### GitHub Actions — secrets

- Storing secrets as plaintext in workflow files.
- Interpolating secrets directly into shell commands — they appear in logs.
- `echo`-ing secrets in run steps.
- Using the same secret across environments (staging and production share credentials).
- Personal developer access tokens instead of service accounts or `GITHUB_TOKEN`.

### GitHub Actions — actions and permissions

- `permissions: write-all` — unnecessary broad access.
- Third-party actions pinned to a floating tag (`@v4`, `@main`, `@latest`).
- Using unknown or untrusted third-party actions without reviewing the source.
- Elevating permissions at the workflow level when only one job needs them.

### GitHub Actions — pipeline

- Deploying directly to production without going through staging.
- No manual approval gate for production deployments.
- Running all jobs sequentially when they can run in parallel.
- Using `npm install` instead of `npm ci` in CI — not reproducible.
- Not running security audits in CI.
- Tagging Docker images with `latest` instead of the commit SHA.
- Skipping the test job and deploying anyway when tests are slow.
