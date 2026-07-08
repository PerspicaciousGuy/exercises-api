# Fastify Coding Guidelines

<!-- meta
target: Fastify 5.x (Fastify 4.x covered with callouts)
last_reviewed: 2026-06
sources: fastify.dev/docs, github.com/fastify
extends: typescript-rules.md, node-rules.md
-->

> These rules extend `node-rules.md` and `typescript-rules.md`. Both files apply to every Fastify project.
>
> Target: **Fastify 5** (requires Node.js 20+). Rules marked `[Fastify 4]` apply only to Fastify 4 projects. All unlabelled rules apply to both versions.
>
> **Fastify is not Express.** It has no middleware system. Everything is a plugin. Hooks replace middleware. Decorators replace `res.locals`. Read sections 4, 7, and 8 before writing any code.

---

## Table of Contents

1. [Fastify 4 vs Fastify 5 — Key Differences](#1-fastify-4-vs-fastify-5--key-differences)
2. [Project Structure](#2-project-structure)
3. [Server Setup](#3-server-setup)
4. [Plugin System and Encapsulation](#4-plugin-system-and-encapsulation)
5. [Route Declaration](#5-route-declaration)
6. [Schema Validation with Zod Type Provider](#6-schema-validation-with-zod-type-provider)
7. [Hooks](#7-hooks)
8. [Decorators](#8-decorators)
9. [Auth Hooks](#9-auth-hooks)
10. [Error Handling](#10-error-handling)
11. [Security Plugins](#11-security-plugins)
12. [Testing with inject()](#12-testing-with-inject)
13. [Anti-Patterns](#13-anti-patterns)

---

## 1. Fastify 4 vs Fastify 5 — Key Differences

### Node.js version requirement

**Fastify 5** requires Node.js 20+. Node.js 18 is not supported.

**[Fastify 4]** supports Node.js 18+.

### Async error handling

Both versions automatically catch errors thrown in async route handlers and forward them to `setErrorHandler`. No `try/catch` needed in route handlers for operational errors.

### Full JSON schema required

**Fastify 5** requires a complete JSON schema for `body`, `querystring`, `params`, and `response`. The `jsonShortHand` option has been removed.

**[Fastify 4]** accepted shorthand schemas without `type` and `properties`.

```ts
// ❌ Fastify 5 — shorthand no longer accepted
schema: {
  body: {
    name: { type: 'string' }
  }
}

// ✅ Fastify 5 — full JSON schema required
schema: {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' }
    }
  }
}

// ✅ Both versions — Zod type provider handles this automatically
schema: {
  body: z.object({ name: z.string() })
}
```

### `listen()` signature

**Fastify 5** removed the variadic argument signature. Always pass an options object.

```ts
// ❌ Fastify 5 — removed
await fastify.listen(3000);
await fastify.listen(3000, '0.0.0.0');

// ✅ Both versions
await fastify.listen({ port: 3000, host: '0.0.0.0' });
```

### Custom logger setup

**Fastify 5** the `logger` option no longer accepts a custom logger instance. Use `loggerInstance` instead.

```ts
// [Fastify 4] — custom logger via logger option
const fastify = Fastify({ logger: pinoLogger });

// ✅ Fastify 5 — use loggerInstance
const fastify = Fastify({ loggerInstance: pinoLogger });
```

### Type provider split

**Fastify 5** splits type provider types into `ValidatorSchema` and `SerializerSchema`. The `fastify-type-provider-zod` package handles this automatically — no manual changes needed when using it.

### Query string semicolons

**Fastify 5** disables semicolons as query string delimiters by default (non-standard per RFC 3986). Do not rely on semicolon-delimited query strings. If needed: `useSemicolonDelimiter: true`.

---

## 2. Project Structure

```
src/
├── index.ts                    # Starts the server
├── app.ts                      # Creates and configures the Fastify instance
├── config/
│   └── index.ts                # Validated env config (from node-rules.md)
├── plugins/                    # Shared plugins — registered on the root instance
│   ├── sensible.ts             # @fastify/sensible
│   ├── cors.ts                 # @fastify/cors
│   ├── helmet.ts               # @fastify/helmet
│   ├── rateLimit.ts            # @fastify/rate-limit
│   └── db.ts                   # Database client plugin
├── routes/                     # Route plugins — one file per resource
│   ├── index.ts                # Registers all route plugins
│   ├── users/
│   │   ├── index.ts            # Users route plugin
│   │   ├── users.schema.ts     # Zod schemas for users
│   │   └── users.handler.ts    # Route handler functions
│   └── posts/
│       ├── index.ts
│       ├── posts.schema.ts
│       └── posts.handler.ts
├── services/                   # Business logic (from node-rules.md)
├── repositories/               # Data access (from node-rules.md)
├── errors/                     # Custom error classes (from node-rules.md)
└── types/
    └── fastify.d.ts            # Fastify type augmentations
```

### Rules

- `plugins/` contains infrastructure plugins registered globally (security, DB, logging). They use `fastify-plugin` to break encapsulation and share across the whole app.
- `routes/` contains feature plugins. They are encapsulated — decorators and hooks registered inside them do not leak to other routes.
- Never put business logic in route handler files. Handlers call services; services contain logic.
- One route plugin per resource. Do not put unrelated routes in the same plugin file.

---

## 3. Server Setup

Separate instance creation from server startup. This makes the app testable without binding to a port.

```ts
// src/app.ts
import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { logger } from './lib/logger.js';
import { corsPlugin } from './plugins/cors.js';
import { helmetPlugin } from './plugins/helmet.js';
import { rateLimitPlugin } from './plugins/rateLimit.js';
import { dbPlugin } from './plugins/db.js';
import { apiRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
  });

  // 1. Set Zod as the validator and serializer compiler
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 2. Security plugins — register before routes
  await app.register(helmetPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);

  // 3. Infrastructure plugins
  await app.register(dbPlugin);

  // 4. Routes
  await app.register(apiRoutes, { prefix: '/api/v1' });

  return app.withTypeProvider<ZodTypeProvider>();
}
```

```ts
// src/index.ts
import { buildApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';

const app = await buildApp();

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (err) {
  logger.error(err);
  process.exit(1);
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### Rules

- `buildApp()` returns the configured instance without calling `.listen()`. Tests import `buildApp()` directly.
- Never call `.listen()` inside `app.ts`. It belongs in `index.ts` only.
- Always pass `loggerInstance` (Fastify 5) or `logger` (Fastify 4) — use Pino as defined in `node-rules.md`.
- Always `await app.close()` in shutdown handlers. It runs `onClose` hooks, releasing DB connections and other resources.
- Always call `app.withTypeProvider<ZodTypeProvider>()` after setting the validator and serializer compilers to get full TypeScript inference on routes.

---

## 4. Plugin System and Encapsulation

This is the most important concept in Fastify. It is fundamentally different from Express middleware.

### What a plugin is

Every route, hook, decorator, and utility in Fastify is a plugin. A plugin is an async function registered with `fastify.register()`.

```ts
// A plugin is an async function
async function myPlugin(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Everything registered here is scoped to this plugin's context
  fastify.get('/hello', handler);
}

// Register it
await fastify.register(myPlugin, { prefix: '/v1' });
```

### Encapsulation

By default, `register` creates a new encapsulated scope. Decorators, hooks, and plugins registered inside a scope are **not** visible to the parent or sibling scopes.

```ts
fastify.register(async (instance) => {
  instance.decorate('foo', 'bar'); // only visible inside this scope
  instance.get('/scoped', (req, reply) => {
    reply.send({ foo: instance.foo }); // works here
  });
});

fastify.get('/root', (req, reply) => {
  // instance.foo is NOT available here — different scope
});
```

### Breaking encapsulation with `fastify-plugin`

Use `fastify-plugin` (fp) when a plugin must share its decorators/hooks with the entire application — database clients, auth decorators, shared utilities.

```ts
// src/plugins/db.ts
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';

async function dbPlugin(fastify: FastifyInstance) {
  // Decorate the fastify instance with the DB client
  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    await db.$disconnect();
  });
}

// fp() breaks encapsulation — db decorator is available everywhere
export default fp(dbPlugin, {
  name: 'db-plugin',
  fastify: '5.x',
});
```

### Rules

- Use `fastify-plugin` (`fp`) for infrastructure plugins (DB, auth decorator, shared utilities) that must be available globally.
- Do NOT use `fastify-plugin` for route plugins. Routes should be encapsulated.
- Hooks and decorators registered inside an `fp`-wrapped plugin are available to the parent scope and siblings registered after it.
- Register plugins in the correct order: infrastructure plugins first, route plugins last. A route plugin that uses `fastify.db` must be registered after the `db` plugin.
- Always specify a `name` in `fastify-plugin` options for better error messages.

---

## 5. Route Declaration

Use the full `fastify.route()` method for routes with schemas. Use shorthand methods (`fastify.get()`, `fastify.post()`) only for routes without schemas.

```ts
// src/routes/users/index.ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getUsersSchema, createUserSchema } from './users.schema.js';
import * as usersHandler from './users.handler.js';

export async function usersRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.route({
    method: 'GET',
    url: '/',
    schema: getUsersSchema,
    handler: usersHandler.getUsers,
  });

  app.route({
    method: 'POST',
    url: '/',
    schema: createUserSchema,
    preHandler: [app.authenticate], // route-level hook
    handler: usersHandler.createUser,
  });

  app.route({
    method: 'GET',
    url: '/:id',
    schema: getUserByIdSchema,
    handler: usersHandler.getUserById,
  });
}
```

```ts
// src/routes/index.ts
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { usersRoutes } from './users/index.js';
import { postsRoutes } from './posts/index.js';

async function apiRoutes(fastify: FastifyInstance) {
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(postsRoutes, { prefix: '/posts' });
}

// Do NOT wrap route plugins in fp — routes must be encapsulated
export { apiRoutes };
```

### Rules

- Always call `.withTypeProvider<ZodTypeProvider>()` inside route plugins to get typed `request.body`, `request.params`, and `request.query`.
- Always define schemas for routes that accept or return data. Never leave `body`, `params`, or `querystring` untyped.
- Use `preHandler` array for route-level hooks (auth, per-route rate limiting). Do not use `fastify.addHook` for logic that only applies to one route.
- Never `return` a value from a handler and also call `reply.send()`. Pick one. In Fastify, returning a value from a handler sends it automatically — `reply.send()` is optional when you have a response schema.
- Always set a `response` schema for the success case. This enables fast serialization and documents the API shape.

---

## 6. Schema Validation with Zod Type Provider

### Setup

```bash
npm install fastify-type-provider-zod zod
```

```ts
// In app.ts — set once at the top level
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

### Defining schemas

Define schemas in dedicated schema files. Export both the schema object and inferred types.

```ts
// src/routes/users/users.schema.ts
import { z } from 'zod';

export const CreateUserBody = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
});

export const UserParams = z.object({
  id: z.string().uuid(),
});

export const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export const createUserSchema = {
  body: CreateUserBody,
  response: {
    201: UserResponse,
  },
} as const;

export const getUserByIdSchema = {
  params: UserParams,
  response: {
    200: UserResponse,
  },
} as const;

// Inferred types — use these in handler files
export type CreateUserBody = z.infer<typeof CreateUserBody>;
export type UserParams = z.infer<typeof UserParams>;
```

### Using schemas in handlers

```ts
// src/routes/users/users.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CreateUserBody, UserParams } from './users.schema.js';
import * as userService from '../../services/userService.js';

export async function createUser(
  request: FastifyRequest<{ Body: CreateUserBody }>,
  reply: FastifyReply,
) {
  const user = await userService.createUser(request.body);
  return reply.code(201).send(user);
}

export async function getUserById(
  request: FastifyRequest<{ Params: UserParams }>,
  reply: FastifyReply,
) {
  const user = await userService.getUser(request.params.id);
  return reply.send(user);
}
```

### Rules

- Always define schemas in separate `*.schema.ts` files. Never inline Zod schemas inside route declarations.
- Export inferred TypeScript types from schema files using `z.infer`. Do not define types manually that duplicate Zod schemas.
- Always define a `response` schema for every success status code. This enables Fastify's fast-json-stringify serialization and strips undeclared fields automatically.
- Define error response schemas for common error cases (400, 401, 403, 404) to document the API.
- Use `z.string().uuid()` for ID params. Fastify will return 400 automatically if the param is not a valid UUID.
- Never omit `response` schemas for POST routes — without them, Fastify falls back to `JSON.stringify`, which is slower and may expose internal fields.

---

## 7. Hooks

Hooks are Fastify's equivalent of middleware. They run at specific points in the request lifecycle.

### Request/Reply lifecycle hooks (in order)

```
onRequest       → validate/rate limit/log (runs before body is parsed)
preParsing      → modify raw request stream
preValidation   → runs before schema validation
preHandler      → auth checks, business pre-processing
handler         → your route handler
preSerialization → modify payload before serialization
onSend          → modify serialized payload before sending
onResponse      → after response is sent (logging, metrics)
onError         → runs when setErrorHandler sends an error
onTimeout       → request timed out
```

### Adding hooks

```ts
// Global hook — runs for every request in this scope
fastify.addHook('onRequest', async (request, reply) => {
  // Runs before body is parsed — good for IP blocking, request ID
});

fastify.addHook('preHandler', async (request, reply) => {
  // Runs after validation — good for auth checks
});

// Route-level hook — only runs for this route
fastify.route({
  method: 'DELETE',
  url: '/:id',
  preHandler: [fastify.authenticate, fastify.requireAdmin],
  handler: deleteUser,
});
```

### Rules

- Use `onRequest` for: request ID injection, IP rate limiting, early rejection.
- Use `preHandler` for: authentication, authorization, request enrichment.
- Use `onResponse` for: logging response time, metrics.
- Always use `async` hooks. Never mix `done` callback and async — if you use `async`, do not call `done()`.
- Hooks are scoped to the plugin context they are registered in. A hook added inside a route plugin only runs for routes in that plugin — this is intentional and correct.
- To run a hook for a subset of routes, register it inside a scoped plugin containing only those routes.
- Never use arrow functions with `this` binding in hooks — `this` will not be the Fastify instance. Use regular functions or access the instance via closure.

---

## 8. Decorators

Decorators attach custom properties to the Fastify instance (`fastify.decorate`), request object (`fastify.decorateRequest`), or reply object (`fastify.decorateReply`).

### Declaring decorators

Always declare a decorator before setting its value. Never add properties directly to `request` or `reply` without declaring them first.

```ts
// ✅ Correct pattern — declare then set in hook
async function authPlugin(fastify: FastifyInstance) {
  // 1. Declare the decorator with a null placeholder
  fastify.decorateRequest('user', null);

  // 2. Set the actual value per-request in a hook
  fastify.addHook('preHandler', async (request, reply) => {
    // Set user on each request — not shared across requests
    request.user = await getUserFromToken(request.headers.authorization);
  });
}

// ❌ Wrong — directly mutating request shape during the lifecycle
fastify.addHook('preHandler', async (request) => {
  (request as any).user = await getUser(); // never do this
});
```

### TypeScript augmentation

Augment Fastify's types to get TypeScript inference on custom decorators.

```ts
// src/types/fastify.d.ts
import type { AuthenticatedUser } from '../services/authService.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }

  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
```

### Rules

- Always declare decorators with a primitive or `null` placeholder before setting values in hooks. Passing an object literal as the default value shares the reference across all requests — this causes bugs and security issues.
- Never pass an object or array as the default value to `decorateRequest` or `decorateReply`. Fastify will throw an error in newer versions.
- Always augment Fastify types in `src/types/fastify.d.ts` for custom decorators. Never cast with `as any` to access them.
- Infrastructure decorators (auth, db) belong in `plugins/` wrapped with `fastify-plugin`.
- Always use `fastify.decorateRequest` and `fastify.decorateReply` — never mutate `request` or `reply` directly.

---

## 9. Auth Hooks

Auth in Fastify is implemented as a decorated hook function, not a standalone middleware.

### Auth plugin

```ts
// src/plugins/auth.ts
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/index.js';
import { verifyToken } from '../lib/token.js';

async function authPlugin(fastify: FastifyInstance) {
  // Declare the user decorator
  fastify.decorateRequest('user', null);

  // Attach the authenticate function as a decorator on the instance
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const authHeader = request.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid Authorization header');
      }

      const token = authHeader.slice(7);
      request.user = await verifyToken(token);
    },
  );
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  fastify: '5.x',
});
```

### Applying auth to routes

```ts
// Route-level auth — only this route requires auth
app.route({
  method: 'DELETE',
  url: '/:id',
  preHandler: [app.authenticate],
  handler: deleteUser,
});

// Scope-level auth — all routes in this plugin require auth
async function protectedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.route({ method: 'GET', url: '/profile', handler: getProfile });
  fastify.route({ method: 'PATCH', url: '/profile', handler: updateProfile });
}
```

### Rules

- Attach the authenticated user to `request.user` via `decorateRequest`. Never use a module-level variable for per-request state.
- Use `preHandler` for auth — not `onRequest`. At `onRequest` the body has not been parsed yet; `preHandler` runs after validation.
- Apply `fastify.authenticate` at the route level or inside a scoped plugin. Never add it globally with `addHook` unless every single route in the app requires authentication.
- Services receive typed user data as a parameter, not the `request` object.

```ts
// ✅ Controller extracts, service receives typed value
async function deleteUser(request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) {
  await userService.deleteUser(request.params.id, request.user!);
  return reply.code(204).send();
}
```

---

## 10. Error Handling

### `setErrorHandler`

Register one global error handler at the app level. Error handlers are encapsulated — a handler registered inside a plugin only catches errors from that plugin.

```ts
// src/app.ts — register after all plugins, before listen
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from './errors/index.js';

app.setErrorHandler((error, request, reply) => {
  // Zod validation error on request
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(400).send({
      error: 'Validation failed',
      details: error.validation,
    });
  }

  // Zod serialization error on response (500 — schema mismatch)
  if (isResponseSerializationError(error)) {
    request.log.error({ error }, 'Response serialization failed');
    return reply.code(500).send({ error: 'Internal server error' });
  }

  // Operational application error
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
    });
  }

  // Unknown error — log full details, return generic response
  request.log.error({ error }, 'Unhandled error');
  return reply.code(500).send({ error: 'Internal server error' });
});
```

### `setNotFoundHandler`

```ts
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Not found',
    path: request.url,
  });
});
```

### Rules

- Register `setErrorHandler` after all plugins but before `.listen()`.
- Register `setNotFoundHandler` at the app level. It is not an error handler — it handles unmatched routes.
- Always use `hasZodFastifySchemaValidationErrors` and `isResponseSerializationError` from `fastify-type-provider-zod` to distinguish Zod errors from application errors.
- Always use `request.log.error` inside the error handler — not the standalone `logger`. This keeps the request ID in the log context.
- Never re-throw inside `setErrorHandler` — it causes an infinite loop.
- Errors thrown in `onResponse` hooks are not catchable by `setErrorHandler` because the response has already been sent. Log them, do not throw.
- Always throw instances of `Error` (not strings) so they propagate through Fastify's error handling chain correctly.

---

## 11. Security Plugins

All security plugins are in the `@fastify/` official namespace and are maintained by the Fastify team.

### Required packages

```bash
npm install @fastify/helmet @fastify/cors @fastify/rate-limit
```

### `@fastify/helmet`

```ts
// src/plugins/helmet.ts
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

async function helmetPlugin(fastify: FastifyInstance) {
  await fastify.register(helmet, {
    global: true, // apply to all routes
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });
}

export default fp(helmetPlugin, { name: 'helmet-plugin', fastify: '5.x' });
```

### `@fastify/cors`

```ts
// src/plugins/cors.ts
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: config.ALLOWED_ORIGINS,  // string[] from env — never true in production
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  });
}

export default fp(corsPlugin, { name: 'cors-plugin', fastify: '5.x' });
```

### `@fastify/rate-limit`

```ts
// src/plugins/rateLimit.ts
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '15 minutes',
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit-plugin', fastify: '5.x' });
```

Apply stricter limits to auth routes at the route level:

```ts
app.route({
  method: 'POST',
  url: '/login',
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '15 minutes',
    },
  },
  handler: loginHandler,
});
```

### Rules

- Always wrap security plugins with `fastify-plugin` so they apply globally.
- Register security plugins before route plugins.
- Never set `origin: true` in `@fastify/cors` in production — it reflects the request origin, enabling CORS for any domain.
- `@fastify/cors` adds an `onRequest` hook and a wildcard OPTIONS route automatically. Do not add manual OPTIONS handlers.
- Apply route-level rate limiting using `config.rateLimit` — no need to register the plugin a second time.

---

## 12. Testing with inject()

Fastify has built-in HTTP injection via `light-my-request`. No real HTTP server or port binding needed for tests.

### Setup

```ts
// tests/helpers/buildTestApp.ts
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready(); // ensures all plugins are loaded
  }
  return app;
}

export async function closeTestApp(): Promise<void> {
  await app?.close();
}
```

### Writing tests

```ts
// tests/routes/users.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { getTestApp, closeTestApp } from '../helpers/buildTestApp.js';

describe('POST /api/v1/users', () => {
  before(async () => { await getTestApp(); });
  after(async () => { await closeTestApp(); });

  it('returns 201 with created user', async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        name: 'Alice',
        email: 'alice@example.com',
        password: 'securepassword',
      },
    });

    assert.strictEqual(response.statusCode, 201);
    const body = response.json();
    assert.strictEqual(body.email, 'alice@example.com');
    assert.ok(body.id);
  });

  it('returns 400 when email is invalid', async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { name: 'Alice', email: 'not-an-email', password: 'securepassword' },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('returns 401 when no auth token provided on protected route', async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/some-uuid',
    });

    assert.strictEqual(response.statusCode, 401);
  });
});
```

### Injecting with auth headers

```ts
const response = await app.inject({
  method: 'GET',
  url: '/api/v1/users/profile',
  headers: {
    authorization: `Bearer ${validToken}`,
  },
});
```

### Rules

- Always call `await app.ready()` before running tests. This ensures all plugins have finished loading.
- Always call `await app.close()` after tests. This runs `onClose` hooks and releases DB connections.
- Use `app.inject()` for all route tests. Never bind a port in tests.
- Use `response.json()` to parse the response body — it is faster than `JSON.parse(response.body)`.
- Always test: the success case, the validation failure case (400), the auth failure case (401 or 403), and the not-found case (404) for every route.
- Mock the service layer in route tests. Do not hit a real database in unit tests. Use a test database for integration tests.
- Use Node.js built-in `node:test` and `node:assert` — no need for a third-party test framework.

---

## 13. Anti-Patterns

**Never do these.**

### App setup

- Calling `.listen()` inside `app.ts` — it belongs in `index.ts` only.
- Not calling `await app.ready()` before using the app in tests — plugins may not have loaded.
- Not calling `await app.close()` on shutdown — leaks DB connections and file handles.
- Using `logger` option in Fastify 5 to pass a custom logger — use `loggerInstance`.
- Calling `.listen(3000)` with a positional argument in Fastify 5 — use `{ port: 3000 }`.

### Plugins and encapsulation

- Wrapping route plugins in `fastify-plugin` — breaks encapsulation, hooks leak to unrelated routes.
- Not wrapping infrastructure plugins (db, auth) in `fastify-plugin` — decorators are not visible outside the plugin scope.
- Registering route plugins before infrastructure plugins — routes that depend on `fastify.db` or `fastify.authenticate` will fail.
- Using `app.use()` for Express middleware — Fastify has no `use()` method. Use `@fastify/middie` only if Express middleware compatibility is truly needed.

### Hooks and decorators

- Passing an object or array as the default value to `decorateRequest` — shared reference across all requests.
- Mutating `request` directly without declaring the property with `decorateRequest` first.
- Using arrow functions in hooks where `this` refers to the Fastify instance.
- Mixing `done` callback and `async` in the same hook — pick one.
- Calling `done()` after `reply.send()` — double response.

### Schema validation

- Not calling `app.withTypeProvider<ZodTypeProvider>()` inside route plugins — loses TypeScript inference on `request.body`, `request.params`, `request.query`.
- Defining Zod schemas inline inside route declarations — put them in `*.schema.ts` files.
- Omitting `response` schema — loses fast serialization and may expose internal fields.
- Setting validator/serializer compilers inside individual plugins — set them once at the app level.

### Error handling

- Re-throwing inside `setErrorHandler` — causes infinite loop.
- Throwing strings instead of `Error` instances — they do not propagate through Fastify's error handling chain.
- Logging with the standalone `logger` inside `setErrorHandler` — use `request.log` to preserve request context.
- Not handling `hasZodFastifySchemaValidationErrors` in the error handler — Zod validation errors will fall through to the generic 500 handler.

### Auth

- Using `onRequest` for auth that needs to access `request.body` — body is not parsed yet at `onRequest`.
- Adding `fastify.authenticate` globally when only some routes need it — use scoped plugins or route-level `preHandler`.
- Not declaring `decorateRequest('user', null)` before setting `request.user` in a hook.

### Testing

- Not calling `await app.ready()` before injecting requests.
- Binding a real port in tests — use `app.inject()`.
- Not calling `await app.close()` after tests — leaks connections.
