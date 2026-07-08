# Update Rules — Claude Code Instructions

This file tells Claude Code exactly how to update and maintain the LLM Coding Rules library. Follow these instructions precisely whenever asked to update a rules file or audit the library.

---

## Two Modes

### Mode 1 — Single File Update
Triggered by: "update node-rules.md", "update react rules to React 20", "fix the prisma caching section"

### Mode 2 — Full Library Audit
Triggered by: "audit the library", "check all rules files", "what's outdated"

Read the trigger carefully and pick the correct mode. Do not run a full audit when only one file needs updating.

---

## Mode 1 — Single File Update Protocol

### Step 1 — Read the file

Read the target rules file in full before doing anything else. Note:
- The `target` version in the metadata block
- The `last_reviewed` date
- The `sources` listed
- Which sections exist and what they cover

### Step 2 — Identify what changed

Search the official sources for the framework or runtime. Always search official sources first — never rely on training data for version-specific facts.

**Official source map:**

| File | Primary source | Secondary source |
|---|---|---|
| `typescript-rules.md` | `typescriptlang.org/docs` | `github.com/microsoft/TypeScript/releases` |
| `react-rules.md` | `react.dev` | `github.com/facebook/react/releases` |
| `nextjs-rules.md` | `nextjs.org/docs` | `github.com/vercel/next.js/releases` |
| `node-rules.md` | `nodejs.org/en/docs` | `github.com/nodejs/node/releases` |
| `express-rules.md` | `expressjs.com/en/guide` | `github.com/expressjs/express/releases` |
| `fastify-rules.md` | `fastify.dev/docs` | `github.com/fastify/fastify/releases` |
| `prisma-rules.md` | `prisma.io/docs` | `prisma.io/changelog` |
| `nestjs-rules.md` | `docs.nestjs.com` | `github.com/nestjs/nest/releases` |
| `python-rules.md` | `docs.python.org` | `docs.astral.sh/uv`, `docs.astral.sh/ruff` |

**What to search for:**
- Official migration guide for the new version
- Release notes or changelog
- Breaking changes
- New APIs or patterns that replace old ones
- Deprecated APIs that should be removed from the rules

**Search queries to use:**
- `[framework] [version] migration guide site:[official-domain]`
- `[framework] [version] breaking changes site:[official-domain]`
- `[framework] [version] release notes site:github.com/[repo]`

Do not use blog posts, Medium articles, or DEV Community posts as sources. If the official docs do not cover something, leave it out.

### Step 3 — Compare against the current rules

Go section by section through the current file. For each section, determine:

- **No change needed** — rule is still correct for the new version
- **Update needed** — rule changed, API changed, or better pattern exists in new version
- **Remove** — feature deprecated or removed in new version
- **Add** — new pattern or API in new version that belongs in the rules

Do not rewrite sections that do not need changing. Only touch what changed.

### Step 4 — Make the changes

Apply changes section by section. For each change:
- Update the code example if the API changed
- Update the rule text if the behaviour changed
- Add a version callout if both old and new versions need to be supported (e.g. `[Express 4]` vs `[Express 5]`)
- Remove deprecated patterns entirely — do not leave them with a "deprecated" note unless both versions are actively in use

### Step 5 — Update the metadata block

After all content changes are made, update the metadata block at the top of the file:

```
<!-- meta
target: [new version]
last_reviewed: [current year-month, e.g. 2026-06]
sources: [same sources, updated if new ones were used]
extends: [unchanged]
-->
```

### Step 6 — Report what changed

After completing the update, provide a summary:
- Which sections were changed and why
- Which sections were unchanged
- Which sources were used
- Whether any rules were removed and what replaced them
- Any open questions or areas where the official docs were unclear

---

## Mode 2 — Full Library Audit Protocol

### Step 1 — Read all metadata blocks

Read the metadata block from every rules file. Build a checklist:

```
typescript-rules.md   target: TypeScript 5.x   last_reviewed: 2026-06
react-rules.md        target: React 19.x        last_reviewed: 2026-06
nextjs-rules.md       target: Next.js 15.x      last_reviewed: 2026-06
node-rules.md         target: Node.js 22 LTS    last_reviewed: 2026-06
express-rules.md      target: Express 5.x       last_reviewed: 2026-06
fastify-rules.md      target: Fastify 5.x       last_reviewed: 2026-06
prisma-rules.md       target: Prisma 6.x         last_reviewed: 2026-06
nestjs-rules.md       target: NestJS 11.x        last_reviewed: 2026-06
python-rules.md       target: Python 3.13        last_reviewed: 2026-06
```

### Step 2 — Check current stable versions

For each entry in the checklist, search for the current stable release version.

Search query pattern: `[framework] current stable version site:[official-domain]`

Examples:
- `node.js current LTS version site:nodejs.org`
- `react current stable release site:react.dev`
- `next.js current stable release site:nextjs.org`
- `prisma current stable version site:prisma.io`

Record the current version for each framework alongside the version in the metadata block.

### Step 3 — Flag stale files

Compare what the file targets vs what is current stable. Flag a file as stale if:
- A new major version has been released (e.g. Node.js 22 → Node.js 24)
- A new LTS has been declared for runtimes with LTS cycles (Node.js, Python)
- The `last_reviewed` date is more than 6 months old AND a new minor or patch version introduced significant changes

Do not flag a file as stale for patch releases with no breaking changes or new patterns.

### Step 4 — Present the audit report

Before making any changes, present a report:

```
LIBRARY AUDIT REPORT
====================

UP TO DATE
----------
react-rules.md       React 19.x      ✅ current stable is 19.x
nextjs-rules.md      Next.js 15.x    ✅ current stable is 15.x

STALE — UPDATE NEEDED
---------------------
node-rules.md        Node.js 22 LTS  ⚠️  Node.js 24 LTS released
typescript-rules.md  TypeScript 5.x  ⚠️  TypeScript 5.8 released — review needed

NO CHANGE NEEDED
----------------
express-rules.md     Express 5.x     ✅ no new major release
fastify-rules.md     Fastify 5.x     ✅ no new major release
prisma-rules.md      Prisma 6.x      ✅ no new major release
nestjs-rules.md      NestJS 11.x     ✅ no new major release
python-rules.md      Python 3.13     ✅ no new major release
```

Wait for confirmation before proceeding to updates.

### Step 5 — Update stale files one at a time

For each stale file, run the full Mode 1 Single File Update Protocol. Complete one file fully before starting the next.

Order: update base files before framework files. If both `typescript-rules.md` and `react-rules.md` are stale, update TypeScript first since React rules extend it.

### Step 6 — Update the README

After all files are updated, update the "Current library" table in `README.md` to reflect the new versions and review dates.

---

## Rules That Apply to Both Modes

### Source quality

- Always use Tier 1 sources (official docs, official GitHub repos, official changelogs).
- Never use a blog post, Medium article, or DEV Community post as the source for a rule change.
- If official docs are unclear or missing, note it in the report. Do not invent rules.
- If a source URL returns an error or cannot be fetched, note it and search for an alternative official source.

### What to change vs what to leave alone

**Change:**
- Code examples using deprecated APIs
- Rules that no longer apply to the new version
- Version numbers in text and metadata
- Patterns that have a better alternative in the new version

**Do not change:**
- Rules that are still correct and have not changed
- The overall structure and section order unless a major reorganisation is needed
- The writing style — keep it imperative, LLM-first, minimal prose
- Rules that are general best practices not tied to a specific version

### Writing style rules

Maintain the existing style of each file:
- Imperative and direct — "Always use X", "Never do Y"
- No explanations unless they prevent a hard-to-understand rule
- Code examples for every non-trivial rule
- Anti-patterns section at the end of every file
- `[Framework 4]` / `[Framework 5]` callout labels for version-specific rules

### Version callout format

When a file covers two versions (e.g. Express 4 and 5), use this label format:

- `[Express 4]` — rule applies only to Express 4
- `[Express 5]` — rule applies only to Express 5
- No label — rule applies to both versions

When a new major version makes a previous version's callouts obsolete (e.g. Express 4 is EOL), remove the callouts and update the rules to target only the new version.

### What counts as a breaking change worth updating

| Change type | Update the rules file? |
|---|---|
| New major version with breaking changes | Yes |
| New LTS declared for Node.js or Python | Yes |
| New minor version with significant new APIs | Yes, add the new patterns |
| New minor version with only bug fixes | No |
| Patch release | No |
| A tool in the ecosystem is deprecated (e.g. a linter) | Yes, replace with the current standard |
| Community consensus shifts on a pattern | Only if reflected in official docs or core team writing |

### Metadata block format

Every rules file metadata block must follow this exact format after an update:

```
<!-- meta
target: [Framework Name] [version]
last_reviewed: [YYYY-MM]
sources: [comma-separated list of official source domains]
extends: [comma-separated list of files this one extends, or "none"]
-->
```

Example:
```
<!-- meta
target: Node.js 24 LTS
last_reviewed: 2026-11
sources: nodejs.org, cheatsheetseries.owasp.org
extends: typescript-rules.md
-->
```

---

## File Dependency Order

When multiple files need updating, follow this order. Base files must be updated before files that extend them.

```
1. typescript-rules.md     (extends nothing)
2. python-rules.md         (extends nothing)
3. react-rules.md          (extends typescript-rules.md)
4. node-rules.md           (extends typescript-rules.md)
5. nextjs-rules.md         (extends react-rules.md)
6. express-rules.md        (extends node-rules.md)
7. fastify-rules.md        (extends node-rules.md)
8. prisma-rules.md         (extends node-rules.md)
9. nestjs-rules.md         (extends node-rules.md)
10. README.md              (updated last — reflects all file changes)
```

---

## Adding a New Rules File

When asked to create a new rules file for a stack not yet in the library:

1. Identify which existing files it extends (check the dependency order above).
2. Research the framework using official docs only before writing a single rule.
3. Follow the structure of the closest existing file as a template.
4. Include all standard sections: project structure, core patterns, anti-patterns.
5. Add the metadata block at the top.
6. Add the file to the dependency order above.
7. Update `README.md` — stack map table, file reference table, current library table.

---

## What Not to Do

- Do not rewrite a file from scratch when only a few rules changed.
- Do not change rules that are not affected by the version update.
- Do not use blog posts or community articles as sources for rule changes.
- Do not change the writing style or structure without being asked.
- Do not update multiple files simultaneously — complete one fully before starting the next.
- Do not skip the audit report in Mode 2 — always present it and wait for confirmation before making changes.
- Do not update `README.md` until all content file updates are complete.
