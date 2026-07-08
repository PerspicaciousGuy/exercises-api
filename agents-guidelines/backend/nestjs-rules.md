# NestJS Coding Guidelines

<!-- meta
target: NestJS 11.x
last_reviewed: 2026-06
sources: docs.nestjs.com, github.com/nestjs/nest
extends: typescript-rules.md, node-rules.md
-->

> These rules extend `node-rules.md` and `typescript-rules.md`. Both files apply to every NestJS project.
>
> Target: **NestJS 11** (requires Node.js 20+). NestJS 11 ships with Express v5 as the default platform and Fastify v5 as the alternative.
>
> **NestJS v12 note:** NestJS v12 (planned Q3 2026) will introduce Standard Schema support, enabling Zod, Valibot, and ArkType as first-class alternatives to `class-validator` directly in the framework. These rules use `class-validator` + `class-transformer` as the current standard. When v12 is released, a `nestjs-rules-v12.md` file will be added.

---

## Table of Contents

1. [NestJS Architecture Overview](#1-nestjs-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Bootstrap and Configuration](#3-bootstrap-and-configuration)
4. [Modules](#4-modules)
5. [Controllers](#5-controllers)
6. [Services and Providers](#6-services-and-providers)
7. [Dependency Injection](#7-dependency-injection)
8. [DTOs and Validation](#8-dtos-and-validation)
9. [Guards](#9-guards)
10. [Interceptors](#10-interceptors)
11. [Pipes](#11-pipes)
12. [Exception Filters](#12-exception-filters)
13. [Configuration](#13-configuration)
14. [Prisma Integration](#14-prisma-integration)
15. [Testing](#15-testing)
16. [Anti-Patterns](#16-anti-patterns)

---

## 1. NestJS Architecture Overview

Understand these concepts before writing any code. Getting them wrong produces broken or untestable code.

### Request lifecycle (in order)

```
Incoming request
  → Middleware          (app.use, configure())
  → Guards              (canActivate — authentication/authorization)
  → Interceptors        (before handler — transform request, logging)
  → Pipes               (transform/validate params, body, query)
  → Route Handler       (controller method)
  → Interceptors        (after handler — transform response)
  → Exception Filters   (catch thrown exceptions)
  → Response sent
```

Filters run in reverse registration order (route → controller → global). Interceptors run inbound first-in-first-out, outbound last-in-first-out.

### Core building blocks

| Building block | Decorator | Purpose |
|---|---|---|
| Module | `@Module()` | Organises related code into a cohesive unit |
| Controller | `@Controller()` | Handles HTTP requests, delegates to services |
| Provider / Service | `@Injectable()` | Business logic, injected via DI |
| Guard | `@Injectable()` + `CanActivate` | Authentication and authorization |
| Interceptor | `@Injectable()` + `NestInterceptor` | Transform requests/responses, logging |
| Pipe | `@Injectable()` + `PipeTransform` | Validate and transform input |
| Exception Filter | `@Catch()` | Handle thrown exceptions, shape error responses |
| Middleware | `implements NestMiddleware` | Cross-cutting concerns before guards |

---

## 2. Project Structure

```
src/
├── main.ts                       # Bootstrap — creates app and starts server
├── app.module.ts                 # Root module
├── app.controller.ts             # Root controller (health check only)
├── app.service.ts                # Root service (minimal)
├── common/                       # Shared across all features
│   ├── decorators/               # Custom parameter and class decorators
│   │   └── current-user.decorator.ts
│   ├── filters/                  # Global exception filters
│   │   └── http-exception.filter.ts
│   ├── guards/                   # Global guards
│   │   └── auth.guard.ts
│   ├── interceptors/             # Global interceptors
│   │   └── transform.interceptor.ts
│   ├── pipes/                    # Global pipes
│   │   └── validation.pipe.ts
│   └── middleware/               # Global middleware
│       └── logger.middleware.ts
├── config/                       # Configuration
│   └── index.ts                  # Validated env config
└── features/                     # Feature modules — one folder per domain
    └── users/
        ├── users.module.ts
        ├── users.controller.ts
        ├── users.service.ts
        ├── users.repository.ts   # Optional — data access layer
        ├── dto/
        │   ├── create-user.dto.ts
        │   └── update-user.dto.ts
        └── entities/
            └── user.entity.ts    # Type representing a DB record
```

### Rules

- One feature folder per domain. Never mix unrelated resources in the same module.
- `common/` is for shared infrastructure only (guards, filters, pipes, interceptors, decorators). Never put business logic there.
- Controllers, services, modules, DTOs, and entities each live in separate files. Never combine them.
- File naming: `kebab-case` with a type suffix — `users.service.ts`, `create-user.dto.ts`, `auth.guard.ts`.
- Class naming: `PascalCase` with the same type suffix — `UsersService`, `CreateUserDto`, `AuthGuard`.

---

## 3. Bootstrap and Configuration

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { logger } from './lib/logger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // API versioning
  app.enableVersioning({ type: VersioningType.URI });

  // Global validation pipe — must be before filters and interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true,           // auto-transform payloads to DTO types
      transformOptions: {
        enableImplicitConversion: true, // convert string params to number/boolean
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.info({ port }, 'Server started');
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
```

### Rules

- Always set `whitelist: true` and `forbidNonWhitelisted: true` on the global `ValidationPipe`. Without `whitelist`, unknown properties pass through silently.
- Always set `transform: true` on the global `ValidationPipe`. Without it, route params and query strings remain strings even when typed as numbers.
- Register global components in `main.ts` **only** for components that truly apply to every route. Feature-specific guards, pipes, and filters belong on their controller or route.
- Global components registered via `app.useGlobalFilters()` / `app.useGlobalGuards()` etc. cannot use dependency injection. Use the `APP_FILTER` / `APP_GUARD` token pattern in a module instead — see section 9 and 12.
- Always call `app.enableCors()` or configure CORS before listening. Never leave CORS unconfigured in production.
- Always use `app.setGlobalPrefix('api')` to namespace all routes.

---

## 4. Modules

Every feature must have its own module. Modules declare what they provide and what they export.

```ts
// src/features/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // only export what other modules need
})
export class UsersModule {}
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './features/users/users.module.js';
import { AuthModule } from './features/auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
```

### Module types

| Pattern | When to use |
|---|---|
| Feature module | One per domain — `UsersModule`, `AuthModule` |
| Shared module | Reusable providers needed by multiple features — `DatabaseModule`, `LoggerModule` |
| Global module (`@Global()`) | Providers that should be available everywhere without importing — use sparingly |
| Dynamic module | Configurable at registration time — `ConfigModule.forRoot()`, `TypeOrmModule.forFeature()` |

### Rules

- Never import a feature module into another feature module just to access one service. Export the service and import the module.
- Never use `@Global()` for feature modules. Only use it for true infrastructure (database connection, config, logger).
- Only export what other modules explicitly need. Default to not exporting.
- Do not put controllers in `imports`. Controllers go in `controllers`.
- Do not declare the same provider in multiple modules. Providers are singletons — declare once, export and import where needed.
- Never use barrel files (`index.ts`) to re-export module classes. NestJS barrel file imports can cause circular dependency issues at the DI container level.

---

## 5. Controllers

Controllers handle HTTP requests and delegate to services. They contain no business logic.

```ts
// src/features/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Version,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.findAll({ page, limit });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.remove(id, user);
  }
}
```

### Rules

- Always use `@HttpCode(HttpStatus.CREATED)` on `@Post()` handlers. NestJS defaults POST to 200, not 201.
- Always use `@HttpCode(HttpStatus.NO_CONTENT)` on delete handlers that return no body.
- Always use `ParseUUIDPipe` for UUID route parameters. It validates format and returns 400 on invalid input automatically.
- Always use `readonly` on injected services in the constructor.
- Never put `async`/`await` in a controller handler unless the controller itself is doing async work. In most cases, returning the service's Promise directly is sufficient.
- Never access `Request` or `Response` objects directly in controllers unless absolutely necessary. Use NestJS decorators (`@Body()`, `@Param()`, `@Query()`, `@Headers()`).
- Services receive typed DTO values and authenticated user data, not raw request objects.
- Use `@Version('1')` on controllers or routes to version the API.

---

## 6. Services and Providers

Services contain all business logic. They are `@Injectable()` providers managed by the NestJS IoC container.

```ts
// src/features/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(pagination: { page: number; limit: number }) {
    return this.usersRepository.findMany(pagination);
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');
    return this.usersRepository.create(dto);
  }

  async update(id: string, dto: UpdateUserDto, requestingUser: AuthenticatedUser) {
    await this.findOne(id); // throws NotFoundException if not found
    return this.usersRepository.update(id, dto);
  }

  async remove(id: string, requestingUser: AuthenticatedUser) {
    await this.findOne(id); // throws NotFoundException if not found
    return this.usersRepository.delete(id);
  }
}
```

### Rules

- Always mark services with `@Injectable()`.
- Always use `readonly` on constructor-injected dependencies.
- Throw NestJS HTTP exceptions (`NotFoundException`, `ConflictException`, `UnauthorizedException`, `ForbiddenException`) from services — not custom error classes. NestJS's built-in exception filter handles them automatically.
- Services must not know about HTTP. They receive typed inputs and return typed outputs. No `Request`, `Response`, or HTTP status codes in service methods.
- Never import a service from another feature directly — import its module and use the exported service.
- Singleton scope is the default and correct choice for almost all services. Do not use `REQUEST` scope unless you have a specific need for per-request isolation (rare).
- Repository pattern: create a separate `UsersRepository` class for all database queries. Services call repositories, not the database client directly.

---

## 7. Dependency Injection

### Constructor injection

Always use constructor injection. Never use property injection (`@Inject()` on a class property).

```ts
// ✅ Constructor injection
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailerService: MailerService,
  ) {}
}

// ❌ Property injection — harder to test, hides dependencies
@Injectable()
export class UsersService {
  @Inject()
  private usersRepository: UsersRepository;
}
```

### Custom providers

Use custom providers when you need a value, factory, or interface-based injection.

```ts
// Injection token for an interface
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// Provider definition
{
  provide: USER_REPOSITORY,
  useClass: PrismaUsersRepository,
}

// Consumer
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: IUsersRepository,
  ) {}
}
```

Define injection tokens as `Symbol` or string constants in a `constants.ts` file. Never use raw strings inline.

### Injection scopes

| Scope | Behaviour | Use when |
|---|---|---|
| `DEFAULT` (singleton) | One instance for the entire application | Always, unless you have a specific reason not to |
| `REQUEST` | New instance per request | Per-request caching, multi-tenancy |
| `TRANSIENT` | New instance every time it is injected | Stateful helpers that must not be shared |

Rules:
- Use singleton scope for everything unless there is an explicit reason not to.
- `REQUEST` scope bubbles up — if a service is `REQUEST`-scoped, every provider that depends on it becomes `REQUEST`-scoped. This kills performance at scale.
- Never use `REQUEST` scope for database clients or loggers.

### Circular dependencies

Avoid circular dependencies. If two services depend on each other, extract the shared logic into a third service.

If unavoidable, use `forwardRef()`:

```ts
@Injectable()
export class CatsService {
  constructor(
    @Inject(forwardRef(() => DogsService))
    private dogsService: DogsService,
  ) {}
}
```

Never use barrel files (`index.ts`) for module or provider imports — they are a common cause of circular dependency errors in NestJS.

---

## 8. DTOs and Validation

DTOs (Data Transfer Objects) define the shape of incoming data. Use `class-validator` decorators on DTO classes.

### Installation

```bash
npm install class-validator class-transformer
```

### Defining DTOs

```ts
// src/features/users/dto/create-user.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../user.types.js';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value.trim())
  name: string;

  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
```

```ts
// src/features/users/dto/update-user.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// All fields optional, password excluded
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}
```

### Rules

- Always use `PartialType`, `OmitType`, `PickType`, and `IntersectionType` from `@nestjs/mapped-types` to compose DTOs. Never manually redeclare fields from another DTO.
- Always use `@Transform` to sanitise incoming strings (`trim()`, `toLowerCase()`). Validation passes but unsanitised values can cause bugs downstream.
- Never use plain TypeScript interfaces for incoming request data. Use classes — `class-validator` requires class metadata via decorators.
- The global `ValidationPipe` with `whitelist: true` strips undeclared properties. This only works if the input is a class instance, not a plain object. `transform: true` handles this conversion.
- Use `@IsOptional()` only for fields that are genuinely optional. Do not use it to suppress a validation error on a required field.
- Never put sensitive fields (passwords, tokens) in response DTOs. Create separate response DTOs with only the fields the client should receive.
- Use `@Expose()` from `class-transformer` combined with `ClassSerializerInterceptor` to control what is returned in responses.

### Response serialization

```ts
// src/features/users/entities/user.entity.ts
import { Exclude, Expose } from 'class-transformer';

export class UserEntity {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() email: string;
  @Exclude() password: string; // never returned in responses

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}

// In service — wrap DB result in entity
async findOne(id: string): Promise<UserEntity> {
  const user = await this.usersRepository.findById(id);
  if (!user) throw new NotFoundException(`User ${id} not found`);
  return new UserEntity(user);
}
```

```ts
// In main.ts — enable globally
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

---

## 9. Guards

Guards implement `CanActivate`. They return `true` to allow the request or `false` / throw an exception to deny it. Use guards for authentication and authorization.

```ts
// src/common/guards/auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { verifyToken } from '../../lib/token.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('Missing auth token');

    try {
      const user = await verifyToken(token);
      request['user'] = user; // attach to request for downstream access
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? (token ?? null) : null;
  }
}
```

```ts
// Public route decorator
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### Registering the guard globally with DI support

Do not use `app.useGlobalGuards()` — it cannot inject dependencies. Use the `APP_GUARD` token instead:

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/guards/auth.guard.js';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

### Rules

- Always use `APP_GUARD` token to register global guards — not `app.useGlobalGuards()`. Only `APP_GUARD` supports dependency injection.
- Use the `@Public()` decorator pattern to opt routes out of a global auth guard. This is safer than opting in — routes are protected by default.
- Guards throw exceptions, they do not send responses directly. Throw `UnauthorizedException` for missing/invalid auth, `ForbiddenException` for insufficient permissions.
- Separate authentication (who are you) from authorization (what can you do). Auth guard verifies identity; a roles/permissions guard checks access.
- Custom decorators (`@CurrentUser()`, `@Roles()`) belong in `common/decorators/`.

---

## 10. Interceptors

Interceptors implement `NestInterceptor`. They wrap the route handler, giving access to both the request and the response.

Use interceptors for: response transformation, logging, caching, adding headers, timing.

```ts
// src/common/interceptors/transform.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Rules

- Register global interceptors using `APP_INTERCEPTOR` token for DI support, not `app.useGlobalInterceptors()`.
- Use interceptors for cross-cutting response transformation. Never use services for this.
- Do not put authentication logic in interceptors — that belongs in guards.
- Interceptors have access to `catchError` from RxJS — use this for logging errors, not for handling them (that belongs in exception filters).
- Interceptors run on the response path — any mutation applied in the `map` operator shapes what the client receives.

---

## 11. Pipes

Pipes implement `PipeTransform`. Use them to validate and transform specific parameters.

The global `ValidationPipe` handles DTO validation automatically. Write custom pipes only for parameter-level transformation.

```ts
// Custom pipe example — parse and validate pagination params
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParsePaginationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const page = Number(value);
    if (isNaN(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    return Math.min(page, 100); // cap at 100
  }
}

// Usage
@Get()
findAll(@Query('page', ParsePaginationPipe) page: number) {
  return this.usersService.findAll({ page });
}
```

### Built-in pipes — use these instead of writing custom ones

| Pipe | Purpose |
|---|---|
| `ValidationPipe` | Validate DTO classes via `class-validator` |
| `ParseIntPipe` | Parse string to integer, throw 400 on failure |
| `ParseFloatPipe` | Parse string to float |
| `ParseBoolPipe` | Parse string to boolean |
| `ParseUUIDPipe` | Validate UUID format |
| `ParseArrayPipe` | Parse and validate arrays |
| `ParseEnumPipe` | Validate enum values |
| `DefaultValuePipe` | Provide a default value |

### Rules

- Always use `ParseUUIDPipe` for UUID route params. Never manually validate UUID format in a service.
- Always use `DefaultValuePipe` for optional query params with defaults rather than default parameter values in the controller.
- Register global pipes using `APP_PIPE` token for DI support, not `app.useGlobalPipes()`. Exception: the global `ValidationPipe` in `main.ts` is acceptable since it rarely needs DI.
- Pipes throw exceptions when transformation fails. Always throw a `BadRequestException` from custom pipes — never return `null` or `undefined`.

---

## 12. Exception Filters

Exception filters catch exceptions thrown anywhere in the request lifecycle and shape the error response.

```ts
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>)['message'] ?? 'Error';

      return response.status(status).json({
        statusCode: status,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Unknown error — log full details, return generic 500
    this.logger.error({
      exception,
      path: request.url,
    }, 'Unhandled exception');

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Registering globally with DI support

```ts
// src/app.module.ts
import { APP_FILTER } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
```

### Rules

- Always register the global exception filter using `APP_FILTER` token — not `app.useGlobalFilters()`. Only `APP_FILTER` supports dependency injection.
- Use `@Catch()` with no argument to catch all exceptions. Use `@Catch(HttpException)` to catch only HTTP exceptions.
- Never send stack traces or internal error details in the response. Log them server-side, return a generic message to the client.
- Always throw NestJS `HttpException` subclasses from services and guards:
  - `BadRequestException` — 400
  - `UnauthorizedException` — 401
  - `ForbiddenException` — 403
  - `NotFoundException` — 404
  - `ConflictException` — 409
  - `InternalServerErrorException` — 500
- Filters resolve from lowest level to highest: route → controller → global. A route-level filter that catches an exception prevents the global filter from seeing it.

---

## 13. Configuration

Use `@nestjs/config` with Joi or class-validator for validated environment configuration.

```bash
npm install @nestjs/config
```

```ts
// src/config/index.ts
import { z } from 'zod'; // zod is allowed for config validation only

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().default(''),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

```ts
// src/app.module.ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
  ],
})
export class AppModule {}
```

### Using ConfigService

```ts
@Injectable()
export class UsersService {
  constructor(private configService: ConfigService) {}

  someMethod() {
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
  }
}
```

### Rules

- Always use `ConfigModule.forRoot({ isGlobal: true })` — avoids importing `ConfigModule` into every feature module.
- Use `configService.getOrThrow()` instead of `configService.get()`. It throws if the variable is missing rather than returning `undefined`.
- Validate all env vars at startup using the `config/index.ts` pattern from `node-rules.md`. Never rely on runtime errors to surface missing env vars.
- Never access `process.env` directly inside services or controllers. Inject `ConfigService` or import from `config/index.ts`.

---

## 14. Prisma Integration

Wrap the Prisma client in a NestJS service and inject it as a provider.

```ts
// src/lib/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/index.js';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```ts
// src/lib/database.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

```ts
// src/app.module.ts
@Module({
  imports: [DatabaseModule, ...],
})
export class AppModule {}
```

```ts
// Usage in repository
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

### Rules

- Extend `PrismaClient` in `PrismaService` and implement `OnModuleInit` / `OnModuleDestroy`. This integrates Prisma's lifecycle with NestJS's lifecycle.
- Make `DatabaseModule` global with `@Global()` so `PrismaService` is available in every module without re-importing `DatabaseModule`.
- Inject `PrismaService` into repositories, not services. Services call repositories.
- All Prisma rules from `prisma-rules.md` apply inside NestJS — query patterns, error handling, transaction patterns.

---

## 15. Testing

NestJS provides a testing module that creates a full DI container for tests.

### Unit tests — mock dependencies

```ts
// src/features/users/users.service.spec.ts
import { Test, type TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';
import { NotFoundException } from '@nestjs/common';

const mockUsersRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findMany: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('returns the user when found', async () => {
      const user = { id: 'uuid', name: 'Alice', email: 'alice@example.com' };
      mockUsersRepository.findById.mockResolvedValue(user);

      const result = await service.findOne('uuid');

      expect(result).toEqual(user);
      expect(mockUsersRepository.findById).toHaveBeenCalledWith('uuid');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
```

### E2E tests — full application

```ts
// test/users.e2e-spec.ts
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/users returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/users')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'securepassword' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.email).toBe('alice@example.com');
        expect(res.body.data.id).toBeDefined();
      });
  });

  it('POST /api/users returns 400 on invalid email', () => {
    return request(app.getHttpServer())
      .post('/api/users')
      .send({ name: 'Alice', email: 'not-an-email', password: 'securepassword' })
      .expect(400);
  });
});
```

### Rules

- Unit tests: use `Test.createTestingModule()` with mocked dependencies. Never hit the real database in unit tests.
- E2E tests: use the full `AppModule` with a test database. Configure `NODE_ENV=test` to point to a separate DB.
- Always register the same global pipes and filters in the test app that are registered in `main.ts`. Tests must reflect production behaviour.
- Always call `await app.close()` in `afterAll`. This triggers `OnModuleDestroy` hooks, releasing DB connections.
- Test file naming: `*.spec.ts` for unit tests, `*.e2e-spec.ts` for e2e tests.
- Mock at the provider level using `useValue`. Never use `jest.mock()` for NestJS providers — it bypasses the DI container.

---

## 16. Anti-Patterns

**Never do these.**

### Architecture

- Business logic in controllers. Controllers delegate to services.
- Database queries in services. Services delegate to repositories.
- Importing feature modules into other feature modules just to access one service — export the service, import the module.
- Using `@Global()` on feature modules. Only infrastructure modules should be global.
- Circular module dependencies — restructure or extract shared logic into a third module.
- Using barrel files (`index.ts`) for module or provider imports — causes circular DI errors.

### Dependency injection

- Property injection — always use constructor injection.
- `REQUEST` scope on database clients or loggers — performance disaster.
- Using `REQUEST` scope without understanding it bubbles up the entire dependency chain.
- Raw string injection tokens inline — define them as `Symbol` constants in `constants.ts`.

### Validation

- Plain TypeScript interfaces for request body DTOs — `class-validator` requires classes with decorators.
- Not using `whitelist: true` on `ValidationPipe` — unknown properties pass through silently.
- Not using `transform: true` — query params and route params remain strings, causing type mismatches.
- Not using `@Transform` to sanitise string inputs (trim, lowercase) — valid but dirty data reaches the database.
- Exposing sensitive fields (passwords, tokens) in response DTOs.

### Global components

- Registering global guards, filters, pipes, or interceptors via `app.useGlobalX()` when they need DI — use `APP_GUARD`, `APP_FILTER`, `APP_PIPE`, `APP_INTERCEPTOR` tokens instead.
- Registering the same component as both global and on a specific route — causes duplicate execution.

### Error handling

- Throwing raw `Error` instances from services — NestJS won't know the HTTP status code. Throw `HttpException` subclasses.
- Sending stack traces or DB error details in HTTP responses.
- Empty `catch` blocks that swallow exceptions silently.
- Trying to catch exceptions in interceptors for response shaping — use exception filters for that.

### Configuration

- Accessing `process.env` directly in services or controllers — inject `ConfigService`.
- Using `configService.get()` instead of `configService.getOrThrow()` — silent `undefined` values at runtime.
- Not validating env vars at startup — missing secrets surface as runtime errors in production.

### Testing

- Not calling `await app.close()` in `afterAll` — leaked DB connections.
- Not registering global pipes and filters in the test app — tests pass but production breaks.
- Using `jest.mock()` for NestJS providers — bypasses the DI container.
- Hitting a real database in unit tests — use mocked repositories.
