# TypeScript Coding Guidelines

<!-- meta
target: TypeScript 5.x
last_reviewed: 2026-06
sources: typescriptlang.org, github.com/microsoft/TypeScript
extends: none
-->

> Universal rules. Apply these to every project that uses TypeScript — frontend, backend, fullstack. Framework-specific files (react-rules.md, nextjs-rules.md, node-rules.md, etc.) extend these rules and override them only where explicitly stated.

---

## Table of Contents

1. [tsconfig Requirements](#1-tsconfig-requirements)
2. [Types vs Interfaces](#2-types-vs-interfaces)
3. [Naming Conventions](#3-naming-conventions)
4. [Null and Undefined](#4-null-and-undefined)
5. [Type Assertions and Escape Hatches](#5-type-assertions-and-escape-hatches)
6. [Generics](#6-generics)
7. [Utility Types](#7-utility-types)
8. [Discriminated Unions](#8-discriminated-unions)
9. [Enums](#9-enums)
10. [Functions](#10-functions)
11. [Async and Promises](#11-async-and-promises)
12. [Type Guards and Narrowing](#12-type-guards-and-narrowing)
13. [Imports](#13-imports)
14. [Error Handling](#14-error-handling)
15. [Anti-Patterns](#15-anti-patterns)

---

## 1. tsconfig Requirements

Every TypeScript project must use this baseline `tsconfig.json`. Do not remove or weaken any of these flags.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### What each flag above `strict` adds

| Flag | What it catches |
|---|---|
| `noUncheckedIndexedAccess` | Array index and object key access returns `T \| undefined`, not `T`. Forces you to check before use. |
| `noUnusedLocals` | Variables declared but never used — compile error. |
| `noUnusedParameters` | Function parameters declared but never used — compile error. Prefix with `_` to intentionally ignore one. |
| `noImplicitReturns` | Functions that have a return type must return on every code path. |
| `exactOptionalPropertyTypes` | `{ prop?: string }` means `prop` is `string` or absent. Assigning `undefined` explicitly is a type error. |
| `verbatimModuleSyntax` | Forces `import type` for type-only imports. Prevents type imports from bloating runtime bundles. |

---

## 2. Types vs Interfaces

### Rule

- Use `interface` for object shapes (data models, API contracts, class shapes).
- Use `type` for everything else: unions, intersections, primitives, tuples, mapped types, utility type aliases.

```ts
// ✅ interface for object shapes
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// ✅ interface extension
interface AdminUser extends User {
  permissions: string[];
}

// ✅ type for unions
type UserRole = 'admin' | 'user' | 'guest';

// ✅ type for discriminated unions
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: number };

// ✅ type for utility type transformations
type CreateUserInput = Omit<User, 'id'>;
type UpdateUserInput = Partial<CreateUserInput>;

// ✅ type for tuples
type Coordinates = [number, number];

// ✅ type for function signatures (when used as a type alias)
type Validator<T> = (value: T) => boolean;
```

### Never mix the two inconsistently

Pick the rule above and apply it everywhere. Do not alternate between `type` and `interface` for object shapes within the same project.

---

## 3. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Interface | PascalCase, no `I` prefix | `User`, `ApiResponse` |
| Type alias | PascalCase | `UserRole`, `ApiResult` |
| Generic type parameter | Single uppercase letter or PascalCase noun | `T`, `K`, `TData`, `TError` |
| Enum | PascalCase name, UPPER_SNAKE_CASE values | `UserRole.ADMIN` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Boolean variable | `is`, `has`, `should`, `can` prefix | `isLoading`, `hasError` |
| Function | camelCase | `fetchUser`, `formatDate` |
| Class | PascalCase | `UserService`, `ApiClient` |
| File | camelCase for utilities, PascalCase for classes/components | `formatDate.ts`, `UserService.ts` |

Do not prefix interfaces with `I` (e.g., `IUser`). This is an outdated convention.

---

## 4. Null and Undefined

- Prefer `undefined` over `null` for optional or missing values unless an external API or database forces `null`.
- Never use non-null assertion (`!`) to silence a TypeScript error. Narrow the type explicitly instead.
- Always handle `undefined` from array access when `noUncheckedIndexedAccess` is on.

```ts
// ❌ Silences the error without fixing it
const name = user!.name;

// ✅ Narrow explicitly
if (!user) throw new Error('User not found');
const name = user.name;

// ✅ Or use optional chaining with a fallback
const name = user?.name ?? 'Anonymous';

// ❌ noUncheckedIndexedAccess — items[0] is string | undefined
const items: string[] = getItems();
const first = items[0].toUpperCase(); // compile error

// ✅
const first = items[0];
if (first !== undefined) {
  first.toUpperCase();
}

// ✅ Or with nullish coalescing
const first = items[0] ?? '';
```

---

## 5. Type Assertions and Escape Hatches

### `as` (type assertion)

Only use `as` when you have information TypeScript cannot infer and you can verify the assertion is correct. Never use it to silence a type error you don't understand.

```ts
// ✅ Acceptable — asserting after a runtime check
const el = document.getElementById('root') as HTMLDivElement;
// (only if you are certain the element exists and is a div)

// ❌ Using as to silence a mismatch
const user = response.data as User; // response.data is `unknown` — this is unsafe
```

When dealing with unknown external data (API responses, JSON, form inputs), validate and narrow the type — do not cast it.

### `any`

Never use `any`. If you encounter a situation where you think you need `any`:
- Use `unknown` and narrow before use.
- Use a generic.
- Fix the type definition.

```ts
// ❌
function process(data: any) {
  return data.value;
}

// ✅
function process(data: unknown): string {
  if (typeof data !== 'object' || data === null || !('value' in data)) {
    throw new Error('Invalid data shape');
  }
  return String((data as { value: unknown }).value);
}
```

### `@ts-ignore`

Never use `@ts-ignore`. Use `@ts-expect-error` if suppression is unavoidable — it fails compilation when the error no longer exists, preventing stale suppressions.

```ts
// ❌
// @ts-ignore
legacyFunction(wrongType);

// ✅ Only if truly unavoidable, with explanation
// @ts-expect-error: third-party type definition is wrong, upstream issue #1234
legacyFunction(wrongType);
```

### `as unknown as T`

Double casting (`as unknown as T`) is always a red flag. It means you are bypassing the type system entirely. If you feel the need to do this, the type definitions are wrong — fix them.

---

## 6. Generics

Use generics when a function, class, or type needs to work with multiple types while preserving type information.

```ts
// ✅ Generic fetch wrapper — preserves return type
async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const user = await apiFetch<User>('/api/user/1');
// user is typed as User
```

### Constraints

Use `extends` to constrain generics when you need to access specific properties.

```ts
// ✅ Constrained generic
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// ✅ Constrained to objects with an id
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

### Rules

- Name generic parameters meaningfully when the function is complex: `TData`, `TError`, `TInput`, `TOutput`. Single letters (`T`, `K`, `V`) are fine for simple, short functions.
- Do not add generics when the type is always fixed. Generics are for flexibility — not decoration.
- Do not over-constrain generics. If a constraint is too specific, the function is no longer reusable.

---

## 7. Utility Types

Use TypeScript's built-in utility types. Do not manually recreate what they already do.

| Utility | Use case |
|---|---|
| `Partial<T>` | All properties of `T` become optional. Use for update/patch inputs. |
| `Required<T>` | All properties of `T` become required. |
| `Readonly<T>` | All properties become read-only. Use for config objects, frozen state. |
| `Pick<T, K>` | Keep only the specified keys from `T`. |
| `Omit<T, K>` | Remove the specified keys from `T`. Use for create inputs (omit `id`, `createdAt`). |
| `Record<K, V>` | Object with keys of type `K` and values of type `V`. |
| `Exclude<T, U>` | Remove types from a union. |
| `Extract<T, U>` | Keep only matching types from a union. |
| `NonNullable<T>` | Remove `null` and `undefined` from a type. |
| `ReturnType<T>` | Extract the return type of a function. |
| `Parameters<T>` | Extract the parameter types of a function as a tuple. |
| `Awaited<T>` | Unwrap a `Promise<T>` to `T`. |

```ts
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Input for creating a user — no id or timestamp
type CreateUserInput = Omit<User, 'id' | 'createdAt'>;

// Input for updating — all fields optional except id
type UpdateUserInput = Partial<Omit<User, 'id'>> & { id: string };

// Safe lookup map
const userMap: Record<string, User> = {};
```

---

## 8. Discriminated Unions

Use discriminated unions to model state that has mutually exclusive shapes. This eliminates impossible states and makes narrowing automatic.

```ts
// ✅ Discriminated union for async state
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

function render<T>(state: AsyncState<T>) {
  switch (state.status) {
    case 'idle':    return null;
    case 'loading': return <Spinner />;
    case 'success': return <View data={state.data} />; // data is T here
    case 'error':   return <Error message={state.error} />; // error is string here
  }
}
```

### Exhaustiveness checking

Use `never` to enforce that all branches of a discriminated union are handled. If a new variant is added to the union, TypeScript will error at the `never` assignment.

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

function handleStatus(status: 'active' | 'inactive' | 'banned') {
  switch (status) {
    case 'active':   return 'green';
    case 'inactive': return 'grey';
    case 'banned':   return 'red';
    default:         return assertNever(status); // compile error if a case is missing
  }
}
```

---

## 9. Enums

Avoid TypeScript `enum`. Use `as const` objects or string literal union types instead.

### Why not `enum`

- Numeric enums have unsafe reverse mappings.
- Enums generate runtime JavaScript — `as const` objects do not (zero-cost).
- String literal unions are simpler and composable with utility types.

```ts
// ❌ TypeScript enum
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// ✅ String literal union — preferred for simple cases
type Direction = 'up' | 'down' | 'left' | 'right';

// ✅ as const object — preferred when you need the values as a collection
const Direction = {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
} as const;

type Direction = typeof Direction[keyof typeof Direction];
// Direction = 'up' | 'down' | 'left' | 'right'
```

Exception: Use `const enum` only when interfacing with external systems (e.g., a database schema generator or code generator) that produces TypeScript enums. Even then, document why.

---

## 10. Functions

- Always annotate return types on exported functions. Rely on inference only for internal, short, private functions.
- Use function declarations for top-level, named functions. Use arrow functions for callbacks and inline expressions.

```ts
// ✅ Exported function — explicit return type
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

// ✅ Arrow function for callbacks
const filtered = users.filter((user) => user.isActive);

// ❌ No return type on exported function
export function getUser(id: string) { // inferred — not explicit
  return db.users.findUnique({ where: { id } });
}
```

- Never use `Function` as a type. Use a specific function signature.

```ts
// ❌
type Handler = Function;

// ✅
type Handler = (event: MouseEvent) => void;
type AsyncHandler = (id: string) => Promise<void>;
```

- Use function overloads when a function behaves differently based on argument types — do not use union types in parameters to approximate this.

```ts
// ✅ Overloads
function parse(value: string): number;
function parse(value: number): string;
function parse(value: string | number): string | number {
  if (typeof value === 'string') return parseInt(value, 10);
  return String(value);
}
```

---

## 11. Async and Promises

- Always use `async/await`. Never use raw `.then()/.catch()` chains for new code.
- Always type `Promise` return values explicitly on exported async functions.
- Always handle the rejected case. An unhandled `Promise` rejection is a runtime crash.

```ts
// ✅
export async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json() as Promise<User>;
}

// ✅ Handling errors at the call site
try {
  const user = await fetchUser(id);
} catch (error) {
  // error is `unknown` in strict mode — narrow it
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

- Never use `async` on a function that does not contain `await`. It adds unnecessary microtask overhead and misleads readers.
- For parallel async operations, use `Promise.all`. Do not `await` sequentially when the calls are independent.

```ts
// ❌ Sequential — each waits for the previous
const user = await getUser(id);
const posts = await getPosts(id);

// ✅ Parallel — both start at the same time
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

- Use `Promise.allSettled` when you need all results regardless of failures, and handle each result individually.

---

## 12. Type Guards and Narrowing

Use type guards to narrow `unknown` or union types before use. Never cast instead of narrowing.

### `typeof` and `instanceof`

```ts
function process(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase(); // string here
  }
  return value.toFixed(2); // number here
}
```

### Custom type guard functions

Use `is` predicate syntax for custom type guards.

```ts
interface Cat { meow(): void }
interface Dog { bark(): void }

function isCat(animal: Cat | Dog): animal is Cat {
  return 'meow' in animal;
}

function makeSound(animal: Cat | Dog) {
  if (isCat(animal)) {
    animal.meow(); // Cat here
  } else {
    animal.bark(); // Dog here
  }
}
```

### Validating external data

When data comes from outside TypeScript's type system (API responses, JSON parsing, form inputs, environment variables), validate before using. Do not cast.

```ts
// ❌ Unsafe — trusts the API blindly
const user = await res.json() as User;

// ✅ Safe — validate the shape at runtime
import { z } from 'zod'; // or any validation library

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const parsed = UserSchema.safeParse(await res.json());
if (!parsed.success) throw new Error('Invalid user shape from API');
const user = parsed.data; // typed as User
```

Use a validation library (Zod, Valibot, ArkType) for all external data boundaries. Do not write manual shape-checking code for complex objects.

---

## 13. Imports

### Type-only imports

Because `verbatimModuleSyntax` is required, always use `import type` for imports that are only used as types. This ensures they are erased at compile time and never bundled.

```ts
// ✅ Type-only import
import type { User } from './types';

// ✅ Mixed import — value and type from same module
import { fetchUser, type User } from './userService';

// ❌ Regular import used only as a type
import { User } from './types'; // compile error with verbatimModuleSyntax
```

### Import order

Follow this order, with a blank line between each group:

```ts
// 1. Node built-ins (backend only)
import { readFile } from 'node:fs/promises';

// 2. Third-party packages
import { z } from 'zod';

// 3. Internal absolute imports (path aliases)
import { db } from '@/lib/db';

// 4. Relative imports
import { formatDate } from './utils';
import type { UserInput } from './types';
```

### Path aliases

Always configure path aliases in `tsconfig.json` to avoid deep relative imports. Never write `../../../` chains.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 14. Error Handling

In TypeScript strict mode, caught errors are typed as `unknown`. Always narrow before accessing properties.

```ts
// ❌ error is unknown — .message access is a compile error
try {
  await riskyOperation();
} catch (error) {
  console.error(error.message); // compile error
}

// ✅ Narrow first
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown error', error);
  }
}
```

### Custom error classes

Create typed error classes for domain-specific errors. This allows callers to catch specific error types.

```ts
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

// Usage
try {
  const user = await getUser(id);
} catch (error) {
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  throw error; // re-throw unknown errors
}
```

### Result pattern (optional, for functional style)

For operations that are expected to fail regularly (validation, parsing), return a result object instead of throwing.

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function parseUser(input: unknown): Promise<Result<User, string>> {
  const parsed = UserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  return { ok: true, value: parsed.data };
}

// Call site — no try/catch needed
const result = await parseUser(body);
if (!result.ok) {
  return res.status(400).json({ error: result.error });
}
const user = result.value; // typed as User
```

---

## 15. Anti-Patterns

**Never do these.**

### Type safety violations

- Using `any` anywhere. Use `unknown` and narrow.
- Using `as` to silence a type error instead of fixing the types.
- Using `@ts-ignore`. Use `@ts-expect-error` with a comment if unavoidable.
- Double-casting with `as unknown as T`.
- Turning off `strict` or any of the required tsconfig flags.
- Using `Object`, `object`, or `{}` as a type for general objects. Use `Record<string, unknown>` or a specific interface.

### Null/undefined mishandling

- Non-null assertion (`!`) without a preceding runtime check.
- Accessing array indices without checking for `undefined` (required by `noUncheckedIndexedAccess`).
- Returning `null` from functions when the return type doesn't explicitly include `null`.

### Type design mistakes

- God interfaces — one interface with 20+ properties. Split by responsibility.
- Prefixing interfaces with `I` — `IUser`, `IService`. Remove the prefix.
- Using `enum` — use string literal unions or `as const` objects.
- Boolean parameters that change function behaviour — use discriminated unions or separate functions instead.
  ```ts
  // ❌ What does `true` mean here?
  fetchUser(id, true);

  // ✅ Named and explicit
  fetchUser(id, { includeDeleted: true });
  ```
- Optional properties (`?`) when a value is always required but might be empty — use a required field with an explicit empty state instead.

### Function mistakes

- Using `Function` as a type instead of a specific signature.
- Exported functions without explicit return types.
- `async` functions that contain no `await`.
- Sequential `await` calls for independent async operations instead of `Promise.all`.
- Swallowing errors in `catch` blocks without logging or rethrowing.

### Import mistakes

- Importing a type without `import type` when `verbatimModuleSyntax` is on.
- Deep relative imports (`../../../utils`) instead of path aliases.
- Circular imports — restructure the module so the dependency only flows one direction.
