# Git Guidelines

<!-- meta
target: Git 2.x
last_reviewed: 2026-06
sources: conventionalcommits.org, docs.github.com, git-scm.com, semver.org
extends: none
-->

> Language-agnostic Git rules. Apply these to every project regardless of stack or framework. These rules cover commit messages, branching, merging, conflict resolution, versioning, and what never to commit.

---

## Table of Contents

1. [Commit Messages — Conventional Commits](#1-commit-messages--conventional-commits)
2. [Branching Strategy — GitHub Flow](#2-branching-strategy--github-flow)
3. [Branch Naming](#3-branch-naming)
4. [Merge Strategy](#4-merge-strategy)
5. [Merge Conflicts](#5-merge-conflicts)
6. [Pull Requests](#6-pull-requests)
7. [Tagging and Versioning](#7-tagging-and-versioning)
8. [What Never to Commit](#8-what-never-to-commit)
9. [.gitignore Standards](#9-gitignore-standards)
10. [Anti-Patterns](#10-anti-patterns)

---

## 1. Commit Messages — Conventional Commits

Use the **Conventional Commits 1.0** specification for all commit messages. Source: `conventionalcommits.org/en/v1.0.0/`

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use | SemVer impact |
|---|---|---|
| `feat` | A new feature | MINOR |
| `fix` | A bug fix | PATCH |
| `docs` | Documentation changes only | none |
| `style` | Formatting, whitespace, missing semicolons — no logic change | none |
| `refactor` | Code restructure — no feature or bug fix | none |
| `perf` | Performance improvement | none |
| `test` | Adding or updating tests | none |
| `build` | Build system or dependency changes | none |
| `ci` | CI/CD configuration changes | none |
| `chore` | Maintenance tasks — updating gitignore, tooling configs | none |
| `revert` | Reverts a previous commit | none |

### Breaking changes

Mark breaking changes with `!` after the type/scope, or with a `BREAKING CHANGE:` footer. Both trigger a MAJOR version bump.

```
# ✅ Breaking change with ! suffix
feat(api)!: remove deprecated /v1/users endpoint

# ✅ Breaking change with footer
feat(auth): replace session-based auth with JWT

BREAKING CHANGE: clients must now send Bearer token in Authorization header.
Session cookies are no longer supported.
```

### Scope

The scope is optional. Use it to name the part of the codebase the commit affects. Keep it lowercase, one word.

```
feat(auth): add OAuth2 login
fix(users): handle null email on registration
refactor(db): extract query builder into separate module
```

### Description rules

- Lowercase first letter
- No period at the end
- Present tense, imperative mood — "add feature" not "added feature" or "adds feature"
- Maximum 72 characters on the first line
- Describe what changed and why, not how

```
# ✅
feat(payments): add retry logic for failed Stripe webhooks
fix(auth): prevent token refresh loop on 401 response
docs(readme): add environment variable setup instructions

# ❌
Fixed the bug
Update stuff
WIP
feat: Added new feature.
FEAT: Add feature
```

### Body

Use the body to explain the **why** behind the change when the description alone is not enough.

```
fix(users): prevent duplicate email registration

Previously, concurrent requests could bypass the unique constraint
check and create two accounts with the same email before either
transaction committed. Added a database-level unique index on
users.email to enforce uniqueness at the DB layer.
```

### Footer

Use footers for breaking change notices, issue references, and co-authorship.

```
feat(api): migrate to paginated responses

BREAKING CHANGE: all list endpoints now return { items, pagination }
instead of a bare array. Clients must update response handling.

Closes #142
Co-authored-by: Alice <alice@example.com>
```

---

## 2. Branching Strategy — GitHub Flow

Use **GitHub Flow**. Source: `docs.github.com/en/get-started/using-github/github-flow`

### The model

```
main          ← always deployable, always stable
  └── feature/add-user-auth     ← short-lived branch
  └── fix/null-email-crash      ← short-lived branch
  └── chore/upgrade-dependencies
```

### Rules

- `main` is the only permanent branch. It must always be in a deployable state.
- Never commit directly to `main`. All changes come through a pull request.
- Create a new branch for every piece of work — features, fixes, chores.
- Branches are short-lived. Merge or close within days, not weeks.
- Delete the branch immediately after merging. Do not let stale branches accumulate.
- Never merge a branch that fails CI checks or has unresolved review comments.
- If work has been paused for more than a few days, rebase the branch onto `main` before resuming to minimise conflict surface.

---

## 3. Branch Naming

Use `kebab-case` with a type prefix matching the commit type.

### Format

```
<type>/<short-description>
```

### Examples

```
# ✅
feat/user-authentication
feat/payment-webhook-retry
fix/null-email-crash
fix/token-refresh-loop
docs/api-setup-guide
chore/upgrade-prisma-6
refactor/extract-query-builder
test/user-service-unit-tests
release/v2.1.0

# ❌
feature-user-auth           # no type prefix
UserAuthentication          # PascalCase
fix_null_email              # snake_case
johns-branch                # personal name
new-stuff                   # non-descriptive
wip                         # not meaningful
```

### Rules

- Always use a type prefix matching the Conventional Commits type.
- Maximum 50 characters total including the prefix.
- Use only lowercase letters, numbers, and hyphens. No slashes within the description part.
- Never use personal names or usernames as branch names.
- Never use vague names like `wip`, `temp`, `test`, `new-branch`, `fix`.

---

## 4. Merge Strategy

### Squash and merge — default for feature and fix branches

Use squash merge when merging feature and fix branches into `main`. This produces one clean commit per PR on `main`, keeping the history readable.

```bash
# Squash merge via CLI
git checkout main
git merge --squash feat/user-authentication
git commit -m "feat(auth): add user authentication with JWT"
```

The squashed commit message must follow Conventional Commits format. Do not use the auto-generated squash message from GitHub — write a clean one.

### Merge commit — for release branches only

Use a regular merge commit only when merging a `release/` branch. This preserves the full release history.

### Rebase — for keeping feature branches up to date

Use rebase to keep your feature branch current with `main`. Never rebase a branch that has been pushed to a shared remote and reviewed — it rewrites history and forces collaborators to re-sync.

```bash
# Keep your branch up to date with main
git fetch origin
git rebase origin/main
```

### Rules

- Never use `git merge --ff-only` on a shared branch — it creates a linear history that loses branch context.
- Never force push to `main` under any circumstances.
- Only force push to your own feature branches, and only before the PR is open for review.
- Never rebase a branch after a PR review has started — it rewrites commits the reviewer already reviewed.
- After a squash merge, delete the source branch immediately.

---

## 5. Merge Conflicts

This section defines exactly how to handle merge conflicts. These rules are critical for agents — wrong conflict resolution silently destroys code.

### Understanding conflict markers

When Git cannot auto-resolve a conflict, it inserts markers into the file:

```
<<<<<<< HEAD (current branch — what you have)
const timeout = 5000;
=======
const timeout = 3000;
>>>>>>> feat/reduce-timeouts (incoming branch — what you're merging in)
```

- Everything between `<<<<<<< HEAD` and `=======` is your current branch's version.
- Everything between `=======` and `>>>>>>>` is the incoming branch's version.
- The markers themselves (`<<<<<<<`, `=======`, `>>>>>>>`) are not valid code — they must be removed entirely after resolution.

### Step-by-step conflict resolution

1. **Read both versions fully** before changing anything. Understand what each side changed and why.
2. **Check the commit history** for context: `git log --merge -p <filename>` shows what each branch changed in the conflicting file.
3. **Resolve by understanding intent** — do not blindly pick one side. The correct resolution often combines both changes.
4. **Remove all conflict markers** — `<<<<<<<`, `=======`, `>>>>>>>` must not remain in the file.
5. **Verify the file is syntactically valid** after resolving — it must parse and compile without errors.
6. **Stage the resolved file**: `git add <filename>`
7. **Run tests** before committing the resolution. Never commit a conflict resolution that hasn't been verified to work.
8. **Commit the resolution** with a descriptive message: `git commit -m "fix: resolve merge conflict in userService timeout config"`

### When to stop and ask

Stop and ask the user for guidance when the conflict involves:

- **Logic conflicts** — both branches changed the same function or algorithm in different ways. Picking one side may silently break behaviour.
- **Schema or migration conflicts** — database schema changes, migration files. Wrong resolution corrupts the data model.
- **Package lock files** — `package-lock.json`, `uv.lock`, `poetry.lock`. Never manually resolve these — regenerate them instead.
- **Generated files** — never manually resolve conflicts in auto-generated files. Regenerate them after resolving the source.
- **Large conflicts spanning many lines** — if a conflict block is more than 20 lines, the risk of a silent error is high. Flag it.
- **Any conflict where intent is unclear** — if you cannot determine what the correct merged result should be, stop and ask.

```
# ❌ Wrong — blindly picking one side without understanding
<<<<<<< HEAD
const result = await processPayment(amount, currency);
=======
const result = await processPayment(amount, currency, { retry: true });
>>>>>>> feat/payment-retry
# Deleted the retry option without understanding it was intentional
```

```
# ✅ Correct — combining both changes with understanding
const result = await processPayment(amount, currency, { retry: true });
# Both sides are preserved: the function call AND the retry option
```

### Package lock file conflicts

Never resolve `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `uv.lock`, or `poetry.lock` conflicts manually. The correct resolution is always:

```bash
# For npm
git checkout --theirs package-lock.json
npm install

# For uv
git checkout --theirs uv.lock
uv lock
```

Then stage the regenerated file.

### Binary file conflicts

Git cannot merge binary files. The correct resolution is always to explicitly choose one version:

```bash
# Keep your version
git checkout --ours path/to/file.png

# Take the incoming version
git checkout --theirs path/to/file.png
```

Then stage the chosen file.

### Aborting a conflict

If you are mid-conflict and not confident in the resolution, abort and start over:

```bash
# Abort a merge in progress
git merge --abort

# Abort a rebase in progress
git rebase --abort
```

---

## 6. Pull Requests

### PR size

Keep PRs small and focused. A PR that touches more than 400 lines of logic is too large. Split the work.

A PR should do one thing. If you need "and" to describe what it does, split it.

### PR title

The PR title must follow Conventional Commits format — it becomes the squash commit message.

```
# ✅
feat(auth): add JWT authentication with refresh tokens
fix(users): prevent duplicate email registration on concurrent requests
chore: upgrade Prisma to v6

# ❌
Update auth
Fix bug
WIP - do not merge
```

### PR description

Every PR must include:
- **What** — what was changed
- **Why** — why this change was needed
- **How to test** — how to verify it works
- **Breaking changes** — if any, what they are and how to migrate

### PR rules

- Never merge your own PR without review on a team project.
- Never merge a PR with failing CI checks.
- Never merge a PR with unresolved review comments.
- Mark a PR as draft if it is not ready for review. Remove draft status only when it is genuinely ready.
- Link the PR to the issue it closes using `Closes #123` in the description.
- Do not push force to a branch while a review is in progress.

---

## 7. Tagging and Versioning

Use **Semantic Versioning 2.0.0** for all releases. Source: `semver.org`

### Format

```
MAJOR.MINOR.PATCH

1.0.0
2.3.1
0.12.4
```

| Part | When to increment | Reset |
|---|---|---|
| `MAJOR` | Breaking change — incompatible API change | MINOR and PATCH reset to 0 |
| `MINOR` | New feature — backwards compatible | PATCH resets to 0 |
| `PATCH` | Bug fix — backwards compatible | — |

### Pre-release versions

```
1.0.0-alpha.1
1.0.0-beta.3
1.0.0-rc.1
```

### Tagging a release

Always use annotated tags (not lightweight tags). Annotated tags include the tagger, date, and message.

```bash
# ✅ Annotated tag
git tag -a v1.2.0 -m "release: v1.2.0 — add OAuth2 login"
git push origin v1.2.0

# ❌ Lightweight tag — no metadata
git tag v1.2.0
```

### Rules

- Always prefix version tags with `v`: `v1.0.0` not `1.0.0`.
- Never delete or move a tag that has been pushed to a remote. Tags are permanent references to a point in history.
- Never reuse a version number. If a release was wrong, release a new version.
- Start at `0.1.0` for initial development. Increment to `1.0.0` when the public API is stable.
- A `BREAKING CHANGE` footer or `!` in a commit message during a release cycle triggers a MAJOR version bump — never ignore it.

---

## 8. What Never to Commit

### Absolute never

These must never appear in any commit in any branch:

- Secrets, API keys, passwords, tokens, credentials of any kind
- Private keys (`.pem`, `.key`, `.p12`, `.pfx`)
- Environment files with real values (`.env`, `.env.local`, `.env.production`)
- Database connection strings with credentials
- OAuth client secrets
- Encryption keys

If a secret is accidentally committed, treat it as compromised immediately — rotate it before doing anything else. Removing it from history with `git filter-repo` does not make it safe; it was already exposed.

### Never commit

- Build artifacts and compiled output (`dist/`, `build/`, `.next/`, `__pycache__/`)
- Dependency directories (`node_modules/`, `.venv/`, `vendor/`)
- IDE and editor configuration files (`.idea/`, `.vscode/` — unless the team standardises on them)
- OS-generated files (`.DS_Store`, `Thumbs.db`, `Desktop.ini`)
- Log files (`*.log`, `logs/`)
- Temporary files (`*.tmp`, `*.temp`, `*.swp`)
- Coverage reports (`coverage/`, `.nyc_output/`, `htmlcov/`)
- Local development overrides not applicable to others

### Always commit

- `package-lock.json`, `uv.lock`, `poetry.lock` — lockfiles ensure reproducible installs
- `.env.example` — template with all required keys and placeholder values (never real values)
- `.gitignore` — always at the root of every repository

---

## 9. .gitignore Standards

Every repository must have a `.gitignore` at the root. Start from `gitignore.io` or GitHub's official templates.

### JavaScript / TypeScript projects

```gitignore
# Dependencies
node_modules/

# Build output
dist/
build/
.next/
.nuxt/
out/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log
npm-debug.log*

# Testing
coverage/
.nyc_output/

# Editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo

# Misc
.cache/
.parcel-cache/
```

### Python projects

```gitignore
# Virtual environment
.venv/
venv/
env/

# Bytecode
__pycache__/
*.pyc
*.pyo
*.pyd

# Distribution
dist/
build/
*.egg-info/

# Environment
.env
.env.local

# Testing
.pytest_cache/
.coverage
htmlcov/
.mypy_cache/
.ruff_cache/

# Editor
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

### Rules

- Never use a global gitignore as a substitute for a project-level `.gitignore`. Project-level is the source of truth.
- Add entries to `.gitignore` as soon as a new tool or output type is added to the project. Do not let untracked files accumulate.
- Never use `git add -f` (force add) to add a file that is in `.gitignore`. If a file genuinely needs to be tracked, remove it from `.gitignore`.
- Keep `.gitignore` at the root level. Only add nested `.gitignore` files for complex monorepos with distinct subproject rules.

---

## 10. Anti-Patterns

**Never do these.**

### Commits

- Committing directly to `main`.
- Vague commit messages: `fix`, `update`, `WIP`, `changes`, `stuff`.
- Commit messages in past tense: `fixed bug`, `added feature`.
- Giant commits that mix unrelated changes — one commit, one logical change.
- Commented-out code in a commit — delete it, don't comment it out.
- Committed secrets, API keys, or credentials — rotate immediately if this happens.
- Committing broken code — every commit on a shared branch must leave the codebase in a working state.

### Branching

- Long-lived feature branches (weeks without merging) — they accumulate conflicts.
- Working directly on `main`.
- Branches named after people: `johns-fix`, `alice-feature`.
- Stale branches left open after work is abandoned — close or delete them.
- Merging `main` into a feature branch habitually without a reason — rebase instead.

### Merge conflicts

- Blindly accepting `--ours` or `--theirs` without reading both versions.
- Leaving conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in committed code.
- Manually editing `package-lock.json` or other lockfiles to resolve conflicts.
- Committing a conflict resolution without running the code or tests.
- Force-pushing to `main` to override a conflict.
- Continuing to resolve a logic conflict without fully understanding both sides.

### History

- Force pushing to `main` or any shared branch.
- Rewriting published history on a branch others are working on.
- Deleting or moving tags that have been pushed to a remote.
- Reusing version numbers.

### Pull requests

- Opening a PR of 1000+ lines — split the work.
- Merging your own PR without review.
- Merging with failing CI.
- Merging with unresolved review comments.
- Using the PR title as a throwaway message — it becomes the commit message on `main`.

### Versioning

- Using `v1.0` instead of `v1.0.0` — always three parts.
- Lightweight tags instead of annotated tags for releases.
- Not tagging releases at all — no way to reference the exact code in a release.
- Ignoring `BREAKING CHANGE` markers when deciding the next version number.
