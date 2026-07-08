# API Data Layer Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Database and data-layer rules for APIs, including migrations, queries, integrity, and transactions.

---

## API Database & Data Layer

These apply when the API interacts with a database.

### Migrations
- Never modify an existing migration file — always create a new migration
- Never run destructive operations (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`) without explicit user confirmation
- Schema changes must be flagged in the Pre-Execution Plan, even if they are within scope
- Migrations must be reversible — every `up` must have a corresponding `down`
- Test migrations against a clean database before reporting them as done

### Queries
- Never use `SELECT *` — always specify the columns you need
- Every query that filters by user input must use parameterized queries — never string concatenation
- Never write raw SQL unless the ORM/query builder cannot express the query — flag it in the report
- Index every column used in `WHERE`, `JOIN`, or `ORDER BY` clauses — or flag it as a known performance issue
- Be aware of N+1 query patterns — use eager loading, joins, or batching to prevent them

### Data Integrity
- Every foreign key relationship must have an explicit constraint at the database level
- Discuss cascading deletes with the user before implementing — never assume `CASCADE`
- Never store derived data that can be computed — unless explicitly discussed as a performance optimization
- Soft delete over hard delete unless the user specifies otherwise
- Use database-level unique constraints for fields that must be unique — not application-level checks alone

### Transactions
- Wrap related write operations in a database transaction — partial writes are data corruption
- Keep transactions as short as possible to reduce lock contention
- Never hold a transaction open while waiting for external services (HTTP calls, queue operations)

---