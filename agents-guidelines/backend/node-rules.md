# Node.js Coding Guidelines

<!-- meta
target: Node.js 22 LTS
last_reviewed: 2026-06
sources: nodejs.org, cheatsheetseries.owasp.org
extends: typescript-rules.md
-->

> Universal Node.js rules. Target: **Node.js 22 LTS**. Apply these to every Node.js project. Framework-specific files (express-rules.md, fastify-rules.md, etc.) extend these rules and override them only where explicitly stated.
>
> These rules extend `typescript-rules.md`. Both files apply to every Node.js project.

---

## Table of Contents

1. [Runtime & Module System](#1-runtime--module-system)
2. [Project Structure](#2-project-structure)
3. [package.json Requirements](#3-packagejson-requirements)
4. [TypeScript Setup for Node.js](#4-typescript-setup-for-nodejs)
5. [Built-in APIs](#5-built-in-apis)
6. [Async Patterns](#6-async-patterns)
7. [Error Handling](#7-error-handling)
8. [Input Validation](#8-input-validation)
9. [Environment Variables](#9-environment-variables)
10. [Logging](#10-logging)
11. [Security](#11-security)
12. [Process Management](#12-process-management)
13. [File System](#13-file-system)
14. [Anti-Patterns](#14-anti-patterns)

---

## 1. Runtime & Module System

### Runtime

- Target **Node.js 22 LTS** (codename Jod). Do not write code that requires Node.js 20 or below.
- Use `.nvmrc` or `engines` field in `package.json` to pin the Node.js version.

### Module system

**ESM only.** Do not use CommonJS (`require`, `module.exports`). Every new project uses ES Modules.

```json
// package.json
{
  "type": "module"
}
```

- Use `import` / `export` exclusively.
- Always use the `node:` prefix for built-in modules. This makes it unambiguous that the import is a Node.js built-in and not an npm package.

```ts
// ✅
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// ❌ — ambiguous, could shadow an npm package
import { readFile } from 'fs/promises';
```

- Do not use `__dirname` or `__filename` — they are CommonJS globals. Use `import.meta.url` instead.

```ts
// ✅ ESM equivalent of __dirname
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, 'config.json');
```

---

## 2. Project Structure

```
src/
├── index.ts              # Entry point — starts the server/process
├── app.ts                # App setup — registers routes, middleware, plugins
├── config/
│   └── index.ts          # Validated environment config (single source of truth)
├── lib/                  # DB clients, third-party SDK wrappers, singletons
│   └── db.ts
├── services/             # Business logic — pure functions, no HTTP layer
│   └── userService.ts
├── repositories/         # Data access layer — all DB queries live here
│   └── userRepository.ts
├── types/                # Shared TypeScript types and interfaces
│   └── index.ts
├── utils/                # Pure utility functions (formatting, hashing, etc.)
│   └── formatDate.ts
└── errors/               # Custom error classes
    └── index.ts
```

### Rules

- **`index.ts` starts the server.** It imports `app.ts`, calls listen, and handles startup errors. It contains no business logic.
- **`services/` contains business logic.** Services are framework-agnostic — no `req`, `res`, or HTTP concepts. They call repositories and return typed data.
- **`repositories/` contains all database queries.** Services never query the database directly — they call a repository function.
- **`lib/` contains singleton clients.** DB connections, Redis clients, S3 clients — anything instantiated once and reused.
- **No circular imports.** The dependency direction is: `index → app → services → repositories → lib`. Nothing flows upward.
- **Max file size: 300 lines.** Split by responsibility if a file grows beyond this.

---

## 3. package.json Requirements

```json
{
  "name": "your-app",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  }
}
```

### Rules

- Always set `"type": "module"`.
- Always set `engines.node` to enforce the minimum version.
- Use `tsx` for local development (no build step). Use compiled output (`tsc`) for production.
- Never run TypeScript directly in production with `ts-node` or `tsx`. Always compile first and run the compiled JS.
- Pin exact dependency versions in `package.json` using `--save-exact`. Use lockfiles (`package-lock.json`) and commit them.

---

## 4. TypeScript Setup for Node.js

Add these Node.js-specific settings on top of the base `typescript-rules.md` tsconfig:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### Rules

- Use `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`. This is the correct setting for ESM in Node.js — it enforces file extensions in imports and aligns with how Node.js resolves modules.
- Always include file extensions in relative imports when using `NodeNext` resolution.

```ts
// ✅ — extension required with NodeNext
import { formatDate } from './utils/formatDate.js';

// ❌ — no extension, will fail at runtime
import { formatDate } from './utils/formatDate';
```

Note: Use `.js` extension even for `.ts` source files. TypeScript compiles `.ts` to `.js` — the import path must match the compiled output.

- Enable `sourceMap: true` so production error stack traces map back to TypeScript source lines.
- Enable `declaration: true` if building a library or shared package.

---

## 5. Built-in APIs

Use Node.js 22 built-in APIs. Do not install third-party packages when a built-in covers the use case.

### Fetch

Use the native `fetch` API. Do not install `axios`, `node-fetch`, or `got` for basic HTTP requests.

```ts
// ✅ Native fetch — available in Node.js 18+, stable in 22
const res = await fetch('https://api.example.com/users');
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json() as unknown;
```

Install `axios` or similar only when you need interceptors, automatic retries, or request cancellation that would require significant boilerplate with native `fetch`.

### File system

Always use `node:fs/promises` for async file operations. Never use the callback-based `node:fs` API in new code.

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const content = await readFile('./data.json', 'utf-8');
await mkdir('./output', { recursive: true });
await writeFile('./output/result.json', JSON.stringify(data));
```

### Crypto

Use `node:crypto` for all cryptographic operations. Never use third-party crypto libraries unless they provide an algorithm not in Node.js core.

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Hashing
const hash = createHash('sha256').update(input).digest('hex');

// Secure random tokens
const token = randomBytes(32).toString('hex');

// Timing-safe comparison (for secrets, tokens, passwords)
// Always use this — never ===
const isValid = timingSafeEqual(
  Buffer.from(providedToken),
  Buffer.from(expectedToken),
);
```

### Path

Always use `node:path` for path manipulation. Never concatenate paths with string templates.

```ts
import { join, resolve, extname, basename } from 'node:path';

// ✅
const filePath = join(baseDir, 'uploads', fileName);

// ❌ — breaks on Windows, path traversal risk
const filePath = `${baseDir}/uploads/${fileName}`;
```

### URL

Use the WHATWG `URL` class. Never use the legacy `url.parse()`.

```ts
// ✅
const url = new URL('/api/users', 'https://example.com');
url.searchParams.set('page', '2');

// ❌ — deprecated
import { parse } from 'node:url';
const parsed = parse('https://example.com/api/users');
```

---

## 6. Async Patterns

- Always `async/await`. No raw `.then()/.catch()` chains.
- Run independent async operations in parallel with `Promise.all`.
- Use `Promise.allSettled` when you need all results regardless of individual failures.

```ts
// ❌ Sequential — unnecessary wait
const user = await getUser(id);
const posts = await getUserPosts(id);

// ✅ Parallel
const [user, posts] = await Promise.all([getUser(id), getUserPosts(id)]);
```

### AbortController

Use `AbortController` to cancel fetch requests and other async operations when a timeout or early exit is needed.

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch('https://api.example.com/data', {
    signal: controller.signal,
  });
  const data = await res.json();
  return data;
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    throw new Error('Request timed out');
  }
  throw error;
} finally {
  clearTimeout(timeoutId);
}
```

### AsyncLocalStorage

Use `AsyncLocalStorage` from `node:async_hooks` for request-scoped context (request ID, user session) that needs to propagate through the async call stack without passing it through every function.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// In middleware — wrap the handler in a context
requestContext.run({ requestId: crypto.randomUUID() }, () => {
  next();
});

// Anywhere in the call stack — access the context
const ctx = requestContext.getStore();
logger.info({ requestId: ctx?.requestId }, 'Processing request');
```

---

## 7. Error Handling

### Custom error classes

Define a base `AppError` class. All application errors extend it. This allows callers to distinguish application errors from unexpected system errors.

```ts
// src/errors/index.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}
```

### Catching errors

```ts
try {
  const user = await userService.getUser(id);
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle known operational error
    return res.status(404).json({ error: error.message });
  }
  // Unknown error — log and re-throw for global handler
  logger.error({ error }, 'Unexpected error in getUser');
  throw error;
}
```

### Rules

- Never swallow errors silently in an empty `catch` block.
- Never `console.error` and continue as if nothing happened. Log and either handle or re-throw.
- Distinguish **operational errors** (expected: not found, validation failure, auth failure) from **programmer errors** (unexpected: null pointer, wrong type). Operational errors are handled gracefully. Programmer errors should crash the process in development and be caught by the global handler in production.
- `isOperational: true` on an error means it is safe to send the message to the client. `isOperational: false` or absent means log it and return a generic message.

---

## 8. Input Validation

**All external input must be validated before use.** External input includes: HTTP request bodies, query parameters, route parameters, headers, environment variables, file contents, and any data from a database or third-party API.

Use **Zod** as the standard validation library.

```ts
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  age: z.number().int().min(0).max(150).optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

export async function createUser(body: unknown): Promise<User> {
  // Parse throws ZodError if invalid — catch it in your error handler
  const input = CreateUserSchema.parse(body);

  // input is now fully typed as CreateUserInput
  return userRepository.create(input);
}
```

### Rules

- Define schemas next to where they are used, or in a dedicated `schemas/` folder for shared ones.
- Use `z.infer<typeof Schema>` to derive TypeScript types from schemas. Do not define the type separately and duplicate the shape.
- Use `.parse()` when invalid input should throw. Use `.safeParse()` when you want to handle the error manually without try/catch.
- Never use `as UserInput` to cast an unvalidated `unknown` value. Always parse through Zod first.
- Validate at the boundary — as close to where data enters the system as possible (route handler or service entry point). Do not pass raw `req.body` through multiple layers before validating.

---

## 9. Environment Variables

Centralise all environment variable access in `src/config/index.ts`. No other file reads `process.env` directly.

```ts
// src/config/index.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

// Validate at startup — throws if any required variable is missing or invalid
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

### Rules

- Validate env vars at startup with Zod. A missing or malformed env var must crash the process immediately with a clear error message — not silently fail later at runtime.
- Use `z.coerce.number()` for numeric env vars — all `process.env` values are strings.
- Never access `process.env.VARIABLE` inline throughout the codebase. Always import from `config`.
- Never log the full `config` object — it contains secrets. Log only non-sensitive fields.
- Maintain a `.env.example` file committed to the repo with all required keys and example (non-real) values.
- Never commit `.env` or `.env.local` to version control. Add them to `.gitignore`.

---

## 10. Logging

Use **Pino** as the standard logger. It is the fastest Node.js logger, outputs structured JSON, and is the standard for production Node.js applications.

```ts
// src/lib/logger.ts
import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});
```

### Usage

```ts
import { logger } from '../lib/logger.js';

// ✅ Structured — log data as the first argument, message as second
logger.info({ userId: user.id, action: 'login' }, 'User logged in');
logger.error({ error, requestId }, 'Failed to process payment');

// ❌ Unstructured — message only, no queryable data
logger.info(`User ${user.id} logged in`);
```

### Rules

- Always log structured data — first argument is an object with context, second is the message string.
- Never log sensitive data: passwords, tokens, API keys, full credit card numbers, PII beyond what is necessary.
- Use log levels correctly:
  - `trace` — fine-grained debugging, off in production
  - `debug` — diagnostic info, off in production
  - `info` — normal operational events (server started, user action completed)
  - `warn` — unexpected but recoverable situations
  - `error` — errors that affect a request or operation, need investigation
- Never use `console.log`, `console.error`, or `console.warn` in production code. All logging goes through the Pino logger.
- Include `requestId` in every log line within a request context. Use `AsyncLocalStorage` to propagate it.

---

## 11. Security

These rules are derived from the official Node.js security documentation and the OWASP Node.js Security Cheat Sheet.

### Never trust external input

Validate and sanitise every value that comes from outside the process — HTTP requests, environment variables, files, database results from untrusted sources.

### Secrets

- Never hardcode secrets, API keys, or credentials in source code.
- Never log secrets, even in debug mode.
- Load secrets from environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault).
- Rotate secrets regularly. Design the config layer to support rotation without a code change.

### Timing-safe comparisons

Always use `timingSafeEqual` from `node:crypto` when comparing secret values (tokens, passwords, HMAC digests). String `===` comparison leaks timing information that can be exploited.

```ts
import { timingSafeEqual } from 'node:crypto';

function isTokenValid(provided: string, expected: string): boolean {
  // Both buffers must be the same length for timingSafeEqual
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
```

### Path traversal

Never construct file paths from user input directly. Always sanitise and validate paths.

```ts
import { join, resolve, normalize } from 'node:path';

function safeReadFile(userProvidedName: string, baseDir: string): string {
  // Strip any path components from the filename
  const safeName = basename(userProvidedName);

  // Resolve the full path and verify it is inside the base directory
  const fullPath = resolve(join(baseDir, safeName));
  if (!fullPath.startsWith(resolve(baseDir))) {
    throw new ValidationError('Invalid file path');
  }

  return fullPath;
}
```

### Dependency security

- Run `npm audit` in CI. Block deployments on high-severity vulnerabilities.
- Pin exact dependency versions (`--save-exact`).
- Review `package.json` and `package-lock.json` changes carefully in code reviews.
- Do not install packages with `postinstall` scripts unless you have reviewed the script source.

### Prototype pollution

- Never use user input as object keys without checking against a schema.
- Prefer `Object.create(null)` for dictionaries that use arbitrary keys.
- Use `Object.hasOwn(obj, key)` instead of `obj.hasOwnProperty(key)`.

---

## 12. Process Management

### Graceful shutdown

Always handle `SIGTERM` and `SIGINT` signals and shut down gracefully — close database connections, finish in-flight requests, flush logs.

```ts
// src/index.ts
import { createServer } from 'node:http';
import { app } from './app.js';
import { db } from './lib/db.js';
import { logger } from './lib/logger.js';

const server = createServer(app);

server.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server started');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');

  server.close(async () => {
    try {
      await db.end(); // close DB connection pool
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### Unhandled errors

Register handlers for unhandled rejections and uncaught exceptions. Log the error, then exit. Never ignore these.

```ts
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});
```

### Rules

- Never call `process.exit()` in business logic or service code. Only call it in `index.ts` during startup failures or shutdown handlers.
- Do not catch `uncaughtException` and attempt to continue running. The process state is unknown after an uncaught exception — exit and let the process manager (PM2, Kubernetes, systemd) restart it.

---

## 13. File System

- Always use `node:fs/promises` — never the callback-based `node:fs` API.
- Always handle `ENOENT` (file not found) explicitly — do not let it bubble up as an unhandled error.
- Use `{ recursive: true }` with `mkdir` to avoid errors when the directory already exists.
- Never construct file paths by concatenating strings. Always use `node:path` functions.
- Always close file handles. Prefer the higher-level `readFile`/`writeFile` functions over manually managing file descriptors with `open`/`close`.

```ts
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ✅ Check file existence without throwing
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ✅ Safe directory creation
await mkdir(join(baseDir, 'uploads'), { recursive: true });
```

---

## 14. Anti-Patterns

**Never do these.**

### Module system

- Using `require()` or `module.exports` in new code.
- Using `__dirname` or `__filename` — use `import.meta.url` instead.
- Importing built-in modules without the `node:` prefix.
- Omitting file extensions in relative imports when using `NodeNext` resolution.

### Async

- Using callback-based APIs from `node:fs` in new code — use `node:fs/promises`.
- Mixing `async/await` with `.then()/.catch()` chains in the same function.
- Awaiting promises sequentially when they are independent — use `Promise.all`.
- `async` functions that contain no `await`.
- Not handling `AbortError` when using `AbortController` with `fetch`.

### Error handling

- Empty `catch` blocks.
- Catching an error, logging it, and then continuing as if it did not happen.
- Using `process.exit()` outside of `index.ts` startup/shutdown handlers.
- Ignoring `unhandledRejection` and `uncaughtException` events.
- Sending raw internal error messages (stack traces, DB errors) to HTTP clients.

### Security

- Using string `===` to compare tokens or secrets — use `timingSafeEqual`.
- Constructing file paths from user input without sanitisation.
- Reading `process.env` directly outside of `src/config/index.ts`.
- Logging secrets, tokens, or full user PII.
- Installing packages without reviewing them — check `npm audit` output.

### Logging

- Using `console.log`, `console.error`, or `console.warn` instead of the Pino logger.
- Logging unstructured strings instead of structured objects.
- Logging sensitive data at any log level.

### TypeScript

- Using `any` — all `typescript-rules.md` rules apply here.
- Not adding `.js` extensions to relative imports with `NodeNext` module resolution.
- Running TypeScript source files directly in production with `tsx` or `ts-node`.
