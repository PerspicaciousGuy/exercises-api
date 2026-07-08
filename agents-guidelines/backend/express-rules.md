# Express.js Coding Guidelines

<!-- meta
target: Express 5.x (Express 4.x covered with callouts)
last_reviewed: 2026-06
sources: expressjs.com
extends: typescript-rules.md, node-rules.md
-->

> These rules extend `node-rules.md` and `typescript-rules.md`. All three files apply to every Express project.
>
> Primary target: **Express 5**. Where Express 4 differs, it is called out explicitly with a `[Express 4]` label. If you are on Express 4, follow the labelled callouts. All unlabelled rules apply to both versions.

---

## Table of Contents

1. [Express 4 vs Express 5 — Key Differences](#1-express-4-vs-express-5--key-differences)
2. [Project Structure](#2-project-structure)
3. [App Setup](#3-app-setup)
4. [Router Organisation](#4-router-organisation)
5. [Middleware — Order and Patterns](#5-middleware--order-and-patterns)
6. [Request Validation](#6-request-validation)
7. [Auth Middleware](#7-auth-middleware)
8. [Response Patterns](#8-response-patterns)
9. [Error Handling Middleware](#9-error-handling-middleware)
10. [Security Middleware](#10-security-middleware)
11. [Testing with Supertest](#11-testing-with-supertest)
12. [Anti-Patterns](#12-anti-patterns)

---

## 1. Express 4 vs Express 5 — Key Differences

Understand these differences before writing any code. They affect error handling, routing syntax, and body parsing.

### Async error handling

**Express 5 (target):** Rejected promises in route handlers and middleware are automatically forwarded to error-handling middleware. No `try/catch` or `next(err)` required for async routes.

```ts
// ✅ Express 5 — automatic error propagation
router.get('/users/:id', async (req, res) => {
  const user = await userService.getUser(req.params.id); // throws → auto-forwarded
  res.json(user);
});
```

**[Express 4]:** Rejected promises are NOT caught automatically. Every async route handler must either use `try/catch` with `next(err)`, or wrap with a utility like `express-async-errors`.

```ts
// ✅ Express 4 — manual error forwarding required
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userService.getUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ✅ Express 4 — alternative: use express-async-errors
// import 'express-async-errors'; at top of app.ts — patches all routes globally
```

### Route path syntax

Express 5 uses `path-to-regexp` v8. Wildcard and optional parameter syntax changed.

| Pattern | Express 4 | Express 5 |
|---|---|---|
| Wildcard | `/*` | `/*splat` or `/{*splat}` |
| Optional param | `/:file.:ext?` | `/:file{.:ext}` |
| Regex chars | Supported | **Not supported** (ReDoS prevention) |

```ts
// [Express 4]
router.get('/*', handler);
router.get('/:file.:ext?', handler);

// Express 5
router.get('/{*splat}', handler);
router.get('/:file{.:ext}', handler);
```

### Body parsing

**[Express 4]:** `bodyParser()` combined middleware is available but deprecated.
**Express 5:** `bodyParser()` combined middleware is removed. Use `express.json()` and `express.urlencoded()` separately.

```ts
// ✅ Both versions — use individual parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
```

### Status code validation

**Express 5:** Passing an invalid HTTP status code to `res.status()` throws an error immediately.

```ts
// ❌ Express 5 — throws
res.status(999).json({ error: 'bad' });

// ✅ Always use valid HTTP status codes
res.status(400).json({ error: 'bad' });
```

---

## 2. Project Structure

Build on the structure in `node-rules.md`. Add Express-specific folders:

```
src/
├── index.ts                  # Starts the HTTP server
├── app.ts                    # Creates and configures the Express app
├── config/
│   └── index.ts              # Validated env config
├── routes/                   # Router files — one per resource
│   ├── index.ts              # Mounts all routers onto a base path
│   ├── users.router.ts
│   └── posts.router.ts
├── controllers/              # Route handlers — thin, delegate to services
│   ├── users.controller.ts
│   └── posts.controller.ts
├── middleware/               # Custom middleware
│   ├── auth.middleware.ts
│   ├── validate.middleware.ts
│   └── requestId.middleware.ts
├── services/                 # Business logic (from node-rules.md)
├── repositories/             # Data access (from node-rules.md)
├── schemas/                  # Zod schemas for request validation
│   ├── users.schema.ts
│   └── posts.schema.ts
├── errors/                   # Custom error classes (from node-rules.md)
│   └── index.ts
├── lib/                      # DB clients, SDK wrappers
└── types/
    └── express.d.ts          # Express type augmentations (res.locals, etc.)
```

### Layer responsibilities

| Layer | Responsibility | What it must NOT do |
|---|---|---|
| `routes/` | Mount routers, group paths | Contain handler logic |
| `controllers/` | Parse request, call service, send response | Contain business logic or DB queries |
| `middleware/` | Cross-cutting concerns (auth, logging, validation) | Contain business logic |
| `services/` | Business logic | Know about `req`, `res`, or HTTP |
| `repositories/` | DB queries | Know about `req`, `res`, or Express |
| `schemas/` | Zod schemas for request validation | Contain handler or service logic |

---

## 3. App Setup

Separate app creation from server startup. This makes the app testable without starting a real HTTP server.

```ts
// src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { apiRouter } from './routes/index.js';
import { config } from './config/index.js';

export function createApp() {
  const app = express();

  // 1. Security headers — first
  app.use(helmet());

  // 2. CORS
  app.use(cors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
  }));

  // 3. Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
  }));

  // 4. Request ID — before body parsing and logging
  app.use(requestIdMiddleware);

  // 5. Body parsers
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false }));

  // 6. Routes
  app.use('/api/v1', apiRouter);

  // 7. 404 handler — after all routes
  app.use(notFoundHandler);

  // 8. Error handler — must be last
  app.use(errorHandler);

  return app;
}
```

```ts
// src/index.ts
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server started');
});

// Graceful shutdown — see node-rules.md process management section
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

### Rules

- `createApp()` returns the Express instance without calling `.listen()`. Tests import `createApp()` directly.
- Never call `app.listen()` inside `app.ts`. It belongs in `index.ts` only.
- Always set a `limit` on `express.json()` to prevent large payload attacks. Default to `'10kb'`; adjust per route if needed.
- Disable the `X-Powered-By` header. `helmet()` does this automatically.

---

## 4. Router Organisation

One router file per resource. Mount all routers in `routes/index.ts`.

```ts
// src/routes/index.ts
import { Router } from 'express';
import { usersRouter } from './users.router.js';
import { postsRouter } from './posts.router.js';

export const apiRouter = Router();

apiRouter.use('/users', usersRouter);
apiRouter.use('/posts', postsRouter);
```

```ts
// src/routes/users.router.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateUserSchema, UpdateUserSchema } from '../schemas/users.schema.js';
import * as usersController from '../controllers/users.controller.js';

export const usersRouter = Router();

usersRouter.get('/', usersController.getAll);
usersRouter.get('/:id', usersController.getById);
usersRouter.post('/', validate(CreateUserSchema), usersController.create);
usersRouter.patch('/:id', authenticate, validate(UpdateUserSchema), usersController.update);
usersRouter.delete('/:id', authenticate, usersController.remove);
```

### Rules

- Name router files `<resource>.router.ts`.
- Name controller files `<resource>.controller.ts`.
- Only declare middleware and route mappings inside router files. No logic.
- Pass middleware as route-level arguments, not with `router.use()`, unless the middleware applies to every route in that router.
- Always version API routes (`/api/v1/`). This is set at the mount point in `app.ts`, not inside individual routers.
- Use `router.use(authenticate)` only if every route in the router requires auth. Otherwise, apply auth per route.

---

## 5. Middleware — Order and Patterns

### Global middleware order

Middleware runs in the order it is registered. The order in `app.ts` is mandatory:

```
1. helmet()              — security headers
2. cors()                — CORS headers
3. rateLimit()           — rate limiting before any processing
4. requestId             — before body parsing and logging
5. express.json()        — body parsing
6. express.urlencoded()  — body parsing
7. routes                — your application routes
8. 404 handler           — catches unmatched routes
9. error handler         — catches all errors (must be last)
```

Never place the error handler before routes. Never place body parsers after routes.

### Writing custom middleware

```ts
// src/middleware/requestId.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext } from '../lib/context.js';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId }, next);
}
```

### Middleware rules

- Every middleware function must either call `next()`, `next(err)`, or send a response. Never leave a request hanging.
- Never call both `next()` and `res.json()` in the same middleware. Pick one.
- Configurable middleware must be a factory function that returns the actual middleware.

```ts
// ✅ Factory pattern for configurable middleware
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (res.locals.user?.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

// Usage in router
router.delete('/:id', authenticate, requireRole('admin'), controller.remove);
```

- **[Express 4]:** Async middleware must wrap its body in `try/catch` and call `next(err)` in the catch block.
- **Express 5:** Async middleware that throws or rejects automatically calls `next(err)`. No `try/catch` needed.

---

## 6. Request Validation

Validate every incoming request at the route level before it reaches the controller. Use a reusable `validate` middleware factory with Zod schemas.

```ts
// src/middleware/validate.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';

type ValidateTarget = 'body' | 'params' | 'query';

export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    // Replace the target with the parsed (sanitised) value
    req[target] = result.data;
    next();
  };
}
```

```ts
// src/schemas/users.schema.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });

export const UserParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
```

```ts
// Usage in router
router.post('/', validate(CreateUserSchema, 'body'), usersController.create);
router.get('/:id', validate(UserParamsSchema, 'params'), usersController.getById);
```

### Rules

- Always validate `req.params`, `req.query`, and `req.body` with a schema. Never access them as raw `unknown` in a controller.
- Replace `req.body` with the parsed result from Zod so the controller receives a fully typed, sanitised value.
- Never pass raw `req.body` to a service function. Pass the typed, parsed value.
- Return `400` with structured field errors on validation failure. Do not throw a generic error.
- Define schemas in `schemas/` — not inside controllers or routes.

---

## 7. Auth Middleware

Auth middleware verifies identity and attaches the authenticated user to `res.locals`. It does not implement a specific auth strategy — the pattern applies to JWT, sessions, or API keys.

### Type augmentation

Augment Express's `res.locals` type so the attached user is typed across the codebase.

```ts
// src/types/express.d.ts
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

declare global {
  namespace Express {
    interface Locals {
      user?: AuthenticatedUser;
    }
  }
}
```

### Auth middleware

```ts
// src/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../errors/index.js';
import { verifyToken } from '../lib/token.js';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  const user = await verifyToken(token); // throws UnauthorizedError if invalid

  res.locals.user = user;
  next();
}
```

### Rules

- Always attach the authenticated user to `res.locals.user`, never to `req.user`. `res.locals` is the Express-sanctioned place for request-scoped data.
- Never verify auth inside a service function. Auth is a cross-cutting concern — handle it in middleware before the request reaches the controller.
- Apply `authenticate` at the route level, not globally with `app.use()`, unless every single route in the app requires authentication.
- Services receive typed user data as a parameter, not `req` or `res.locals` directly. Controllers extract from `res.locals` and pass to the service.

```ts
// ✅ Controller extracts user, service receives typed value
async function update(req: Request, res: Response): Promise<void> {
  const user = res.locals.user!; // guaranteed by authenticate middleware
  const result = await userService.updateUser(req.params.id, req.body, user);
  res.json(result);
}
```

---

## 8. Response Patterns

Controllers are thin. They parse the request, call the service, and send the response. No business logic.

```ts
// src/controllers/users.controller.ts
import type { Request, Response } from 'express';
import * as userService from '../services/userService.js';
import type { CreateUserInput } from '../schemas/users.schema.js';

export async function getById(req: Request, res: Response): Promise<void> {
  const user = await userService.getUser(req.params.id);
  res.status(200).json(user);
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateUserInput; // safe — validate middleware ran first
  const user = await userService.createUser(input);
  res.status(201).json(user);
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await userService.updateUser(req.params.id, req.body, res.locals.user!);
  res.status(200).json(user);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await userService.deleteUser(req.params.id, res.locals.user!);
  res.status(204).send();
}
```

### HTTP status codes

| Scenario | Status |
|---|---|
| Successful GET, PATCH, PUT | 200 |
| Successful POST (resource created) | 201 |
| Successful DELETE (no body) | 204 |
| Validation error | 400 |
| Missing or invalid auth token | 401 |
| Valid token but insufficient permission | 403 |
| Resource not found | 404 |
| Unexpected server error | 500 |

### Rules

- Always call `res.status()` explicitly. Do not rely on Express defaulting to 200.
- Always return `void` from controller functions. Do not return the result of `res.json()`.
- Never call `res.json()` more than once per request — it causes a "headers already sent" error.
- Always call `return` after sending a response inside a conditional to prevent executing further code.

```ts
// ✅ Return after sending to prevent fallthrough
if (!user) {
  res.status(404).json({ error: 'Not found' });
  return;
}
res.json(user);
```

- Do not expose internal error details, stack traces, or database errors in responses. Return a generic message; log the details server-side.
- Always send JSON responses for API routes. Never `res.send()` a plain string on an API endpoint.

---

## 9. Error Handling Middleware

### 404 handler

Place this after all routes. Express calls it when no route matched.

```ts
// src/middleware/notFound.middleware.ts
import type { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
}
```

### Global error handler

Must have exactly 4 parameters — `(err, req, res, next)`. Express identifies error handlers by their 4-argument signature. A 3-argument function is treated as regular middleware even if named `errorHandler`.

```ts
// src/middleware/error.middleware.ts
import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/index.js';
import { logger } from '../lib/logger.js';
import { requestContext } from '../lib/context.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const requestId = requestContext.getStore()?.requestId;

  if (err instanceof AppError) {
    // Operational error — safe to expose message
    if (!err.isOperational) {
      logger.error({ err, requestId }, 'Non-operational AppError');
    }
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Unknown error — log full details, return generic message
  logger.error({ err, requestId }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
  });
};
```

### Rules

- Error handler must always be the **last** `app.use()` call in `app.ts`.
- Error handler must have exactly 4 parameters. If you omit `next`, Express will not treat it as an error handler.
- Never call `next()` after sending a response in an error handler.
- **[Express 4]:** In async middleware, always call `next(err)` in catch blocks. Express 4 will not forward async errors automatically.
- **Express 5:** Thrown errors and rejected promises in async middleware are automatically forwarded to the error handler. No `next(err)` needed.
- Never re-throw inside the error handler — it creates an infinite loop or crashes the process.
- The 404 handler is not an error handler. It does not have 4 parameters. It is a regular middleware registered after all routes.

---

## 10. Security Middleware

Install and configure these packages on every Express project. Sources: `expressjs.com/en/advanced/best-practice-security`.

### Required packages

```
helmet           — sets security-related HTTP response headers
cors             — configures Cross-Origin Resource Sharing
express-rate-limit — basic rate limiting
```

### Helmet

```ts
import helmet from 'helmet';

// Use defaults — covers XSS, clickjacking, MIME sniffing, and more
app.use(helmet());
```

Never disable `helmet()` defaults without understanding what each header does. If a specific header causes issues with your frontend, disable only that header.

### CORS

```ts
import cors from 'cors';

app.use(cors({
  origin: config.ALLOWED_ORIGINS,  // string[] from env — never '*' in production
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
}));
```

Rules:
- Never set `origin: '*'` in production. Always specify an explicit allowlist from environment config.
- Set `credentials: true` only if your API uses cookies or HTTP auth. Do not set it by default.
- CORS does not protect your API from non-browser clients. Always authenticate requests regardless of CORS settings.

### Rate limiting

```ts
import { rateLimit } from 'express-rate-limit';

// Global limiter — apply to all routes
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,               // max requests per window per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

// Stricter limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many attempts, try again later' },
});

// Applied per route
router.post('/login', authLimiter, authController.login);
```

### Body size limit

Always set a payload size limit on `express.json()`. The default is `100kb` in Express — reduce it.

```ts
app.use(express.json({ limit: '10kb' }));
```

---

## 11. Testing with Supertest

Use `supertest` to test HTTP routes without starting a real server. Import `createApp()` directly.

### Setup

```ts
// tests/setup.ts
import { createApp } from '../src/app.js';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  app = createApp();
});

export function getApp() {
  return app;
}
```

### Writing route tests

```ts
// tests/routes/users.test.ts
import request from 'supertest';
import { getApp } from '../setup.js';

describe('GET /api/v1/users/:id', () => {
  it('returns 200 with user data for a valid id', async () => {
    const res = await request(getApp())
      .get('/api/v1/users/valid-uuid')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'valid-uuid' });
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(getApp()).get('/api/v1/users/valid-uuid');

    expect(res.status).toBe(401);
  });

  it('returns 404 when user does not exist', async () => {
    const res = await request(getApp())
      .get('/api/v1/users/non-existent-uuid')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 when id is not a valid uuid', async () => {
    const res = await request(getApp())
      .get('/api/v1/users/not-a-uuid')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(400);
  });
});
```

### Rules

- Test the HTTP layer, not the service layer. Services have their own unit tests.
- Always test the success case, the auth failure case, the validation failure case, and the not-found case for every route.
- Mock the service layer in route tests — do not hit a real database.
- Use `createApp()` in tests — never import the `server` instance from `index.ts`. The server starts a real port; the app does not.
- Test status codes and response shape. Do not test implementation details (which service function was called, internal state).
- Use a dedicated test environment config with `NODE_ENV=test` to prevent test runs from hitting production services.

---

## 12. Anti-Patterns

**Never do these.**

### App setup

- Calling `app.listen()` inside `app.ts`. It belongs in `index.ts` only.
- Registering the error handler before routes — it will never be reached.
- Registering body parsers after routes — body will be `undefined` in handlers.
- Not setting a payload size limit on `express.json()`.
- Disabling `helmet()` entirely.

### Routing and controllers

- Business logic inside route handlers or router files. It belongs in `services/`.
- Database queries inside controllers. They belong in `repositories/`.
- Passing `req` or `res` into a service function.
- Not calling `return` after sending a response inside a conditional — causes "headers already sent" errors.
- Calling `res.json()` more than once in a single handler.

### Middleware

- Middleware that neither calls `next()` nor sends a response — hangs the request forever.
- Calling both `next()` and `res.json()` in the same code path.
- Placing auth logic inside service functions instead of middleware.
- Using `app.use(authenticate)` globally when only some routes need auth.

### Error handling

- Error handler with 3 parameters — Express treats it as regular middleware, not an error handler.
- Catching an error, logging it, and calling `next()` instead of `next(err)` **[Express 4]**.
- Using `try/catch` in every async route handler instead of `express-async-errors` **[Express 4]**.
- Sending stack traces or raw database errors in API responses.
- Re-throwing inside the global error handler.

### Security

- Setting `cors({ origin: '*' })` in production.
- No rate limiting on auth endpoints.
- No payload size limit on body parsers.
- Reading `process.env` directly in middleware or controllers — use `config` from `node-rules.md`.

### Validation

- Accessing `req.body`, `req.params`, or `req.query` in a controller without prior Zod validation.
- Defining Zod schemas inline inside controller or route files.
- Not replacing `req.body` with the parsed Zod output — leaving it as raw `unknown`.
