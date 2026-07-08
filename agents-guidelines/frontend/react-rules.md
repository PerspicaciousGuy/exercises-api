# React Coding Guidelines

<!-- meta
target: React 19.x
last_reviewed: 2026-06
sources: react.dev
extends: typescript-rules.md
-->

> These rules define how React code must be written in this project. Every rule applies unless explicitly overridden per-task. When in doubt, follow these rules exactly as written.

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Project Structure](#2-project-structure)
3. [Component Rules](#3-component-rules)
4. [Naming Conventions](#4-naming-conventions)
5. [TypeScript Usage](#5-typescript-usage)
6. [Hooks Rules](#6-hooks-rules)
7. [State Management](#7-state-management)
8. [Props](#8-props)
9. [Performance](#9-performance)
10. [Styling](#10-styling)
11. [File Size & Splitting](#11-file-size--splitting)
12. [Import Order](#12-import-order)
13. [Error Handling](#13-error-handling)
14. [Testing Expectations](#14-testing-expectations)
15. [Anti-Patterns to Avoid](#15-anti-patterns-to-avoid)

---

## 1. Core Principles

These are non-negotiable, apply to every file.

- **Functional components only.** No class components. No exceptions.
- **TypeScript is required.** No `.jsx` files. Every component file uses `.tsx`, every utility uses `.ts`.
- **Strict mode is on.** `"strict": true` must be set in `tsconfig.json`.
- **One component per file.** A file exports one primary component. Small sub-components used only in that file may live in the same file but must be placed above the main component.
- **No implicit any.** Never use `any` unless wrapping a third-party library with no types. If you do, add a comment explaining why.
- **Keep components pure.** Components must not produce side effects during render. Side effects belong in `useEffect` or event handlers only.

---

## 2. Project Structure

Use a **feature-based structure with colocation**. Related files (component, hook, types, styles, tests) live together in the same folder.

```
src/
├── app/                    # App entry, providers, global layout
│   ├── App.tsx
│   ├── main.tsx
│   └── providers.tsx
├── features/               # Feature modules (primary unit of organization)
│   └── auth/
│       ├── components/     # Components used only by this feature
│       │   └── LoginForm.tsx
│       ├── hooks/          # Hooks used only by this feature
│       │   └── useLogin.ts
│       ├── types.ts        # Types scoped to this feature
│       ├── utils.ts        # Utilities scoped to this feature
│       └── index.ts        # Public API — only export what other features need
├── components/             # Truly shared, reusable UI components
│   └── ui/
│       ├── Button.tsx
│       └── Modal.tsx
├── hooks/                  # Shared custom hooks (used by 2+ features)
│   └── useDebounce.ts
├── lib/                    # Third-party wrappers, SDK configs, API clients
│   └── queryClient.ts
├── services/               # API call functions (not hooks, pure async functions)
│   └── userService.ts
├── types/                  # Global shared types
│   └── index.ts
├── utils/                  # Global shared utility functions
│   └── formatDate.ts
└── assets/                 # Static files
```

### Rules

- **Colocate first, extract later.** Start with files inside the feature folder. Move to a shared folder only when a second feature needs it.
- **Max nesting depth: 3 levels** inside any folder. Deeper nesting is a signal to refactor.
- **Feature `index.ts` controls exports.** Other features must import from `features/auth/index.ts`, never from internal paths like `features/auth/components/LoginForm`.
- **No barrel files in `components/ui/`.** Import directly from the file. Barrel files in `ui/` cause large bundle size issues.
- **`services/` holds plain async functions, not hooks.** Data-fetching hooks live in `hooks/` or inside a feature's `hooks/` folder.

---

## 3. Component Rules

### Structure of a component file

Follow this order inside every component file:

```tsx
// 1. Imports
import { useState } from 'react';
import type { UserCardProps } from './types';

// 2. Types (if not in a separate types.ts)
// (only small, local types here)

// 3. Constants (if used only in this component)
const MAX_NAME_LENGTH = 50;

// 4. Sub-components (only if used exclusively in this file)
function UserAvatar({ src }: { src: string }) {
  return <img src={src} alt="avatar" className="rounded-full w-8 h-8" />;
}

// 5. Main component (always default exported)
export default function UserCard({ user, onEdit }: UserCardProps) {
  // hooks at the top
  const [isEditing, setIsEditing] = useState(false);

  // derived values / computed
  const displayName = user.name.slice(0, MAX_NAME_LENGTH);

  // event handlers
  function handleEditClick() {
    setIsEditing(true);
    onEdit?.(user.id);
  }

  // render
  return (
    <div>
      <UserAvatar src={user.avatar} />
      <p>{displayName}</p>
      <button onClick={handleEditClick}>Edit</button>
    </div>
  );
}
```

### Export rules

- Default export for the main component.
- Named exports for types and utilities from that file, if any.
- Never export a component both as default and named from the same file.

### JSX rules

- Always self-close tags with no children: `<Input />` not `<Input></Input>`.
- Wrap multi-line JSX in parentheses.
- Do not use ternary inside JSX for complex conditions. Extract into a variable above the return.
- Use `&&` for conditional rendering only when the left side is always boolean. Use explicit `condition ? <A /> : null` otherwise to avoid rendering `0`.

```tsx
// ❌ Renders "0" if items.length is 0
{items.length && <List items={items} />}

// ✅ Safe
{items.length > 0 && <List items={items} />}

// ✅ Also safe
{items.length > 0 ? <List items={items} /> : null}
```

---

## 4. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Component | PascalCase | `UserCard`, `LoginForm` |
| Component file | PascalCase | `UserCard.tsx` |
| Hook | camelCase, `use` prefix | `useUserData`, `useToggle` |
| Hook file | camelCase | `useUserData.ts` |
| Utility function | camelCase | `formatDate`, `truncateText` |
| Utility file | camelCase | `formatDate.ts` |
| TypeScript interface | PascalCase | `UserCardProps`, `AuthState` |
| TypeScript type | PascalCase | `ButtonVariant`, `ApiResponse` |
| Boolean state/prop | `is`, `has`, `should` prefix | `isLoading`, `hasError`, `shouldRender` |
| Event handler (internal) | `handle` prefix | `handleClick`, `handleSubmit` |
| Event handler (prop) | `on` prefix | `onClick`, `onSubmit`, `onUserDelete` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| Enum name | PascalCase | `UserRole` |
| Enum values | UPPER_SNAKE_CASE | `UserRole.ADMIN`, `UserRole.GUEST` |

### File naming

- Component files: `PascalCase.tsx` — `UserCard.tsx`
- All other files: `camelCase.ts` — `useUserData.ts`, `formatDate.ts`
- Test files: same name as the file under test, with `.test` — `UserCard.test.tsx`
- Type files: `types.ts` or `featureName.types.ts`

---

## 5. TypeScript Usage

### Props

Always define props as an `interface`. Use `type` only for union types or computed types.

```tsx
// ✅ Interface for props
interface UserCardProps {
  user: User;
  variant?: 'compact' | 'detailed';
  onEdit?: (userId: string) => void;
}

// ✅ Type for unions
type ButtonVariant = 'primary' | 'secondary' | 'ghost';
```

### Rules

- Never use `React.FC`. It adds implicit `children` and hides the return type. Define the function directly.
  ```tsx
  // ❌
  const Button: React.FC<ButtonProps> = ({ label }) => { ... };

  // ✅
  function Button({ label }: ButtonProps) { ... }
  ```
- Always type event handlers explicitly.
  ```tsx
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
  }
  ```
- Use `unknown` over `any` for untyped external data. Narrow the type before use.
- Use discriminated unions for component variants with different prop shapes.
  ```tsx
  type ButtonProps =
    | { variant: 'icon'; icon: React.ReactNode; label?: string }
    | { variant: 'text'; label: string; icon?: never };
  ```
- Prefer `interface` extension over `type` intersection for extending component props.
  ```tsx
  interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
  }
  ```
- Do not re-export types through barrel files unless they are part of a public feature API.

### tsconfig requirements

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

---

## 6. Hooks Rules

### Hard rules (never violate)

- Only call hooks at the top level. Never inside loops, conditions, or nested functions.
- Only call hooks from React function components or other custom hooks.
- A function that does not call any hooks must **not** be prefixed with `use`. Prefix it with something meaningful (`get`, `format`, `calculate`, etc.).
- If a function starts with `use`, it must call at least one hook internally.

### `useState`

- Use separate `useState` calls for unrelated state. Use `useReducer` when multiple pieces of state change together.
- Initialize state lazily with a function when the initial value is expensive to compute:
  ```tsx
  // ✅ Only runs once
  const [state, setState] = useState(() => JSON.parse(localStorage.getItem('key') ?? 'null'));
  ```
- Never store derived values in state. Compute them directly from existing state/props.
  ```tsx
  // ❌
  const [fullName, setFullName] = useState(`${firstName} ${lastName}`);

  // ✅
  const fullName = `${firstName} ${lastName}`;
  ```

### `useEffect`

- `useEffect` is for syncing with external systems only (DOM APIs, subscriptions, browser APIs, third-party libraries). It is not for transforming data or reacting to user events.
- Always include all reactive values in the dependency array. Use the ESLint `exhaustive-deps` rule — do not suppress it.
- Always return a cleanup function when subscribing to events or timers.
  ```tsx
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [userId]);
  ```
- Never pass an async function directly to `useEffect`. Define the async function inside and call it.
  ```tsx
  // ❌
  useEffect(async () => { ... }, []);

  // ✅
  useEffect(() => {
    async function load() { ... }
    load();
  }, []);
  ```
- Split multiple unrelated effects into separate `useEffect` calls.

### `useCallback` and `useMemo`

- Do not apply these by default. Only add them when there is a measured performance problem or a stable reference is explicitly required (e.g., a function passed to a memoized child, a dependency of another hook).
- If React Compiler is enabled in your project, do not add manual `useCallback` / `useMemo` — the compiler handles this automatically.

### `useRef`

- Use `useRef` for values that should persist across renders but do not trigger a re-render when changed (e.g., timer IDs, previous values, DOM references).
- Do not use `useRef` as a replacement for state when the value affects the UI.

### Custom hooks

- Extract logic into a custom hook when the same stateful logic appears in two or more components.
- Custom hooks return values, not JSX. If it returns JSX, it's a component.
- Custom hook files go in `hooks/` at the feature or project level depending on scope.

---

## 7. State Management

### Decision rules

Use the simplest tool that covers the requirement:

| Scenario | Tool |
|---|---|
| Local UI state (open/closed, form input) | `useState` |
| Complex state with multiple sub-values that update together | `useReducer` |
| Shared state across a small subtree (theme, locale, current user) | React Context + `useContext` |
| Server/async state (fetching, caching, mutations) | TanStack Query |
| Global client-side state shared across many unrelated components | Zustand |

### Rules

- **Do not reach for a global state library for server data.** TanStack Query handles fetch, cache, loading states, and refetching. Do not duplicate this into Zustand or Context.
- **Context is not a state manager.** It does not batch updates. Use it for values that change infrequently (auth user, theme, locale). Avoid putting frequently changing values in Context.
- **Keep Zustand stores focused.** One store per domain (auth store, cart store). Do not put everything in one store.
- **Co-locate state as low as possible.** Lift state up only when two components genuinely share it. Do not hoist state to a global store preemptively.

---

## 8. Props

### General rules

- Destructure props in the function signature, not inside the function body.
  ```tsx
  // ✅
  function Card({ title, description, onClick }: CardProps) { ... }

  // ❌
  function Card(props: CardProps) {
    const { title, description } = props;
  }
  ```
- When a component has more than 3 props, place each prop on its own line in JSX.
  ```tsx
  // ✅
  <UserCard
    user={user}
    variant="compact"
    onEdit={handleEdit}
    isHighlighted={false}
  />
  ```
- Do not spread unknown props onto DOM elements. This causes unknown HTML attribute warnings and hides bugs.
  ```tsx
  // ❌
  function Button({ children, ...rest }: ButtonProps) {
    return <button {...rest}>{children}</button>;
  }

  // ✅ — Spread only known HTML attributes
  function Button({ children, onClick, disabled, type = 'button' }: ButtonProps) {
    return <button type={type} onClick={onClick} disabled={disabled}>{children}</button>;
  }
  ```
  Exception: explicit extension of native HTML element props via `React.HTMLAttributes` or `React.ButtonHTMLAttributes` is allowed.
- Set default values in the function signature, not via `defaultProps`. `defaultProps` is deprecated for function components.
- Never pass a new object or array literal as a prop inline if that prop feeds into a `useEffect` or `useMemo` dependency array — it creates a new reference on every render.

### Prop drilling

- Prop drilling up to 2 levels is acceptable.
- At 3 levels, evaluate whether Context or a state manager is more appropriate.
- Never pass props through a component that does not use them just to get data to a child. This is a sign the architecture needs rethinking.

---

## 9. Performance

### Do not optimize prematurely

Profile first. The React DevTools Profiler shows what is actually slow. Do not add memoization "just in case."

### `React.memo`

- Wrap a component in `React.memo` only when it renders frequently and its parent re-renders often with the same props.
- Verify the optimization works — `React.memo` does a shallow comparison of props. If a prop is a new object or function on every parent render, `React.memo` does nothing without stable references.

### Code splitting

- Use `React.lazy` and `Suspense` for route-level code splitting as the baseline.
  ```tsx
  const SettingsPage = React.lazy(() => import('./features/settings/SettingsPage'));

  function App() {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <SettingsPage />
      </Suspense>
    );
  }
  ```
- Do not lazy-load components that are needed on initial paint.

### Lists

- Every item in a list rendered with `.map()` must have a stable, unique `key` prop.
- Never use array index as `key` if the list can be reordered or filtered. Use a stable ID from the data.

### Avoid

- Anonymous functions as props to memoized children (creates new reference every render).
- Large component trees with single, high-frequency state at the top (causes the whole tree to re-render). Move fast-changing state as low as possible.
- Fetching data in a component that renders many children. Fetch at the route/page level and pass data down.

---

## 10. Styling

The default styling approach for this project must be specified per project. The rules below apply regardless of the styling solution chosen.

### General rules

- No inline styles except for values that are genuinely dynamic and cannot be expressed as a class (e.g., a pixel position calculated at runtime).
  ```tsx
  // ❌
  <div style={{ color: 'red', fontSize: '14px' }} />

  // ✅ — only for truly dynamic values
  <div style={{ transform: `translateX(${offsetPx}px)` }} />
  ```
- Do not mix styling approaches. Pick one per project and stick to it. (CSS Modules, Tailwind, CSS-in-JS — not all three at once.)
- Styling constants (colors, spacing, breakpoints) must be defined in a single config file, not scattered as raw values throughout components.

### If using Tailwind CSS

- Use design tokens from `tailwind.config.ts`. Do not write raw pixel values as arbitrary Tailwind values (`[14px]`) unless there is no equivalent token.
- Group utility classes logically in JSX: layout → spacing → sizing → typography → colors → state variants.
- Extract repeated class combinations into a component, not a custom CSS class.

### If using CSS Modules

- File name matches the component: `UserCard.module.css` for `UserCard.tsx`.
- Class names in kebab-case: `.user-avatar`, `.edit-button`.

---

## 11. File Size & Splitting

- **Soft limit: 200 lines per file.** Above this, actively look for extraction opportunities.
- **Hard limit: 400 lines per file.** If a file exceeds this, it must be split before the task is considered done.
- **Split by responsibility**, not by line count alone. Ask: does this file do more than one thing? If yes, split.
- A component over 150 lines of JSX is a strong signal it needs to be broken into smaller components.
- Types that are used in more than one file must be moved to `types.ts`.

---

## 12. Import Order

Follow this order, with a blank line between each group:

```tsx
// 1. React (always first)
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

// 3. Internal absolute imports (aliases, e.g. @/components)
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

// 4. Relative imports (sibling or local files)
import { UserAvatar } from './UserAvatar';
import type { UserCardProps } from './types';

// 5. Assets
import avatarFallback from './avatar-fallback.png';
```

Use an ESLint import order plugin (`eslint-plugin-import` or `eslint-plugin-perfectionist`) to enforce this automatically.

---

## 13. Error Handling

### Component-level errors

- Wrap route-level or section-level components in an Error Boundary.
- Never let an unhandled render error crash the entire application.
- Error Boundaries must display a meaningful fallback, not just a blank screen.

```tsx
// ErrorBoundary.tsx — class component is required by React for error boundaries
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to error monitoring (e.g. Sentry)
    logError(error, info);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

### Async / data errors

- Handle loading, error, and empty states explicitly. Do not assume data always loads successfully.
  ```tsx
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage message={error.message} />;
  if (!data || data.length === 0) return <EmptyState />;
  return <DataList items={data} />;
  ```
- Never silently swallow errors. At minimum, log them.
- Do not show raw error messages from the server directly to the user.

---

## 14. Testing Expectations

- Tests live next to the file they test: `UserCard.test.tsx` beside `UserCard.tsx`.
- Use React Testing Library. Do not test implementation details (component state, internal methods). Test what the user sees and does.
- Every custom hook must have a test using `renderHook` from `@testing-library/react`.
- Test IDs (`data-testid`) are last resort. Prefer accessible queries: `getByRole`, `getByLabelText`, `getByText`.
- Minimum coverage per new feature: critical user flows (form submit, auth gate, error state).

---

## 15. Anti-Patterns to Avoid

The following patterns are banned. If you see them, fix them.

**State and effects**

- Using `useEffect` to sync two pieces of React state. Compute derived values directly instead.
- Calling `setState` inside `useEffect` with no dependency array — infinite loop.
- Using `useEffect` to respond to user events. Use event handlers for that.
- Multiple `useEffect` calls that depend on the same value — merge or rethink.
- Forgetting cleanup for event listeners, timers, and subscriptions in `useEffect`.

**Components**

- Class components anywhere in new code.
- Index files that re-export every component in a folder (deep barrel files inside `ui/`).
- Components that fetch data, manage global state, and handle display logic all at once. Separate concerns.
- Rendering a component inside another component's function body (re-creates the component on every render, losing state):
  ```tsx
  // ❌ — Inner is redefined and remounted every time Outer renders
  function Outer() {
    function Inner() { return <div />; }
    return <Inner />;
  }

  // ✅
  function Inner() { return <div />; }
  function Outer() { return <Inner />; }
  ```

**TypeScript**

- Using `any` without a comment explaining why.
- Casting with `as` to silence a type error without understanding the root cause.
- `@ts-ignore` anywhere. Use `@ts-expect-error` with a comment if suppression is truly unavoidable.

**Props**

- Passing props through 3+ components that don't use them (prop drilling). Use Context or state management.
- Using array index as `key` in a list that can be filtered or reordered.
- Prop names that don't match their purpose (`data`, `info`, `stuff`, `obj`). Names must be descriptive.

**Performance**

- Calling `JSON.parse` or `JSON.stringify` inside a render without memoization.
- Creating new object or array literals as default prop values at the module level when used in dependency arrays.
- Importing an entire library when only one function is needed (`import _ from 'lodash'` instead of `import debounce from 'lodash/debounce'`).
