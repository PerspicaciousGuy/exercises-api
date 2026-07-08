# Prisma Coding Guidelines

<!-- meta
target: Prisma 6.x
last_reviewed: 2026-06
sources: prisma.io/docs, prisma.io/changelog
extends: typescript-rules.md, node-rules.md
-->

> These rules extend `node-rules.md` and `typescript-rules.md`. Both files apply to every project using Prisma.
>
> Target: **Prisma 6**. Framework-agnostic — applies to Express, Fastify, Next.js, NestJS, or any Node.js project.
>
> Primary database: **PostgreSQL**. Rules marked `[PostgreSQL]` are PostgreSQL-specific. All other rules apply regardless of database.

---

## Table of Contents

1. [Setup & Singleton Client](#1-setup--singleton-client)
2. [Schema Design Rules](#2-schema-design-rules)
3. [ID and Timestamp Conventions](#3-id-and-timestamp-conventions)
4. [Relations](#4-relations)
5. [Query Patterns](#5-query-patterns)
6. [Select and Include — Avoiding Overfetching](#6-select-and-include--avoiding-overfetching)
7. [Transactions](#7-transactions)
8. [Migrations](#8-migrations)
9. [Error Handling](#9-error-handling)
10. [Type Utilities](#10-type-utilities)
11. [Performance — N+1 and Query Optimisation](#11-performance--n1-and-query-optimisation)
12. [Raw Queries](#12-raw-queries)
13. [Soft Deletes](#13-soft-deletes)
14. [Anti-Patterns](#14-anti-patterns)

---

## 1. Setup & Singleton Client

### Installation

```bash
npm install prisma @prisma/client --save-exact
npx prisma init
```

### Generator configuration

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Always set an explicit `output` path. This makes the generated client importable from a predictable path and avoids issues with monorepos and serverless bundlers.

### Singleton client

Create one global `PrismaClient` instance. Never instantiate `PrismaClient` more than once in production — each instance creates a new connection pool, which exhausts database connection limits.

```ts
// src/lib/db.ts
import 'server-only'; // optional: prevents accidental client-side import
import { PrismaClient } from '../generated/prisma/index.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

The `globalThis` pattern prevents creating new instances on every hot-reload in development (Next.js, tsx watch). In production, the module is loaded once — the singleton is created once.

### Rules

- Import `db` from `src/lib/db.ts` everywhere. Never call `new PrismaClient()` outside of this file.
- Never pass `PrismaClient` instances as function parameters. Import `db` directly in repository files.
- Always disconnect on graceful shutdown.

```ts
// src/index.ts
process.on('SIGTERM', async () => {
  await db.$disconnect();
  process.exit(0);
});
```

---

## 2. Schema Design Rules

### Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Model name | PascalCase, singular | `User`, `BlogPost` |
| Field name | camelCase | `firstName`, `createdAt` |
| Relation field | camelCase | `posts`, `author` |
| Enum name | PascalCase | `UserRole`, `OrderStatus` |
| Enum value | UPPER_SNAKE_CASE | `ADMIN`, `PENDING_REVIEW` |
| Database table (@@map) | snake_case, plural | `users`, `blog_posts` |
| Database column (@map) | snake_case | `first_name`, `created_at` |

Always map model and field names to snake_case database names using `@@map` and `@map`. This keeps the Prisma schema idiomatic TypeScript while keeping the database idiomatic SQL.

```prisma
model BlogPost {
  id        String   @id @default(uuid())
  title     String
  authorId  String   @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")
  author    User     @relation(fields: [authorId], references: [id])

  @@map("blog_posts")
}
```

### Field rules

- Mark all required fields without a default as non-optional (no `?`).
- Mark genuinely optional fields with `?`.
- Never use `String` for fields with a fixed set of values — use an `enum`.
- Always add `@unique` constraints at the database level, not just application logic.
- Add `@@index` on every foreign key field and every field used in a `where` filter in production queries.

```prisma
model User {
  id    String @id @default(uuid())
  email String @unique
  role  UserRole @default(USER)
  posts Post[]

  @@map("users")
}

enum UserRole {
  ADMIN
  USER
  GUEST
}
```

### Multi-file schema

For large schemas, split into multiple files using the `prismaSchemaFolder` feature (GA in Prisma 6.5+).

```
prisma/
├── schema/
│   ├── user.prisma
│   ├── post.prisma
│   └── order.prisma
```

```prisma
// prisma/schema/user.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User { ... }
```

---

## 3. ID and Timestamp Conventions

### IDs

Use `String` UUIDs as primary keys for all models. Do not use auto-increment integers as primary keys in application code.

```prisma
model User {
  id String @id @default(uuid())
  // ...
}
```

**[PostgreSQL]** Use `@db.Uuid` for UUID fields to store as native PostgreSQL UUID type, not as a string:

```prisma
model User {
  id String @id @default(uuid()) @db.Uuid
  // ...
}
```

**Why UUIDs over auto-increment:**
- IDs are safe to expose in URLs and API responses — they don't leak record count
- Insertions can be distributed across multiple services without ID conflicts
- Easier to merge data from multiple sources

### Timestamps

Every model must have `createdAt` and `updatedAt` fields.

```prisma
model User {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

**[PostgreSQL]** Use `@db.Timestamptz` for timestamp fields to store with timezone:

```prisma
model User {
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
}
```

### Rules

- Never let the application generate UUIDs manually with `crypto.randomUUID()` and pass them as `id`. Let Prisma's `@default(uuid())` handle it.
- Never omit `createdAt` or `updatedAt` from any model.
- Never manually set `updatedAt` in queries — `@updatedAt` handles it automatically.

---

## 4. Relations

Always define relations explicitly on both sides of the relationship. Never use implicit many-to-many tables for new schemas — use explicit join models for more control.

```prisma
// ✅ Explicit relation fields on both sides
model User {
  id    String @id @default(uuid()) @db.Uuid
  posts Post[]

  @@map("users")
}

model Post {
  id       String @id @default(uuid()) @db.Uuid
  authorId String @map("author_id") @db.Uuid
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@map("posts")
}
```

### Explicit many-to-many

```prisma
// ✅ Explicit join model — more control over the relationship
model Post {
  id   String       @id @default(uuid()) @db.Uuid
  tags PostToTag[]

  @@map("posts")
}

model Tag {
  id    String      @id @default(uuid()) @db.Uuid
  posts PostToTag[]

  @@map("tags")
}

model PostToTag {
  postId    String   @map("post_id") @db.Uuid
  tagId     String   @map("tag_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_to_tags")
}
```

### `onDelete` rules

Always set `onDelete` explicitly. Never rely on the database default.

| Scenario | `onDelete` value |
|---|---|
| Child record is meaningless without parent (post without author) | `Cascade` |
| Child record can exist independently (order after user deleted) | `SetNull` (field must be optional `?`) |
| Parent deletion must be blocked if children exist | `Restrict` |

```prisma
// ✅ Cascade — post deleted when author is deleted
author User @relation(fields: [authorId], references: [id], onDelete: Cascade)

// ✅ SetNull — order preserved after user deletion (authorId is optional)
author User? @relation(fields: [authorId], references: [id], onDelete: SetNull)
```

### Index every foreign key

Every `@relation` field must have a corresponding `@@index` or `@unique`. Unindexed foreign keys cause full table scans on join queries.

```prisma
model Post {
  authorId String @map("author_id") @db.Uuid
  // ...
  @@index([authorId]) // required
}
```

---

## 5. Query Patterns

### Finding records

```ts
// Single record by unique field — throws if not found
const user = await db.user.findUniqueOrThrow({
  where: { id },
});

// Single record — returns null if not found
const user = await db.user.findUnique({
  where: { id },
});

// First match — use when filtering by non-unique field
const user = await db.user.findFirstOrThrow({
  where: { email, isActive: true },
});
```

### Rules

- Use `findUniqueOrThrow` and `findFirstOrThrow` when the record must exist. They throw `PrismaClientKnownRequestError` with code `P2025` if not found — catch it in the error handler and convert to a `NotFoundError`.
- Use `findUnique` and `findFirst` when absence is a valid state and you handle `null` explicitly.
- Never use `findMany` without a `take` limit in production. Unbounded queries can return millions of rows.
- Always add `orderBy` to `findMany` queries. Without it, order is non-deterministic.

```ts
// ✅ Always paginated and ordered
const users = await db.user.findMany({
  where: { isActive: true },
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: page * 20,
});
```

### Pagination

Use cursor-based pagination for large datasets, not offset-based. Offset pagination degrades at scale.

```ts
// ✅ Cursor-based
const users = await db.user.findMany({
  take: 20,
  skip: cursor ? 1 : 0,    // skip the cursor itself
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'asc' },
});

const nextCursor = users.length === 20 ? users[users.length - 1]?.id : undefined;
```

### Upsert

Use `upsert` for create-or-update operations. Do not manually check existence then create or update.

```ts
// ✅
const user = await db.user.upsert({
  where: { email },
  update: { name },
  create: { email, name },
});
```

### Atomic updates

Use atomic operations for numeric fields to prevent race conditions. Never read a value, modify it in JS, then write it back.

```ts
// ❌ Race condition — two concurrent requests both read 5, both write 6
const post = await db.post.findUniqueOrThrow({ where: { id } });
await db.post.update({ where: { id }, data: { views: post.views + 1 } });

// ✅ Atomic — database handles the increment
await db.post.update({
  where: { id },
  data: { views: { increment: 1 } },
});
```

---

## 6. Select and Include — Avoiding Overfetching

By default Prisma returns all scalar fields and no relations. Always be explicit about what you need.

### `select` — return only specific fields

```ts
// ✅ Only fetch what the caller needs
const user = await db.user.findUniqueOrThrow({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    // password, internalNotes, etc. are NOT returned
  },
});
```

### `include` — return all scalar fields plus relations

```ts
// ✅ Return user with posts
const user = await db.user.findUniqueOrThrow({
  where: { id },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    },
  },
});
```

### `omit` — exclude specific fields (Prisma 6 GA)

Use `omit` when you want all fields except one or two (e.g. password hash).

```ts
// ✅ All fields except password
const user = await db.user.findUniqueOrThrow({
  where: { id },
  omit: { password: true },
});
```

### Global omit (client-level)

For fields that should never appear in any query result (e.g. password), configure `omit` at the client level.

```ts
export const db = new PrismaClient({
  omit: {
    user: { password: true },
  },
});
```

### Rules

- Never return a full model to an API response when only a subset of fields is needed. Use `select`.
- Never use `include` without also specifying `where`, `take`, and `orderBy` on the included relation when the relation is a list.
- Never combine `select` and `omit` in the same query — Prisma does not allow it.
- Always omit password hashes and sensitive internal fields. Configure global `omit` at the client level for fields that must never be exposed.

---

## 7. Transactions

Use transactions when multiple writes must succeed or fail together.

### Sequential transactions (simple)

Pass an array of Prisma operations. They run in sequence and roll back together if any fails.

```ts
// ✅ Both create or neither does
const [user, account] = await db.$transaction([
  db.user.create({ data: { email, name } }),
  db.account.create({ data: { userId: user.id, balance: 0 } }),
]);
```

Note: in sequential transactions you cannot reference the result of one operation in another. Use interactive transactions for that.

### Interactive transactions

Use when you need the result of one operation to inform the next.

```ts
// ✅ Transfer funds — both update or neither does
async function transferFunds(
  fromId: string,
  toId: string,
  amount: number,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const sender = await tx.account.findUniqueOrThrow({ where: { id: fromId } });

    if (sender.balance < amount) {
      throw new ValidationError('Insufficient funds');
    }

    await tx.account.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } },
    });

    await tx.account.update({
      where: { id: toId },
      data: { balance: { increment: amount } },
    });
  });
}
```

### Transaction options

Set explicit timeouts on long-running transactions.

```ts
await db.$transaction(async (tx) => {
  // ...
}, {
  maxWait: 5000,   // max time to wait for a transaction slot (ms)
  timeout: 10000,  // max time the transaction can run (ms)
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
});
```

### Rules

- Always use `tx` (the transaction client) inside `$transaction` callbacks. Never use `db` inside a transaction callback — those queries run outside the transaction.
- Throw inside the transaction callback to trigger a rollback. Prisma rolls back automatically when the callback throws.
- Keep interactive transactions short. Long-held transactions lock rows and degrade performance under concurrency.
- Use `ReadCommitted` isolation level for most operations. Use `Serializable` only when strict consistency is required (financial operations).
- Bulk operations (`createMany`, `updateMany`, `deleteMany`) are automatically transactional — no need to wrap them in `$transaction`.

---

## 8. Migrations

### Development workflow

```bash
# Create and apply a migration locally
npx prisma migrate dev --name descriptive-name

# Reset the development database (drops and re-creates)
npx prisma migrate reset

# Inspect current database schema (pulls schema from DB)
npx prisma db pull
```

### Production workflow

```bash
# Apply pending migrations in production — never use migrate dev in production
npx prisma migrate deploy
```

### Rules

- Never run `prisma migrate dev` in production. It can reset the database.
- Never run `prisma db push` in production. It applies schema changes without creating a migration file — your migration history becomes inaccurate.
- Always run `prisma migrate deploy` in production as part of the deployment pipeline, before starting the application.
- Every schema change must have a migration file committed to version control. Never edit the database schema manually in production.
- Give migrations descriptive names: `add-user-role`, `create-orders-table`, `add-index-post-author-id`. Never use the default timestamp-only name.
- Never edit a migration file after it has been applied to any environment. Create a new migration to fix it.
- After upgrading to Prisma 6 from Prisma 5 on PostgreSQL, run a dedicated migration immediately to apply the implicit m-n relation schema changes:
  ```bash
  npx prisma migrate dev --name upgrade-to-prisma-6
  ```

---

## 9. Error Handling

Prisma throws typed errors. Always catch and handle them specifically.

### Prisma error types

| Error class | When it occurs |
|---|---|
| `PrismaClientKnownRequestError` | Known database errors (unique constraint, not found, foreign key violation) |
| `PrismaClientUnknownRequestError` | Unknown database errors |
| `PrismaClientRustPanicError` | Internal Prisma engine crash |
| `PrismaClientInitializationError` | Failed to connect to the database on startup |
| `PrismaClientValidationError` | Invalid query structure (wrong field name, wrong type) |

**Note:** `NotFoundError` was removed in Prisma 6. Use `PrismaClientKnownRequestError` with code `P2025` instead.

### Common error codes

| Code | Meaning |
|---|---|
| `P2002` | Unique constraint violation |
| `P2003` | Foreign key constraint violation |
| `P2025` | Record not found (`findUniqueOrThrow`, `update`, `delete` on missing record) |
| `P2034` | Transaction conflict — retry the transaction |

### Handling errors in repositories

Catch Prisma errors in the repository layer. Convert them to domain errors before they reach the service or controller.

```ts
// src/repositories/userRepository.ts
import { Prisma } from '../generated/prisma/index.js';
import { db } from '../lib/db.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

export async function createUser(data: CreateUserInput): Promise<User> {
  try {
    return await db.user.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictError('A user with this email already exists');
      }
    }
    throw error; // re-throw unknown errors
  }
}

export async function getUserById(id: string): Promise<User> {
  try {
    return await db.user.findUniqueOrThrow({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new NotFoundError('User');
      }
    }
    throw error;
  }
}
```

### Rules

- Always catch `PrismaClientKnownRequestError` in repositories and convert to domain errors.
- Never let raw Prisma errors reach the HTTP layer. They contain internal schema details.
- Always re-throw errors that are not `PrismaClientKnownRequestError` — do not swallow unknown errors.
- For transaction conflicts (`P2034`), implement retry logic with exponential backoff.

---

## 10. Type Utilities

Use Prisma's generated types instead of defining your own. They stay in sync with the schema automatically.

### `Prisma.ModelGetPayload`

Use to type the result of a query with `select` or `include`.

```ts
import type { Prisma } from '../generated/prisma/index.js';

// Type for a user with selected fields
type UserSummary = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
  };
}>;

// Type for a post with its author included
type PostWithAuthor = Prisma.PostGetPayload<{
  include: { author: true };
}>;
```

### Input types

Use Prisma's generated input types for create and update operations.

```ts
import type { Prisma } from '../generated/prisma/index.js';

type CreateUserInput = Prisma.UserCreateInput;
type UpdateUserInput = Prisma.UserUpdateInput;

// For operations using where
type UserWhereInput = Prisma.UserWhereInput;
type UserOrderByInput = Prisma.UserOrderByWithRelationInput;
```

### Rules

- Never manually define TypeScript types that duplicate what Prisma already generates. Use `Prisma.ModelGetPayload` and input types.
- Import types with `import type` — they are erased at compile time and do not bloat the bundle.
- Use `Prisma.ModelGetPayload` for the return type of every repository function that uses `select` or `include`. This ensures the caller knows exactly what fields are present.

---

## 11. Performance — N+1 and Query Optimisation

### The N+1 problem

N+1 occurs when you fetch a list (1 query), then loop through results and query a relation per item (N queries).

```ts
// ❌ N+1 — 1 query for users + 1 query per user for posts
const users = await db.user.findMany();
for (const user of users) {
  const posts = await db.post.findMany({ where: { authorId: user.id } });
}

// ✅ Single query — fetch users with posts in one round-trip
const users = await db.user.findMany({
  include: { posts: true },
});

// ✅ Alternative — batch query with IN filter
const users = await db.user.findMany();
const posts = await db.post.findMany({
  where: { authorId: { in: users.map(u => u.id) } },
});
```

### `relationLoadStrategy: 'join'`

Use `relationLoadStrategy: 'join'` to execute the query as a single SQL JOIN instead of multiple round-trips. Available for PostgreSQL and CockroachDB.

```ts
// ✅ Single SQL query with JOIN
const users = await db.user.findMany({
  relationLoadStrategy: 'join',
  include: { posts: true },
});
```

### `findUnique` batching

Prisma's dataloader automatically batches `findUnique` calls with the same `select` and `where` parameters that occur in the same tick. This is automatic — no configuration needed. Use `findUnique` (not `findFirst`) to benefit from this batching.

### Indexes

Add indexes for every field used in `where` filters, `orderBy` clauses, and foreign keys.

```prisma
model Post {
  id        String   @id @default(uuid()) @db.Uuid
  authorId  String   @map("author_id") @db.Uuid
  status    PostStatus
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([authorId])                    // foreign key
  @@index([status, createdAt(sort: Desc)]) // compound — used together in queries
  @@map("posts")
}
```

### Query logging in development

Enable query logging in development to see every SQL query Prisma executes.

```ts
export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }]
    : ['warn', 'error'],
});

if (process.env.NODE_ENV === 'development') {
  db.$on('query', (e) => {
    logger.debug({ query: e.query, duration: e.duration }, 'Prisma query');
  });
}
```

---

## 12. Raw Queries

Use Prisma's query API for all standard operations. Use raw SQL only when the query API cannot express what you need or when you need heavily optimised queries.

### `$queryRaw` — tagged template literal (safe)

Always use tagged template literals. Prisma parameterises the values automatically, preventing SQL injection.

```ts
import { Prisma } from '../generated/prisma/index.js';

// ✅ Safe — values are parameterised
const email = 'user@example.com';
const users = await db.$queryRaw<User[]>`
  SELECT * FROM "users" WHERE email = ${email}
`;

// ✅ Dynamic query with Prisma.sql helper
const condition = Prisma.sql`WHERE status = ${status}`;
const users = await db.$queryRaw<User[]>`
  SELECT * FROM "users" ${condition}
`;
```

### `$queryRawUnsafe` — string interpolation (unsafe)

Only use `$queryRawUnsafe` for query structure that cannot be expressed with tagged templates (e.g. dynamic table names, dynamic column names). Never pass user input to `$queryRawUnsafe`.

```ts
// ✅ Acceptable — table name from internal config, not user input
const tableName = getTableName(); // internal, validated value
const result = await db.$queryRawUnsafe(
  `SELECT * FROM "${tableName}" LIMIT 100`
);

// ❌ Never — user input in raw string
const result = await db.$queryRawUnsafe(
  `SELECT * FROM "users" WHERE name = '${req.body.name}'`
);
```

### TypedSQL (Prisma 6 GA)

For complex raw queries, use TypedSQL — write SQL in `.sql` files and get full TypeScript types generated automatically.

```sql
-- prisma/sql/getUsersByRole.sql
SELECT id, name, email FROM users WHERE role = $1
```

```ts
import { getUsersByRole } from '../generated/prisma/sql/index.js';

const admins = await db.$queryRawTyped(getUsersByRole('ADMIN'));
// admins is fully typed based on the SQL query
```

### Rules

- Default to Prisma's query API. Use raw queries only as an escape hatch.
- Always use tagged template literals (`$queryRaw`) for raw queries with user-controlled values.
- Never concatenate user input into a raw SQL string.
- Use TypedSQL for complex raw queries to maintain type safety.
- Place all `.sql` files in `prisma/sql/`. Do not scatter raw SQL strings across service files.

---

## 13. Soft Deletes

Soft deletes mark records as deleted without removing them from the database. Use them when you need audit history, data recovery, or referential integrity without hard cascades.

### Schema

```prisma
model Post {
  id        String    @id @default(uuid()) @db.Uuid
  title     String
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz // null = active, set = deleted

  @@index([deletedAt]) // index for filtering active records
  @@map("posts")
}
```

### Query helpers

Create explicit helper functions for soft-delete operations. Never scatter `where: { deletedAt: null }` throughout the codebase.

```ts
// src/repositories/postRepository.ts

// Only active records
export async function findActivePosts() {
  return db.post.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

// Soft delete
export async function softDeletePost(id: string) {
  return db.post.update({
    where: { id, deletedAt: null }, // prevent double-delete
    data: { deletedAt: new Date() },
  });
}

// Hard delete (admin only, explicit)
export async function hardDeletePost(id: string) {
  return db.post.delete({ where: { id } });
}

// Include deleted records (admin, audit)
export async function findAllPostsIncludingDeleted() {
  return db.post.findMany({ orderBy: { createdAt: 'desc' } });
}
```

### Rules

- All queries on soft-deleted models must filter by `deletedAt: null` unless explicitly fetching deleted records.
- Never name the field `isDeleted` (boolean) — use `deletedAt` (DateTime nullable). The timestamp provides an audit trail and is queryable by date.
- Centralise soft-delete queries in the repository layer. Do not let callers pass raw `where: { deletedAt: null }` — it will be missed somewhere.
- Hard delete functions must be named explicitly (`hardDelete...`) and protected with admin authorization.
- When using soft deletes with unique constraints, the constraint must account for deleted records. Use a partial unique index in the database to enforce uniqueness only on active records.

```prisma
// Unique email among active (non-deleted) users only
model User {
  email     String
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz

  @@unique([email]) // This will conflict with soft-deleted records
  // Instead: use a raw migration to create a partial index:
  // CREATE UNIQUE INDEX users_email_active_unique ON users(email) WHERE deleted_at IS NULL;
}
```

---

## 14. Anti-Patterns

**Never do these.**

### Client

- Calling `new PrismaClient()` more than once — creates multiple connection pools.
- Using `db` inside a `$transaction` callback — use `tx` instead.
- Not calling `db.$disconnect()` on graceful shutdown.
- Importing from `@prisma/client` instead of the generated output path.

### Schema

- Using `Int` auto-increment as a primary key — use `String` UUID.
- No `@@map` or `@map` annotations — results in PascalCase table names and camelCase columns in SQL.
- No `onDelete` on relations — relies on database default which varies by provider.
- Foreign key fields without `@@index` — causes full table scans.
- Using `String` for fixed-value fields instead of `enum`.
- Not adding `createdAt` and `updatedAt` to every model.

### Queries

- `findMany` without `take` — unbounded query, can return the whole table.
- `findMany` without `orderBy` — non-deterministic results.
- Manual read-modify-write for numeric fields instead of `increment`/`decrement`.
- Using `findFirst` when `findUnique` is possible — loses automatic batching.
- Not handling `null` from `findUnique` / `findFirst` explicitly.

### Transactions

- Using `db` inside a `$transaction` callback instead of `tx`.
- Long interactive transactions that hold locks — keep them short.
- Not retrying on `P2034` (transaction conflict) for concurrent write operations.

### Raw queries

- Concatenating user input into `$queryRawUnsafe` — SQL injection.
- Using raw queries for operations Prisma's query API already supports.
- Scattering `.sql` strings across service files instead of using TypedSQL.

### Soft deletes

- Forgetting `where: { deletedAt: null }` on any query — accidentally exposes deleted records.
- Using a boolean `isDeleted` field instead of a `deletedAt` timestamp.
- Unique constraints that don't account for soft-deleted records.

### Migrations

- Running `prisma migrate dev` or `prisma db push` in production.
- Editing a migration file after it has been applied to any environment.
- Applying schema changes manually in the database without a migration file.
- Not running `prisma migrate deploy` before starting the app in production.
