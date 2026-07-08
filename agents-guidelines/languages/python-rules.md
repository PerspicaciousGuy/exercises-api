# Python Coding Guidelines

<!-- meta
target: Python 3.13
last_reviewed: 2026-06
sources: docs.python.org, peps.python.org, docs.astral.sh/uv, docs.astral.sh/ruff
extends: none
-->

> Universal Python rules. Apply these to every Python project regardless of framework. Framework-specific files extend these rules and override them only where explicitly stated.
>
> Target: **Python 3.13**. Do not write code that requires Python 3.12 or below unless explicitly instructed.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Code Style and Formatting](#2-code-style-and-formatting)
3. [Type Hints](#3-type-hints)
4. [Naming Conventions](#4-naming-conventions)
5. [Functions](#5-functions)
6. [Classes](#6-classes)
7. [Modules and Imports](#7-modules-and-imports)
8. [Data Validation with Pydantic](#8-data-validation-with-pydantic)
9. [Error Handling](#9-error-handling)
10. [Async Patterns](#10-async-patterns)
11. [Environment Variables](#11-environment-variables)
12. [Logging](#12-logging)
13. [Testing with pytest](#13-testing-with-pytest)
14. [Security](#14-security)
15. [Anti-Patterns](#15-anti-patterns)

---

## 1. Project Setup

### Package manager — uv

Use `uv` as the package manager. Do not use `pip`, `poetry`, or `pipenv` for new projects.

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create a new project
uv init my-project
cd my-project

# Add a dependency
uv add requests

# Add a dev dependency
uv add --dev pytest ruff mypy

# Run a script
uv run python main.py

# Run tests
uv run pytest
```

### `pyproject.toml` — required structure

```toml
[project]
name = "my-project"
version = "0.1.0"
description = "Project description"
requires-python = ">=3.13"
dependencies = [
    "pydantic>=2.0",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "mypy>=1.10",
    "ruff>=0.5",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py313"
line-length = 88

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "B",    # flake8-bugbear
    "C4",   # flake8-comprehensions
    "UP",   # pyupgrade
    "N",    # pep8-naming
    "SIM",  # flake8-simplify
    "ANN",  # flake8-annotations (type hints)
]
ignore = [
    "ANN101", # missing type annotation for self
    "ANN102", # missing type annotation for cls
]

[tool.ruff.lint.isort]
known-first-party = ["my_project"]

[tool.mypy]
python_version = "3.13"
strict = true
warn_return_any = true
warn_unused_ignores = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### `.python-version`

Always include a `.python-version` file in the project root. This tells `uv` which Python version to use.

```
3.13
```

### Virtual environment

`uv` manages the virtual environment automatically. Never manually create a `.venv`. Never commit `.venv` to version control.

Add to `.gitignore`:
```
.venv/
__pycache__/
*.pyc
*.pyo
.mypy_cache/
.ruff_cache/
.pytest_cache/
dist/
```

### Rules

- Always set `requires-python = ">=3.13"` in `pyproject.toml`.
- Always commit `uv.lock` to version control. Never commit `requirements.txt` generated from `uv pip compile` unless the project explicitly requires it.
- Never use `pip install` directly. Always use `uv add` or `uv run`.
- Separate runtime dependencies from dev dependencies using `[project.optional-dependencies]` with a `dev` group.
- Run all commands through `uv run` to ensure the locked environment is used.

---

## 2. Code Style and Formatting

### Tooling — Ruff only

Use `ruff` for both linting and formatting. Do not use `black`, `flake8`, `isort`, `pylint`, or `autopep8`. Ruff replaces all of them.

```bash
# Format all files
uv run ruff format .

# Lint and auto-fix
uv run ruff check --fix .

# Check without fixing
uv run ruff check .
```

### Type checking — mypy

Use `mypy` in strict mode for type checking.

```bash
uv run mypy src/
```

### PEP 8 rules enforced by Ruff

These are the key style rules. Ruff enforces them automatically — do not manually argue with them:

- **Indentation:** 4 spaces. Never tabs.
- **Line length:** 88 characters (same as Black).
- **Blank lines:** 2 blank lines between top-level definitions, 1 between methods.
- **Trailing whitespace:** never.
- **String quotes:** Ruff formatter uses double quotes by default.

### Docstrings

Write docstrings for all public modules, classes, and functions. Use Google style.

```python
def calculate_discount(price: float, rate: float) -> float:
    """Calculate the discounted price.

    Args:
        price: The original price in dollars.
        rate: The discount rate as a decimal between 0 and 1.

    Returns:
        The price after applying the discount.

    Raises:
        ValueError: If rate is not between 0 and 1.
    """
    if not 0 <= rate <= 1:
        raise ValueError(f"Rate must be between 0 and 1, got {rate}")
    return price * (1 - rate)
```

Rules:
- Public functions, methods, classes, and modules must have docstrings.
- Private functions (prefixed with `_`) do not require docstrings unless complex.
- One-liner docstrings are acceptable for simple, obvious functions.

---

## 3. Type Hints

Type hints are required on all function signatures. Use the modern syntax from Python 3.10+.

### Built-in types — use directly, no `typing` import needed

```python
# ✅ Python 3.9+ — use built-in generics directly
def process(items: list[str]) -> dict[str, int]:
    return {item: len(item) for item in items}

def get_mapping() -> dict[str, list[int]]:
    return {}

# ❌ Deprecated — do not import from typing for these
from typing import List, Dict, Tuple, Set
def process(items: List[str]) -> Dict[str, int]: ...
```

### Union types — use `|` syntax

```python
# ✅ Python 3.10+ — use | for unions
def parse(value: str | int) -> str:
    return str(value)

# ✅ Optional is just T | None
def find_user(user_id: str) -> User | None:
    ...

# ❌ Deprecated
from typing import Union, Optional
def parse(value: Union[str, int]) -> str: ...
def find_user(user_id: str) -> Optional[User]: ...
```

### Generics — use PEP 695 syntax (Python 3.12+)

```python
# ✅ PEP 695 — new generic syntax
def first[T](items: list[T]) -> T:
    return items[0]

class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

# Type aliases — use `type` statement (PEP 695)
type Vector = list[float]
type Matrix[T] = list[list[T]]

# ❌ Old style — do not use
from typing import TypeVar, Generic
T = TypeVar('T')
class Stack(Generic[T]): ...
```

### `typing` module — what is still needed

Only import from `typing` for things not expressible with built-in syntax:

```python
from typing import (
    Any,          # use sparingly — see rules below
    Never,        # for exhaustiveness checking
    TypeGuard,    # for custom type narrowing functions
    TypeIs,       # Python 3.13+ — narrower TypeGuard
    Protocol,     # structural subtyping
    runtime_checkable,  # Protocol that works with isinstance
    overload,     # function overloads
    final,        # mark a class or method as non-overridable
    TYPE_CHECKING, # import-time only imports
    cast,         # for type narrowing (use sparingly)
    Literal,      # literal types
    TypedDict,    # typed dictionaries
    NamedTuple,   # typed named tuples
)
```

### `Any`

Avoid `Any`. Use it only when interfacing with untyped third-party code and no better option exists. Add a comment when you do.

```python
# ❌
def process(data: Any) -> Any:
    return data

# ✅ — type the boundary, use specific types inside
def process(data: dict[str, object]) -> str:
    ...

# ✅ — when Any is truly unavoidable
import some_untyped_library
result: Any = some_untyped_library.get_data()  # no stubs available
```

### Annotating all variables where type is not obvious

```python
# ✅ Annotate where inference is not clear
users: list[User] = []
config: dict[str, str] = {}

# Not needed — type is obvious from assignment
name = "Alice"
count = 0
is_active = True
```

### `TYPE_CHECKING` for circular imports

Use `TYPE_CHECKING` to avoid circular imports caused by type-only imports.

```python
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import User

def get_user_name(user: User) -> str:
    return user.name
```

---

## 4. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Module | `snake_case` | `user_service.py` |
| Package | `snake_case` | `my_package/` |
| Function | `snake_case` | `get_user`, `calculate_total` |
| Variable | `snake_case` | `user_name`, `item_count` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Class | `PascalCase` | `UserService`, `ApiClient` |
| Exception | `PascalCase`, `Error` suffix | `ValidationError`, `NotFoundError` |
| Type alias | `PascalCase` | `UserId`, `JsonDict` |
| Protocol | `PascalCase` | `Serializable`, `Comparable` |
| Private (module-level) | Leading `_` | `_internal_cache` |
| Private (class) | Leading `_` | `self._value` |
| Name-mangled (class) | Double leading `__` | `self.__secret` — use rarely |
| Boolean variable | `is_`, `has_`, `should_`, `can_` prefix | `is_active`, `has_error` |

### Rules

- Never use single-letter names except for loop counters (`i`, `j`) or well-known math variables.
- Never use built-in names as variable names: `list`, `dict`, `type`, `id`, `input`, `filter`, `map`.
- Avoid abbreviations unless universally understood (`url`, `id`, `api`, `db`).

---

## 5. Functions

### Signatures

Always annotate parameter types and return types on public functions.

```python
# ✅ Fully annotated
def create_user(
    name: str,
    email: str,
    role: UserRole = UserRole.USER,
) -> User:
    ...

# ✅ Return None explicitly when function has no return value
def log_event(event: str) -> None:
    print(event)

# ❌ Missing annotations
def create_user(name, email, role="user"):
    ...
```

### Default arguments

Never use mutable default arguments. Use `None` and set the default inside the function.

```python
# ❌ Mutable default — shared across all calls
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

# ✅ None default, initialise inside
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```

### Keep functions small

- **Soft limit: 20 lines** per function body. Above this, look for extraction opportunities.
- **Hard limit: 50 lines** per function body. Split if exceeded.
- A function must do one thing. If you need "and" to describe what it does, split it.

### Pure functions

Prefer pure functions (no side effects, same input always returns same output). Reserve side effects for explicit I/O boundaries.

### `*args` and `**kwargs`

Always annotate `*args` and `**kwargs` when their types are known.

```python
def log(*messages: str, level: str = "info") -> None:
    for message in messages:
        print(f"[{level}] {message}")
```

### `@overload` for multiple signatures

Use `@overload` when a function has multiple valid call signatures.

```python
from typing import overload

@overload
def parse(value: str) -> int: ...
@overload
def parse(value: bytes) -> str: ...

def parse(value: str | bytes) -> int | str:
    if isinstance(value, str):
        return int(value)
    return value.decode()
```

---

## 6. Classes

### Dataclasses

Use `@dataclass` for classes that primarily hold data. Prefer `@dataclass(frozen=True)` for immutable data containers.

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Point:
    x: float
    y: float

@dataclass
class Config:
    host: str
    port: int = 8000
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)
```

Never use mutable default values directly in `@dataclass` fields. Use `field(default_factory=...)` instead.

### Regular classes

```python
class UserService:
    """Service for managing users."""

    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository  # private, prefixed with _

    def get_user(self, user_id: str) -> User:
        user = self._repository.find_by_id(user_id)
        if user is None:
            raise NotFoundError(f"User {user_id!r} not found")
        return user
```

### Protocols

Use `Protocol` for structural subtyping (duck typing with type safety). Prefer it over abstract base classes for interface definitions.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Repository[T]:
    def find_by_id(self, id: str) -> T | None: ...
    def save(self, entity: T) -> T: ...
    def delete(self, id: str) -> None: ...
```

### Rules

- Never define `__init__` in a dataclass — use field defaults.
- Use `__slots__` only in performance-critical classes. It prevents adding arbitrary attributes.
- Use `@property` for computed attributes. Never name a method `get_x` when `x` as a property is cleaner.
- Never inherit from multiple concrete classes. Multiple inheritance from `Protocol` or abstract bases is acceptable.
- Always define `__repr__` for non-dataclasses if debugging requires readable output.
- `@dataclass` generates `__repr__` automatically.

---

## 7. Modules and Imports

### Import order

Ruff enforces import order automatically (isort rules). Follow this structure:

```python
# 1. Standard library
import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING

# 2. Third-party packages
import httpx
from pydantic import BaseModel

# 3. Local application imports
from my_project.models import User
from my_project.services import UserService

# 4. TYPE_CHECKING-only imports (do not run at runtime)
if TYPE_CHECKING:
    from my_project.repositories import UserRepository
```

### Rules

- Never use wildcard imports: `from module import *`. They pollute the namespace and break type checkers.
- Never use relative imports outside of packages. Use absolute imports.
- Use relative imports only within the same package when it aids clarity.
- Avoid circular imports. If two modules need each other, extract shared code into a third module or use `TYPE_CHECKING`.
- One module per file. Never combine unrelated functionality in one module.
- `__init__.py` should only re-export the public API of the package. Keep it minimal.

### `__all__`

Define `__all__` in every module that has a public API. This controls what `from module import *` would export and makes the public interface explicit.

```python
__all__ = ["UserService", "UserRepository", "User"]
```

---

## 8. Data Validation with Pydantic

Use **Pydantic v2** for all data validation at external boundaries (API inputs, config, external data).

### Defining models

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic import EmailStr
from typing import Annotated

class CreateUserRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr
    password: Annotated[str, Field(min_length=8, max_length=72)]
    role: UserRole = UserRole.USER

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()

    model_config = {
        "str_strip_whitespace": True,  # strip all string fields
    }
```

### Immutable models

Use `model_config = {"frozen": True}` for models that should not be mutated after creation.

```python
class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime

    model_config = {"frozen": True}
```

### Validation at boundaries

```python
# ✅ Validate at the entry point — before any logic runs
def create_user(raw_data: dict[str, object]) -> User:
    request = CreateUserRequest.model_validate(raw_data)
    # request is now fully typed and validated
    return user_repository.create(request)

# ✅ Parse and validate JSON
request = CreateUserRequest.model_validate_json(json_string)

# ✅ Serialise for API response
response_dict = user.model_dump(mode="json")
response_json = user.model_dump_json()
```

### Rules

- Define Pydantic models in dedicated `schemas.py` or `models.py` files, not inline in request handlers.
- Use `Annotated` with `Field` for constraints instead of passing constraints directly to `Field` as kwargs. `Annotated` is reusable across multiple fields.
- Never use `model.dict()` — it is deprecated in Pydantic v2. Use `model.model_dump()`.
- Never use `model.json()` — use `model.model_dump_json()`.
- Use `model_validate` instead of constructing models with `Model(**data)` for external data — it runs validators.
- All external data (API responses, file contents, database rows from untyped drivers) must pass through a Pydantic model before use.

---

## 9. Error Handling

### Custom exceptions

Define a base exception class for the project. All application exceptions extend it.

```python
# src/exceptions.py
class AppError(Exception):
    """Base class for all application errors."""

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code

class ValidationError(AppError):
    pass

class NotFoundError(AppError):
    pass

class UnauthorizedError(AppError):
    pass

class ConflictError(AppError):
    pass
```

### Raising exceptions

```python
# ✅ Use specific exception types
def get_user(user_id: str) -> User:
    user = repository.find(user_id)
    if user is None:
        raise NotFoundError(f"User {user_id!r} not found")
    return user

# ✅ Use exception chaining to preserve context
try:
    result = external_api_call()
except httpx.HTTPError as e:
    raise AppError("Failed to fetch external data") from e

# ❌ Swallowing exception context
try:
    result = external_api_call()
except httpx.HTTPError:
    raise AppError("Failed to fetch external data")  # loses original traceback
```

### Catching exceptions

```python
# ✅ Catch specific exception types
try:
    user = get_user(user_id)
except NotFoundError:
    return {"error": "User not found"}, 404
except AppError as e:
    logger.error("Application error", exc_info=True)
    return {"error": str(e)}, 500

# ❌ Bare except — catches everything including KeyboardInterrupt, SystemExit
try:
    risky_operation()
except:
    pass

# ❌ Catching Exception too broadly without re-raising or logging
try:
    risky_operation()
except Exception:
    pass
```

### Exhaustiveness checking with `Never`

```python
from typing import Never

def assert_never(value: Never) -> Never:
    raise AssertionError(f"Unhandled case: {value!r}")

type Status = "active" | "inactive" | "banned"

def handle_status(status: Status) -> str:
    match status:
        case "active":
            return "green"
        case "inactive":
            return "grey"
        case "banned":
            return "red"
        case _ as unreachable:
            assert_never(unreachable)  # type error if a case is missing
```

### Rules

- Never raise a bare `Exception`. Always raise a specific subclass.
- Never use bare `except:`. Always catch a specific exception or `Exception`.
- Always use exception chaining (`raise X from Y`) to preserve context.
- Never catch an exception, log it, and continue as if nothing happened.
- Never use exceptions for control flow in performance-critical code. Return `None` or a result type instead.

---

## 10. Async Patterns

### `async`/`await`

Use `asyncio` for all async code. Never mix sync and async code in the same execution context.

```python
import asyncio
import httpx

async def fetch_user(client: httpx.AsyncClient, user_id: str) -> dict[str, object]:
    response = await client.get(f"/users/{user_id}")
    response.raise_for_status()
    return response.json()

async def fetch_multiple(user_ids: list[str]) -> list[dict[str, object]]:
    async with httpx.AsyncClient() as client:
        # ✅ Run concurrently — not sequentially
        results = await asyncio.gather(
            *[fetch_user(client, uid) for uid in user_ids]
        )
    return list(results)
```

### Concurrent execution

```python
# ✅ gather for concurrent independent operations
results = await asyncio.gather(get_user(id), get_posts(id))

# ✅ TaskGroup (Python 3.11+) — better error handling than gather
async with asyncio.TaskGroup() as tg:
    user_task = tg.create_task(get_user(user_id))
    posts_task = tg.create_task(get_posts(user_id))

user = user_task.result()
posts = posts_task.result()

# ✅ gather with return_exceptions=True when partial failure is acceptable
results = await asyncio.gather(
    *tasks,
    return_exceptions=True,
)
for result in results:
    if isinstance(result, Exception):
        logger.error("Task failed", exc_info=result)
```

### Timeouts

Always apply timeouts to external calls.

```python
import asyncio

# ✅ asyncio.timeout (Python 3.11+)
async def fetch_with_timeout(url: str) -> str:
    async with asyncio.timeout(5.0):
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            return response.text
```

### Rules

- Never call `asyncio.run()` inside an async function. Call it only at the top level to start the event loop.
- Never use `time.sleep()` in async code. Use `await asyncio.sleep()`.
- Never run blocking I/O (file reads, sync DB calls) inside an async function. Use `asyncio.to_thread()` to run blocking code in a thread pool.
- Use `asyncio.TaskGroup` (Python 3.11+) over `asyncio.gather` for structured concurrency with proper error propagation.
- Always use `async with` for async context managers. Never manually call `__aenter__` and `__aexit__`.
- Mark a function `async` only if it contains `await`. Sync functions that return coroutines are a bug.

```python
# ✅ Run blocking code in thread pool
content = await asyncio.to_thread(Path("large_file.txt").read_text)
```

---

## 11. Environment Variables

Centralise all environment variable access in a `config.py` module. Use Pydantic's `BaseSettings` for validated configuration.

```bash
uv add pydantic-settings
```

```python
# src/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_env: str = "development"
    port: int = 8000
    database_url: str
    jwt_secret: str
    allowed_origins: list[str] = []
    log_level: str = "INFO"

    @field_validator("jwt_secret")
    @classmethod
    def validate_secret_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT secret must be at least 32 characters")
        return v

# Instantiate once — import this instance everywhere
settings = Settings()
```

```python
# Usage — import the settings instance, never os.environ
from my_project.config import settings

def connect_db() -> Engine:
    return create_engine(settings.database_url)
```

### Rules

- Never call `os.environ.get()` or `os.environ[]` outside of `config.py`.
- Always validate config at startup. If a required variable is missing, `pydantic-settings` raises a `ValidationError` before the app starts.
- Never log the full `settings` object — it contains secrets. Log only non-sensitive fields.
- Always maintain a `.env.example` file committed to the repo with all required keys and placeholder values.
- Never commit `.env` or `.env.local` to version control. Add them to `.gitignore`.

---

## 12. Logging

Use Python's standard `logging` module. Configure it with structured output via `structlog` or with a JSON formatter for production.

```python
# src/lib/logger.py
import logging
import sys

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
```

```python
# Usage — get a named logger per module
import logging

logger = logging.getLogger(__name__)

def process_order(order_id: str) -> None:
    logger.info("Processing order", extra={"order_id": order_id})
    try:
        # ...
        logger.info("Order processed successfully", extra={"order_id": order_id})
    except AppError:
        logger.error("Failed to process order", exc_info=True, extra={"order_id": order_id})
        raise
```

### Rules

- Always use `logging.getLogger(__name__)` — never create a logger with a hardcoded name other than `__name__`.
- Never use `print()` for logging in production code. Use the logger.
- Use `exc_info=True` in `logger.error()` and `logger.exception()` to attach the full traceback.
- Never log sensitive data: passwords, tokens, API keys, or PII.
- Use log levels correctly:
  - `DEBUG` — detailed diagnostic info, off in production
  - `INFO` — normal operational events
  - `WARNING` — unexpected but recoverable
  - `ERROR` — failures that need investigation
  - `CRITICAL` — system-level failures
- Configure logging once at application startup, not per module.

---

## 13. Testing with pytest

### Setup

```bash
uv add --dev pytest pytest-asyncio coverage
```

### File and directory structure

```
tests/
├── conftest.py           # shared fixtures
├── unit/
│   ├── test_user_service.py
│   └── test_validators.py
└── integration/
    └── test_api.py
```

### Writing tests

```python
# tests/unit/test_user_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from my_project.services.user_service import UserService
from my_project.exceptions import NotFoundError

@pytest.fixture
def mock_repository() -> MagicMock:
    return MagicMock()

@pytest.fixture
def user_service(mock_repository: MagicMock) -> UserService:
    return UserService(repository=mock_repository)

class TestGetUser:
    def test_returns_user_when_found(
        self,
        user_service: UserService,
        mock_repository: MagicMock,
    ) -> None:
        expected = User(id="123", name="Alice")
        mock_repository.find_by_id.return_value = expected

        result = user_service.get_user("123")

        assert result == expected
        mock_repository.find_by_id.assert_called_once_with("123")

    def test_raises_not_found_when_missing(
        self,
        user_service: UserService,
        mock_repository: MagicMock,
    ) -> None:
        mock_repository.find_by_id.return_value = None

        with pytest.raises(NotFoundError, match="123"):
            user_service.get_user("123")
```

### Async tests

```python
import pytest

@pytest.mark.asyncio
async def test_fetch_user() -> None:
    result = await fetch_user("123")
    assert result["id"] == "123"
```

With `asyncio_mode = "auto"` in `pyproject.toml`, the `@pytest.mark.asyncio` decorator is not required.

### Fixtures

```python
# tests/conftest.py
import pytest
from my_project.config import Settings

@pytest.fixture(scope="session")
def test_settings() -> Settings:
    return Settings(
        app_env="test",
        database_url="sqlite:///:memory:",
        jwt_secret="test-secret-at-least-32-characters!!",
    )
```

### Rules

- Test file names must match the module under test: `test_user_service.py` for `user_service.py`.
- Every test function name must start with `test_`.
- Group related tests in a class prefixed with `Test`.
- Use `pytest.fixture` for shared setup. Never put shared setup in `setUp` methods (that is unittest style).
- Mock at the boundary — mock I/O (DB, HTTP) in unit tests. Use real dependencies in integration tests.
- Always test: success path, failure path, and edge cases (empty input, None, zero).
- Never assert on implementation details (which internal method was called). Assert on observable outputs.
- Run tests with coverage: `uv run pytest --cov=src --cov-report=term-missing`.

---

## 14. Security

### Input validation

Always validate external input through Pydantic before use. Never use raw user-supplied data in:
- File paths
- SQL queries
- Shell commands
- Template strings

### Secrets

Never hardcode secrets, passwords, or API keys in source code or config files committed to version control. Load them from environment variables via `pydantic-settings`.

### Timing-safe comparison

Use `hmac.compare_digest` for comparing secrets, tokens, or hashes. Never use `==`.

```python
import hmac

def is_token_valid(provided: str, expected: str) -> bool:
    # ✅ Timing-safe — prevents timing attacks
    return hmac.compare_digest(provided.encode(), expected.encode())

# ❌ NOT safe — leaks timing information
def is_token_valid(provided: str, expected: str) -> bool:
    return provided == expected
```

### Path traversal

Never construct file paths from user input without sanitisation.

```python
from pathlib import Path

def safe_read_file(filename: str, base_dir: Path) -> str:
    # Strip path components from filename
    safe_name = Path(filename).name  # takes only the final component
    full_path = (base_dir / safe_name).resolve()

    # Verify the resolved path is inside the base directory
    if not full_path.is_relative_to(base_dir.resolve()):
        raise ValidationError("Invalid file path")

    return full_path.read_text()
```

### Dependencies

- Run `uv audit` in CI to check for known vulnerabilities.
- Keep dependencies up to date. Use `uv lock --upgrade` periodically.
- Review `pyproject.toml` changes in code review.

### Rules

- Never use `eval()` or `exec()` on user-supplied input.
- Never use `subprocess` with `shell=True` and user-supplied arguments.
- Never use `pickle` to deserialise untrusted data — it allows arbitrary code execution.
- Always use `hashlib` with a strong algorithm (SHA-256 or better). Never use MD5 or SHA-1 for security purposes.
- Use `secrets` module for generating cryptographically secure random values, not `random`.

```python
import secrets

# ✅ Cryptographically secure
token = secrets.token_hex(32)
code = secrets.randbelow(1_000_000)

# ❌ Not secure
import random
token = hex(random.getrandbits(128))
```

---

## 15. Anti-Patterns

**Never do these.**

### Type system

- Using `Any` without a comment explaining why.
- Using `List`, `Dict`, `Tuple`, `Set`, `Optional` from `typing` — use built-in generics and `|` syntax.
- Using `Union[X, None]` instead of `X | None`.
- Importing `TypeVar` and `Generic` for generics — use PEP 695 `[T]` syntax.
- Missing return type annotations on public functions.
- Missing parameter type annotations on public functions.

### Functions and classes

- Mutable default arguments: `def f(items: list = [])` — use `None` default.
- Using `dict` or `list` directly in `@dataclass` fields without `field(default_factory=...)`.
- God functions that do more than one thing — split them.
- `get_x` methods on classes where `@property` is cleaner.
- Deep inheritance hierarchies — prefer composition and `Protocol`.

### Imports

- Wildcard imports: `from module import *`.
- Shadowing built-ins: `list = []`, `id = "123"`.
- Circular imports caused by non-`TYPE_CHECKING` imports.

### Error handling

- Bare `except:` — always specify the exception type.
- Swallowing exceptions with an empty `except` block.
- Raising `Exception` instead of a specific subclass.
- Missing `from e` in re-raises — loses the original traceback.
- Using exceptions for normal control flow in hot code paths.

### Async

- `time.sleep()` in async code — use `await asyncio.sleep()`.
- Blocking I/O (sync DB calls, `open()`) inside async functions without `asyncio.to_thread()`.
- Calling `asyncio.run()` inside an async function.
- Marking a function `async` when it contains no `await`.
- Sequential `await` calls for independent operations — use `asyncio.gather()` or `TaskGroup`.

### Security

- `eval()` or `exec()` on user input.
- `subprocess.run(shell=True, ...)` with user input.
- `pickle.loads()` on untrusted data.
- `==` to compare secrets — use `hmac.compare_digest`.
- `random` for security-sensitive values — use `secrets`.
- `os.environ` access outside `config.py`.

### General

- `print()` instead of logging in production code.
- Hardcoded secrets or config values in source files.
- Committing `.env` files.
- Using `requirements.txt` as the primary dependency file — use `pyproject.toml`.
