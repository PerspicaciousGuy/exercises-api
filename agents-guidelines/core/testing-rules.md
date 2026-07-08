# Testing Guidelines

<!-- meta
target: language-agnostic
last_reviewed: 2026-06
sources: martinfowler.com, kentcdodds.com
extends: none
-->

> Language-agnostic testing principles. Apply these to every project regardless of language or framework. A tooling reference section at the end covers JS/TS and Python specifically. Framework-specific files (react-rules.md, express-rules.md, etc.) extend these rules for their own testing patterns.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Types and When to Use Each](#2-test-types-and-when-to-use-each)
3. [What to Test](#3-what-to-test)
4. [What Not to Test](#4-what-not-to-test)
5. [Test Structure and Naming](#5-test-structure-and-naming)
6. [Assertions](#6-assertions)
7. [Mocking Strategy](#7-mocking-strategy)
8. [Test Data and Fixtures](#8-test-data-and-fixtures)
9. [Async Testing](#9-async-testing)
10. [Coverage](#10-coverage)
11. [Test Organisation](#11-test-organisation)
12. [Tooling Reference](#12-tooling-reference)
13. [Anti-Patterns](#13-anti-patterns)

---

## 1. Testing Philosophy

**The purpose of tests is confidence, not coverage.**

A test suite exists to give you confidence that the code works correctly for the people using it. A test that does not increase that confidence is noise, not signal.

### Core principles

- **Test behaviour, not implementation.** Tests verify what the code does (outputs, side effects, observable state changes), not how it does it (internal variables, private methods, implementation choices). A test that breaks when you refactor without changing behaviour is a bad test.

- **The more your tests resemble the way your software is used, the more confidence they give you.** A test that simulates a real user or caller gives more confidence than a test that directly pokes internal state.

- **Mock as little as possible.** Every mock removes confidence in the integration between the thing being tested and the thing being mocked. Only mock what is genuinely impractical to use in tests (external payment APIs, email services, slow third-party services).

- **Tests must be deterministic.** A test that sometimes passes and sometimes fails is worse than no test — it destroys trust in the entire suite. If a test is flaky, fix it immediately or delete it.

- **Tests must be independent.** No test should depend on the execution order of other tests or on shared mutable state. Every test must be able to run in isolation.

- **Fast tests get run. Slow tests get skipped.** Keep unit and integration tests fast. Slow tests belong in a separate suite that runs less frequently.

---

## 2. Test Types and When to Use Each

### Unit tests

Test a single function, class, or module in isolation. All external dependencies (database, network, file system) are replaced with test doubles.

**Use for:**
- Pure functions with complex logic (calculations, transformations, validations)
- Business logic in service classes
- Utility functions
- Edge cases that are hard to trigger through higher-level tests

**Do not use for:**
- Testing that two things work together — that is an integration test
- Testing UI components in isolation from the DOM — use integration tests with a real render

**Speed expectation:** Milliseconds per test. Thousands can run in under a second.

### Integration tests

Test multiple units working together, or test the integration with an external system (database, file system, HTTP endpoint).

**Use for:**
- Service + repository interaction (real database queries)
- HTTP route handlers (real request/response cycle)
- Data serialisation/deserialisation boundaries
- React components rendering and responding to user interactions

**Do not use for:**
- Full end-to-end flows across multiple services

**Speed expectation:** Tens to hundreds of milliseconds per test.

### End-to-end tests (E2E)

Test the entire application stack from the outside, exactly as a real user would. No mocks.

**Use for:**
- Critical user journeys (sign up, login, checkout, core feature flows)
- Smoke tests verifying the app starts and key pages load

**Do not use for:**
- Edge cases — they are too slow and expensive to run for every case
- Exhaustive input validation coverage — do that in unit/integration tests

**Speed expectation:** Seconds to minutes per test. Run in CI, not on every save.

### Distribution guideline

Spend most of your testing time on integration tests. They give the best ratio of confidence to cost. Unit tests handle complex logic and edge cases. E2E tests cover the most critical paths only.

```
E2E         — few, high confidence, slow
Integration — most tests, good confidence, reasonable speed
Unit        — targeted at complex logic and edge cases, fast
```

---

## 3. What to Test

Test the observable behaviour that matters to callers and users.

### Always test

- **The success path** — does the function/endpoint/component work correctly with valid input?
- **Known failure paths** — what happens with invalid input, missing data, auth failure, not found?
- **Business rule enforcement** — do constraints and validations reject invalid states?
- **Data boundaries** — does data serialise and deserialise correctly at I/O boundaries?
- **Error propagation** — does an error in a dependency surface correctly to the caller?

### How to identify what to test

Ask: what would be really bad if it broke? Start there. Then ask: what are the distinct ways a user or caller can interact with this code? Each distinct interaction is a test case.

Do not ask: what lines of code do I need to execute? That is coverage-driven thinking, not confidence-driven thinking.

---

## 4. What Not to Test

### Never test

- **Implementation details** — internal state, private methods, which internal function was called. If refactoring without changing behaviour breaks the test, the test is wrong.
- **Trivial code** — simple getters, setters, pass-through functions with no logic.
- **Third-party library behaviour** — do not test that `JSON.parse` works or that a library returns what its docs say it returns.
- **The framework** — do not test that Express routing works or that React renders JSX.
- **Type annotations** — the type checker handles this. Do not write tests to verify types.

### The implementation detail test

A test is testing an implementation detail when:
- It breaks after a refactor that did not change behaviour
- It passes even when the observable behaviour is broken

Both are failures. The first causes false negatives. The second causes false positives.

```ts
// ❌ Tests implementation detail — checks internal state
expect(service.cache.size).toBe(1);
expect(spy).toHaveBeenCalledWith('internal-method');

// ✅ Tests observable behaviour — checks what the caller sees
expect(result).toEqual({ id: '123', name: 'Alice' });
expect(response.status).toBe(201);
```

---

## 5. Test Structure and Naming

### Structure — AAA (Arrange, Act, Assert)

Every test follows three phases. Keep them visually separated.

```ts
it('returns 404 when user does not exist', async () => {
  // Arrange
  const userId = 'non-existent-id';
  mockRepository.findById.mockResolvedValue(null);

  // Act
  const response = await request(app).get(`/users/${userId}`);

  // Assert
  expect(response.status).toBe(404);
  expect(response.body.title).toBe('Not Found');
});
```

### Test naming

Name tests as statements of behaviour, not descriptions of code.

```ts
// ✅ Behaviour statement — reads like a specification
it('returns 401 when no auth token is provided')
it('sends a confirmation email after successful registration')
it('throws NotFoundError when user does not exist')
it('returns paginated results when limit and cursor are provided')

// ❌ Code description — tells you what the code does, not what matters
it('calls the repository findById method')
it('sets isLoading to true')
it('tests the create function')
```

### Test grouping

Group related tests using `describe` blocks. Use one `describe` per class, module, or route. Nest a second `describe` for the specific method or scenario.

```ts
describe('UserService', () => {
  describe('getUser', () => {
    it('returns the user when found')
    it('throws NotFoundError when user does not exist')
  });

  describe('createUser', () => {
    it('creates and returns a new user with valid input')
    it('throws ConflictError when email already exists')
    it('hashes the password before storing')
  });
});
```

### Rules

- One logical assertion per test where practical. Multiple assertions are acceptable when they verify the same behaviour.
- Never use `and` in a test name — it means the test is doing too many things.
- Test names must be unique and self-describing. You must be able to understand what failed from the test name alone without reading the code.
- Keep tests short. If a test requires more than 20 lines of setup, extract the setup into a fixture or factory.

---

## 6. Assertions

### Be specific

Assert the exact value you expect. Loose assertions allow broken behaviour to pass.

```ts
// ❌ Too loose — passes even if response body is wrong
expect(response.status).toBe(200);

// ✅ Specific — verifies both status and the shape of the data
expect(response.status).toBe(200);
expect(response.body).toMatchObject({
  id: expect.any(String),
  name: 'Alice',
  email: 'alice@example.com',
});
```

### Assert on outputs, not calls

Prefer asserting on the return value or observable state over asserting that a specific function was called.

```ts
// ❌ Asserts implementation — did we call the right thing?
expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alice' }));

// ✅ Asserts outcome — did the right thing happen?
const user = await userService.createUser({ name: 'Alice', email: 'alice@example.com' });
expect(user.name).toBe('Alice');
expect(user.id).toBeDefined();
```

Call assertion (`toHaveBeenCalledWith`) is appropriate when the call itself is the observable side effect — e.g. verifying an email was sent, a payment was charged, or a cache was invalidated.

### Error assertions

Always assert on the specific error type and message when testing error paths.

```ts
// ✅ Specific error assertion
await expect(userService.getUser('missing-id'))
  .rejects.toThrow(NotFoundError);

await expect(userService.getUser('missing-id'))
  .rejects.toThrow("User 'missing-id' not found");
```

---

## 7. Mocking Strategy

### What to mock

Mock only at the boundary of your system — where your code interacts with things outside your control.

**Always mock:**
- External HTTP APIs (payment processors, email services, third-party data)
- Time-sensitive operations (anything using `Date.now()`, `setTimeout` in business logic)
- Random number generation when the result affects test assertions

**Mock in unit tests, use real in integration tests:**
- Database (use in-memory DB or test DB in integration tests)
- File system (use temp dirs in integration tests)
- Message queues

**Never mock:**
- Your own code to test your own code
- The module under test
- Standard library functions
- Third-party libraries being tested for correct integration

### Mock at the right level

Mock the boundary, not the internals. If testing a service that calls a repository, mock the repository interface. Do not mock the database driver that the repository uses internally.

```ts
// ✅ Mock the boundary — the repository interface
const mockRepository = { findById: jest.fn(), save: jest.fn() };
const service = new UserService(mockRepository);

// ❌ Mock too deep — couples the test to the implementation
jest.mock('pg'); // mocking the DB driver used inside the repository
```

### Test doubles vocabulary

Use the right term for the right tool:

| Type | What it does | When to use |
|---|---|---|
| **Stub** | Returns a canned response, no assertions | Replace a dependency to control inputs |
| **Mock** | Returns a canned response + records calls for assertion | Verify a side effect occurred (email sent, event published) |
| **Fake** | A lightweight real implementation (in-memory DB) | Replace slow/external infrastructure in integration tests |
| **Spy** | Wraps a real implementation and records calls | Assert on calls without replacing behaviour |

### Rules

- Reset all mocks between tests. Never share mock state across tests.
- Never leave a mock in place that was set up for a specific test without clearing it.
- When you find yourself mocking many things to test one thing, the thing under test likely has too many dependencies — consider refactoring.

---

## 8. Test Data and Fixtures

### Factory functions

Use factory functions to create test data. Never repeat object construction inline across multiple tests.

```ts
// ✅ Factory function — single source of truth for test data shape
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-id-123',
    name: 'Alice Test',
    email: 'alice@test.com',
    role: 'user',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// Usage
const adminUser = createUser({ role: 'admin' });
const userWithNoEmail = createUser({ email: '' });
```

### Rules

- Never use production data in tests.
- Never rely on a specific test database state that was set up by a previous test. Each test must set up its own data.
- Use realistic test data. `'test'` and `'foo'` as values make failures harder to understand. `'alice@example.com'` and `'Alice Test'` make failures clear.
- For integration tests that hit a real database, clean up test data after each test. Use transactions that are rolled back, or truncate tables in `afterEach`.
- Never hardcode dynamic values like dates or IDs across tests where those values could collide or drift. Use factories that generate consistent values.

---

## 9. Async Testing

### Always await async assertions

```ts
// ✅ Awaited — test actually verifies the async behaviour
it('throws when user is not found', async () => {
  await expect(userService.getUser('missing')).rejects.toThrow(NotFoundError);
});

// ❌ Not awaited — test passes without checking anything
it('throws when user is not found', () => {
  expect(userService.getUser('missing')).rejects.toThrow(NotFoundError);
  // Promise is created but never awaited — test passes vacuously
});
```

### Testing timeouts and delays

Never use real `setTimeout` delays in tests. Use fake timers.

```ts
// JS/TS — Jest fake timers
jest.useFakeTimers();
// trigger code
jest.advanceTimersByTime(5000);
jest.useRealTimers();

// Python — freezegun or unittest.mock.patch for time
```

### Cleaning up after async tests

Always clean up subscriptions, intervals, and open handles after async tests. Uncleaned async operations cause test suites to hang.

---

## 10. Coverage

### Coverage is a tool, not a target

Coverage shows which lines of code are exercised by tests. It does not show whether those tests are meaningful or whether the important cases are covered. A line covered by a useless test still counts as covered.

**Use coverage to find untested code.** Do not use it as a proxy for test quality.

### Coverage thresholds

Set a minimum threshold to prevent coverage from declining, not to enforce a specific number.

Reasonable thresholds:
- Application code (services, business logic): 80%
- Utility libraries and shared packages: 90–100% (they are small and widely depended upon)
- UI components: 70% (E2E tests cover the rest)
- Generated code, migrations, config files: exclude from coverage

**Never target 100% coverage for application code.** Chasing 100% leads to tests written to satisfy the number, not to gain confidence. Simple getters, one-line pass-throughs, and obvious code do not need tests.

### What coverage cannot tell you

- Whether tests assert correctly
- Whether the important use cases are covered
- Whether the code does the right thing

Focus on use case coverage — ask "is every meaningful way this feature can be used or fail covered by a test?" — not line coverage.

---

## 11. Test Organisation

### File location

Colocate test files with the code they test.

```
src/
├── services/
│   ├── userService.ts
│   └── userService.test.ts     ← colocated unit test
├── routes/
│   ├── users.router.ts
│   └── users.router.test.ts    ← colocated integration test
```

Alternatively, use a `__tests__` folder inside the same directory. Both are acceptable. Never put all tests in a single top-level `tests/` folder far from the source — it makes navigation harder and encourages tests that are disconnected from the code they test.

E2E tests are the exception — they live in a top-level `e2e/` or `tests/e2e/` folder since they test the full application, not individual modules.

### Test file naming

| Convention | Example |
|---|---|
| JS/TS unit/integration | `userService.test.ts` |
| JS/TS e2e | `checkout.e2e.ts` |
| Python unit/integration | `test_user_service.py` |
| Python e2e | `test_checkout_e2e.py` |

### Test suite organisation

Separate test suites by speed and scope in CI:

```
unit          → runs on every file save / pre-commit
integration   → runs on every push
e2e           → runs before merge to main / on deployment
```

---

## 12. Tooling Reference

### JavaScript / TypeScript

**Test runner and assertions:**
- `vitest` — preferred for Vite-based projects and modern TS projects. Faster than Jest, native ESM support.
- `jest` — standard for Node.js backend projects. Use with `ts-jest` or `--experimental-vm-modules` for TypeScript.

**HTTP integration testing:**
- `supertest` — for Express, Fastify route testing without starting a real server.
- Fastify's built-in `app.inject()` — for Fastify route testing.

**Frontend component testing:**
- `@testing-library/react` — for React component integration tests. Test through the DOM, not component internals.
- `@testing-library/user-event` — simulate real user interactions (click, type, tab).

**Mocking:**
- Built-in `jest.fn()` / `vi.fn()` for stubs and mocks.
- `msw` (Mock Service Worker) — for mocking HTTP requests at the network level in both browser and Node.js environments.

**Fake timers:**
- `jest.useFakeTimers()` / `vi.useFakeTimers()` — for testing time-dependent code.

**Configuration (`vitest`):**
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',  // or 'jsdom' for frontend
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
      exclude: ['**/*.config.*', '**/generated/**', '**/migrations/**'],
    },
  },
});
```

### Python

**Test runner:**
- `pytest` — standard. Use with `pytest-asyncio` for async tests.

**Mocking:**
- `unittest.mock` (standard library) — `MagicMock`, `AsyncMock`, `patch`.
- `pytest-mock` — `mocker` fixture for cleaner mock usage in pytest.

**HTTP integration testing:**
- `httpx` with `TestClient` — for FastAPI/Starlette.
- `requests` with Flask test client — for Flask.

**Fake data:**
- `faker` — for generating realistic test data.

**Time mocking:**
- `freezegun` — freeze or travel through time in tests.

**Configuration (`pyproject.toml`):**
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=80"

[tool.coverage.run]
omit = ["*/migrations/*", "*/generated/*", "*/config.py"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```

---

## 13. Anti-Patterns

**Never do these.**

### Test design

- Testing implementation details (internal state, private methods, which mock was called when the call itself is not the side effect).
- Writing tests to satisfy coverage numbers rather than gain confidence.
- One massive test that covers everything — one test, one behaviour.
- Using `and` in a test name — split it into two tests.
- Tests that depend on execution order or shared mutable state.
- Flaky tests left unfixed — fix or delete immediately.
- Tests with no assertions — they always pass and give false confidence.

### Mocking

- Mocking so much that the test no longer tests anything real.
- Mocking your own code to test your own code.
- Not resetting mocks between tests — state leaks between tests.
- Mocking at the wrong level (mocking the DB driver instead of the repository interface).
- Using real external services (payment APIs, email servers) in automated tests.

### Structure

- No test grouping — flat list of hundreds of `it()` calls with no `describe` structure.
- Test names that describe code rather than behaviour.
- Setup code duplicated across every test instead of using fixtures or factories.
- Tests far from the source code they test.
- Mixing unit, integration, and E2E tests in the same suite with no separation.

### Async

- Not awaiting async assertions — tests pass vacuously.
- Real `setTimeout` delays in tests — makes the suite slow and non-deterministic.
- Not cleaning up subscriptions and open handles — test suite hangs.

### Coverage

- Targeting 100% coverage for application code.
- Writing trivial tests (getters, pass-throughs) just to increase coverage.
- Not excluding generated code, migrations, and config from coverage reports.
- Using coverage as the primary measure of test quality.
