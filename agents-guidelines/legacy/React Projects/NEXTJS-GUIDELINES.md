# Next.js Coding Guidelines

> These rules extend `react-rules.md`. **Both files apply to every Next.js project.** When a rule here conflicts with `react-rules.md`, this file wins — Next.js has the final say on Next.js-specific behaviour.
>
> Target: **Next.js App Router only.** Pages Router is not used. Do not generate Pages Router patterns (`getServerSideProps`, `getStaticProps`, `pages/` directory) under any circumstances.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Special Files Reference](#2-special-files-reference)
3. [Server Components vs Client Components](#3-server-components-vs-client-components)
4. [Data Fetching](#4-data-fetching)
5. [Server Actions](#5-server-actions)
6. [Caching & Revalidation](#6-caching--revalidation)
7. [Routing Rules](#7-routing-rules)
8. [Layouts & Templates](#8-layouts--templates)
9. [Metadata & SEO](#9-metadata--seo)
10. [Next.js Built-in Components](#10-nextjs-built-in-components)
11. [Environment Variables](#11-environment-variables)
12. [Route Handlers](#12-route-handlers)
13. [Middleware](#13-middleware)
14. [Anti-Patterns to Avoid](#14-anti-patterns-to-avoid)

---

## 1. Project Structure

All source files live inside `src/`. The `app/` directory contains **routes only** — page files, layouts, loading states, and error boundaries. Non-route code lives outside `app/`.

```
src/
├── app/                          # Routes only — App Router
│   ├── layout.tsx                # Root layout (required)
│   ├── page.tsx                  # Homepage route
│   ├── not-found.tsx             # Global 404
│   ├── error.tsx                 # Global error boundary
│   ├── sitemap.ts                # Auto-generates /sitemap.xml
│   ├── robots.ts                 # Auto-generates /robots.txt
│   ├── (marketing)/              # Route group — shared layout, no URL impact
│   │   ├── layout.tsx
│   │   ├── about/
│   │   │   └── page.tsx
│   │   └── blog/
│   │       ├── page.tsx
│   │       └── [slug]/
│   │           └── page.tsx
│   └── (app)/                    # Route group — authenticated section
│       ├── layout.tsx
│       └── dashboard/
│           ├── page.tsx
│           ├── loading.tsx
│           ├── error.tsx
│           └── _components/      # Private folder — route-specific components
│               └── DashboardChart.tsx
├── components/                   # Shared UI components (used by 2+ routes)
│   └── ui/
│       ├── Button.tsx
│       └── Modal.tsx
├── hooks/                        # Shared custom hooks
├── lib/                          # DB clients, SDK configs, third-party wrappers
│   ├── db.ts
│   └── queryClient.ts
├── services/                     # Plain async functions for external API calls
│   └── userService.ts
├── actions/                      # Server Actions (global — feature-scoped actions go in features/)
│   └── auth.ts
├── features/                     # Feature modules (same as react-rules.md)
│   └── auth/
│       ├── components/
│       ├── hooks/
│       ├── actions.ts            # Feature-scoped server actions
│       └── index.ts
├── types/                        # Global shared types
└── utils/                        # Global utility functions
```

### Key rules

- **`app/` is for routing only.** Do not put reusable components, hooks, or utilities directly inside `app/`. They go in `components/`, `hooks/`, `lib/`, etc.
- **Private folders (`_folder`)** inside `app/` are never treated as routes. Use `_components/` to colocate route-specific components next to their page without making them routable.
- **Route groups (`(folder)`)** organize routes and share layouts without affecting the URL. Use them to separate concerns (marketing vs. authenticated app, or just logical groupings).
- **Colocate first.** Route-specific components go in a `_components/` folder next to the route. Only move to shared `components/` when a second route needs them.
- **Max folder nesting: 3 levels** inside any route segment. Deeper nesting is a URL design problem, not a code organization solution.

---

## 2. Special Files Reference

These are the Next.js App Router reserved filenames. Every one of these is a Server Component by default unless explicitly marked with `'use client'`.

| File | Purpose |
|---|---|
| `layout.tsx` | Persistent UI wrapper. Wraps all child segments. Does not re-render on navigation. |
| `page.tsx` | The unique UI for a route. Makes the route publicly accessible. |
| `loading.tsx` | Suspense fallback shown while the page or its data loads. Wrapped automatically. |
| `error.tsx` | Error boundary for the segment. Must be a Client Component (`'use client'`). |
| `not-found.tsx` | UI shown when `notFound()` is called or a route doesn't exist. |
| `route.ts` | API Route Handler. No UI — returns a `Response`. |
| `middleware.ts` | Runs before every request. Lives at the root of `src/` (not inside `app/`). |
| `sitemap.ts` | Returns sitemap data. Next.js serves it at `/sitemap.xml`. |
| `robots.ts` | Returns robots rules. Next.js serves it at `/robots.txt`. |
| `opengraph-image.tsx` | Generates OG image for the route segment automatically. |

### Rules

- `error.tsx` **must** have `'use client'` at the top. It uses `useEffect` and `reset()` — both are client-only.
- `loading.tsx` is a static fallback, not a data-fetching component. Keep it simple: skeleton or spinner only.
- Never put business logic inside `layout.tsx`. Layouts are for structure (nav, sidebar, providers). Data fetching belongs in `page.tsx` or dedicated Server Components.
- Do not fetch data inside `loading.tsx`.

---

## 3. Server Components vs Client Components

This is the most important concept in the App Router. Getting it wrong bloats the client bundle and breaks functionality.

### The default

**All components in `app/` are Server Components by default.** You do not need to do anything to make a component a Server Component. Server Components run on the server only — their code never ships to the browser.

### When to use `'use client'`

Add `'use client'` at the top of a file only when the component needs one of these:

- `useState`, `useReducer`, `useEffect`, `useRef`, or any other stateful/lifecycle hook
- Browser APIs (`window`, `document`, `localStorage`, `navigator`)
- Event listeners (`onClick`, `onChange`, etc.)
- Third-party client-side libraries (animations, maps, rich text editors)

```tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Decision table

| Need | Use |
|---|---|
| Fetch data from DB / API | Server Component |
| Access environment secrets | Server Component |
| Render heavy static content, markdown | Server Component |
| Use `useState` / `useEffect` | Client Component |
| Handle user interaction (click, input) | Client Component |
| Use `localStorage` / `window` | Client Component |
| Animate elements | Client Component |

### Placement rules

- **Keep Client Components as leaf nodes.** Push `'use client'` as far down the tree as possible. A Client Component at the top of a tree turns the entire subtree into client-rendered code.
- **Never put `'use client'` on `page.tsx` or `layout.tsx`** unless the entire page is interactive with no server data. This is almost never correct.
- **Pass Server Component output to Client Components as props or `children`.** A Server Component can render a Client Component. A Client Component cannot render a Server Component directly — but it can receive one as `children`.

```tsx
// ✅ Correct — Server Component passes children to Client wrapper
// ServerPage.tsx (Server Component — no directive needed)
import { ClientShell } from './ClientShell';
import { getUser } from '@/lib/db';

export default async function Page() {
  const user = await getUser();
  return (
    <ClientShell>
      <UserProfile user={user} />  {/* This is a Server Component */}
    </ClientShell>
  );
}

// ClientShell.tsx
'use client';
import { useState } from 'react';

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return <div onClick={() => setIsOpen(!isOpen)}>{children}</div>;
}
```

- **`'use server'` is not the same as a Server Component.** `'use server'` marks a function as a Server Action (callable from client). It does not make a file a Server Component. Server Components need no directive at all.

---

## 4. Data Fetching

### Server Components (primary approach)

Fetch data directly inside async Server Components. This is the correct default.

```tsx
// app/dashboard/page.tsx
import { getUser } from '@/lib/db';

export default async function DashboardPage() {
  const user = await getUser(); // Direct DB/API call — no useEffect, no fetch hook
  return <div>{user.name}</div>;
}
```

### Rules

- **Fetch data in Server Components, not Client Components**, unless the data must be fetched client-side (user-triggered, real-time).
- **Fetch in parallel, not sequentially**, when multiple independent data requests are needed.
  ```tsx
  // ❌ Sequential — user waits for both to finish in series
  const user = await getUser(id);
  const posts = await getPosts(id);

  // ✅ Parallel — both start at the same time
  const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
  ```
- **Use `react.cache()`** to deduplicate data fetches that are called in multiple components during the same render.
  ```ts
  // lib/db.ts
  import { cache } from 'react';
  export const getUser = cache(async (id: string) => {
    return db.users.findUnique({ where: { id } });
  });
  ```
- **Add `import 'server-only'`** to any file that must never run on the client (DB access, secrets usage). This throws a build-time error if accidentally imported into a Client Component.
  ```ts
  // lib/db.ts
  import 'server-only';
  // ... database access
  ```

### Client-side data fetching

Use TanStack Query for client-side fetching (user-triggered loads, paginated lists, real-time polling).

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';

export function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage />;
  return <List items={data} />;
}
```

- Do not use `useEffect` + `fetch` for data fetching in Client Components. Use TanStack Query.
- Do not duplicate data that was already fetched server-side into client state. Pass it down as props.

---

## 5. Server Actions

Server Actions are async functions that run on the server, callable from Client Components or forms. They replace manual API routes for mutations.

### Defining Server Actions

Prefer defining Server Actions in dedicated files, not inline in components.

```ts
// features/auth/actions.ts
'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import 'server-only';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;

  // 1. Validate input
  if (!title || title.length < 3) {
    return { error: 'Title must be at least 3 characters' };
  }

  // 2. Authenticate / authorize before touching data
  const user = await requireUser(); // throws redirect if unauthenticated

  // 3. Mutate
  await db.posts.create({ data: { title, userId: user.id } });

  // 4. Invalidate cache
  revalidateTag('posts');

  // 5. Redirect (outside try/catch — redirect throws internally)
  redirect('/dashboard');
}
```

### Rules

- **Always validate input in a Server Action.** Never trust `FormData` values without checking type and length.
- **Always authenticate before mutating data.** Do not rely on UI-level auth guards alone. Verify the session inside the action.
- **Return errors as data, not thrown exceptions**, so the Client Component can display them.
  ```ts
  // ✅
  return { error: 'Invalid input' };

  // ❌ — unhandled throw crashes silently on the client
  throw new Error('Invalid input');
  ```
- **Call `redirect()` outside of `try/catch`.** `redirect()` works by throwing internally — wrapping it in `try/catch` swallows it.
- **Use `revalidateTag` over `revalidatePath`** for cache invalidation. Tag-based invalidation is more precise and avoids busting unrelated cached routes.
- Server Actions are `POST` requests internally. Do not use them for data fetching. Use them for mutations only.
- Define feature-scoped Server Actions in `features/<name>/actions.ts`. Define global actions in `src/actions/`.

---

## 6. Caching & Revalidation

### Rendering strategy decision table

| Data type | Strategy | Config |
|---|---|---|
| Never changes (static content) | Static (SSG) | Default — no config needed |
| Changes occasionally | ISR | `export const revalidate = 60` (seconds) |
| Changes on every request | Dynamic (SSR) | `export const dynamic = 'force-dynamic'` |
| Mixed (mostly static, some dynamic parts) | Use `<Suspense>` to isolate dynamic sections | No page-level config |

### Rules

- **Do not set `export const dynamic = 'force-dynamic'` as the default** on every page. This disables all caching and makes every page a full SSR render. Use it only when data must be live on every request.
- **Tag every cacheable fetch** so Server Actions can invalidate it precisely.
  ```ts
  const data = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'], revalidate: 3600 },
  });
  ```
- **Use `unstable_cache`** (or the `'use cache'` directive in Next.js 15+) for caching database query results that don't go through `fetch`.
  ```ts
  import { unstable_cache } from 'next/cache';

  export const getCachedPosts = unstable_cache(
    async () => db.posts.findMany(),
    ['posts'],
    { tags: ['posts'], revalidate: 3600 }
  );
  ```
- **Do not read `cookies()` or `headers()` inside `layout.tsx`** unless necessary. It forces the entire route into dynamic rendering, bypassing all caching.
- **Wrap dynamic sections in `<Suspense>`** to allow the rest of the page to be statically rendered while only the dynamic part streams.

---

## 7. Routing Rules

### Dynamic routes

```
app/blog/[slug]/page.tsx       → /blog/my-post
app/shop/[...slug]/page.tsx    → /shop/a/b/c (catch-all)
app/shop/[[...slug]]/page.tsx  → /shop or /shop/a/b/c (optional catch-all)
```

### Rules

- **`params` and `searchParams` are now Promises in Next.js 15.** Always `await` them.
  ```tsx
  // app/blog/[slug]/page.tsx
  export default async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ page?: string }>;
  }) {
    const { slug } = await params;
    const { page } = await searchParams;
    // ...
  }
  ```
- **Generate static params for dynamic routes** that have a known, finite set of values (e.g., blog posts, product pages). This pre-renders them at build time.
  ```tsx
  export async function generateStaticParams() {
    const posts = await getPosts();
    return posts.map(post => ({ slug: post.slug }));
  }
  ```
- **Call `notFound()`** when a dynamic route resolves to no data. Do not render a blank page.
  ```tsx
  const post = await getPost(slug);
  if (!post) notFound();
  ```
- **Use `redirect()`** for server-side redirects (auth guards, deprecated URLs). Call it outside `try/catch`.
- **Never use `<a>` for internal navigation.** Always use `<Link>` from `next/link`.

---

## 8. Layouts & Templates

### Layouts

- The root `app/layout.tsx` must render `<html>` and `<body>` tags. This is the only place they should appear.
- Layouts persist across navigations within their segment. State inside a layout is preserved.
- **Do not fetch per-user or per-request data inside `layout.tsx`** unless you intentionally accept that it forces dynamic rendering for the entire subtree.
- Wrap providers (TanStack Query, theme, auth context) in the root layout. Create a dedicated `Providers.tsx` Client Component for this — do not make the root layout a Client Component.

```tsx
// app/layout.tsx — stays a Server Component
import { Providers } from './Providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// app/Providers.tsx
'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Templates

Use `template.tsx` instead of `layout.tsx` only when you explicitly need the layout to **re-mount** on every navigation (e.g., page-enter animations, resetting form state between routes). It creates a new instance on each navigation, unlike layouts.

---

## 9. Metadata & SEO

### Static metadata

Use the exported `metadata` object for pages with fixed metadata.

```tsx
// app/about/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about our company and mission.',
};

export default function AboutPage() { ... }
```

### Dynamic metadata

Use `generateMetadata` when metadata depends on route params or fetched data.

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      images: [post.coverImage],
    },
  };
}
```

### Root layout metadata (required)

The root layout must define `metadataBase` and a `title.template`. Without `metadataBase`, relative Open Graph image URLs will be broken in production.

```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://yourdomain.com'),
  title: {
    template: '%s | Your App Name',
    default: 'Your App Name',
  },
  description: 'Default site description.',
};
```

### Rules

- Every `page.tsx` must export either `metadata` or `generateMetadata`. No page should rely solely on the root layout's default title.
- Use `metadata` (static) for pages whose title and description don't change. Use `generateMetadata` only when you need route params or fetched data — it adds server overhead.
- **Never export both `metadata` and `generateMetadata`** from the same file.
- `metadata` exports work in Server Components only. Client Components cannot export metadata — add a `layout.tsx` above them if needed.
- Always set `openGraph.images` with explicit `width`, `height`, and `alt`. The recommended OG image size is `1200x630`.
- Add `sitemap.ts` and `robots.ts` to `app/`. Next.js serves them automatically at `/sitemap.xml` and `/robots.txt`.

---

## 10. Next.js Built-in Components

### `<Image>` (`next/image`)

**Always use `<Image>` instead of `<img>` for any image that is not purely decorative.** `<Image>` handles lazy loading, format optimization (WebP/AVIF), and responsive sizing automatically.

```tsx
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero banner showing our product"  // Never empty for meaningful images
  width={1200}
  height={600}
  priority           // Add for above-the-fold images (LCP element)
  placeholder="blur" // Add when you have a blurDataURL
/>
```

Rules:
- Always provide `alt`. Empty `alt=""` is only acceptable for purely decorative images.
- Add `priority` prop to the largest above-the-fold image on each page. This disables lazy loading for that image, improving LCP.
- Never use `<img>` directly for local or external images. The only exception is SVG icons inlined as React components.
- Configure `images.remotePatterns` in `next.config.ts` for every external image domain. Never use `images.domains` (deprecated).

```ts
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        pathname: '/images/**',
      },
    ],
  },
};
```

### `<Link>` (`next/link`)

**Always use `<Link>` for internal navigation.** Never use `<a href>` for links within the app.

```tsx
import Link from 'next/link';

<Link href="/dashboard">Dashboard</Link>

// With prefetch disabled (useful for rarely visited links)
<Link href="/settings" prefetch={false}>Settings</Link>
```

Rules:
- Do not nest `<a>` inside `<Link>`. `<Link>` renders an `<a>` tag automatically.
- Use `useRouter()` from `next/navigation` (not `next/router`) for programmatic navigation in Client Components.
- Use `redirect()` from `next/navigation` for server-side redirects in Server Components and Server Actions.

### `<Script>` (`next/script`)

Use `<Script>` for any third-party script tags. Never use a raw `<script>` in JSX.

```tsx
import Script from 'next/script';

<Script
  src="https://analytics.example.com/script.js"
  strategy="lazyOnload"  // 'beforeInteractive' | 'afterInteractive' | 'lazyOnload'
/>
```

### Fonts (`next/font`)

Use `next/font` for all font loading. Never import fonts via a `<link>` tag in the HTML.

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

---

## 11. Environment Variables

### Rules

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser bundle. Everything else is server-only.
- **Never prefix secret keys, API tokens, or database URLs with `NEXT_PUBLIC_`.** They will be visible in the client bundle.
- Access `process.env.VARIABLE_NAME` only at the top level of a file or inside a function — never inside a component's render logic directly. Centralise env access in `lib/config.ts`.

```ts
// lib/config.ts
import 'server-only';

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  stripeSecret: process.env.STRIPE_SECRET_KEY!,
};
```

- Always validate required environment variables at startup. A missing variable should crash at build/start time, not silently at runtime.
- Maintain separate `.env.local` (local dev), `.env.production` (production), and `.env.example` (committed template with no real values) files.
- Never commit `.env.local` or `.env.production` to version control.

---

## 12. Route Handlers

Route Handlers (`route.ts`) replace Express-style API routes. Use them when you need a proper HTTP endpoint — for webhooks, third-party integrations, or public APIs that must support `GET`.

```ts
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const posts = await getPosts();
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // validate, authenticate, mutate
  return NextResponse.json({ success: true }, { status: 201 });
}
```

### Rules

- **Prefer Server Actions over Route Handlers for mutations** triggered from your own UI. Route Handlers are for external consumers (webhooks, mobile clients, public APIs).
- Always validate the request body. Never pass raw `request.json()` output to the database.
- Always authenticate in Route Handlers that access private data. Do not assume the caller is authenticated.
- Export only the HTTP methods your endpoint supports. Next.js returns 405 automatically for unsupported methods.
- Route Handlers and `page.tsx` cannot coexist in the same route segment.
- Name the file `route.ts`, never `api.ts` or `handler.ts`.

---

## 13. Middleware

Middleware runs before every matched request, at the Edge. It is for cross-cutting concerns only.

```ts
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
```

### Rules

- **Always define a `matcher`** in the exported `config`. Without it, middleware runs on every request including static files and API routes.
- Middleware runs in the Edge runtime — no Node.js APIs. No `fs`, no native modules, no Prisma.
- Keep middleware fast and thin. Heavy logic (DB calls, complex auth) belongs in Server Components or Route Handlers, not middleware.
- Use middleware for: session checks and redirects, A/B testing flags, locale detection, bot blocking.
- Do not use middleware for: data fetching, response body transformation, business logic.

---

## 14. Anti-Patterns to Avoid

### Server / Client boundary mistakes

- Adding `'use client'` to `layout.tsx` or `page.tsx` to avoid thinking about the boundary. Fix the component tree instead.
- Putting `'use client'` high in the tree because a leaf component needs `useState`. Move the `useState` to the leaf only.
- Importing a Server Component inside a Client Component directly (renders on client, losing server benefits). Pass it as `children` instead.
- Using `'use server'` inside a Client Component file to define a Server Action inline. Put it in a dedicated `actions.ts` file.
- Accessing `process.env.SECRET_KEY` in a Client Component. It becomes `undefined` at runtime and was never secret.

### Data fetching mistakes

- Using `useEffect` + `fetch` in a Client Component for data that could be fetched in a Server Component.
- Fetching the same data in both a Server Component and a Client Component (duplicated requests, inconsistent state).
- Calling two `await` data fetches in sequence when they are independent — always use `Promise.all`.
- Reading `cookies()` or `headers()` inside `layout.tsx` without realising it opts the whole route out of caching.

### Routing mistakes

- Using `<a href>` for internal links. Use `<Link>` from `next/link`.
- Using `next/router` in the App Router. Use `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`).
- Not `await`-ing `params` or `searchParams` in Next.js 15+. They are Promises, not plain objects.
- Not calling `notFound()` when a dynamic route has no matching data — results in an empty page that returns HTTP 200.
- Calling `redirect()` inside a `try/catch` block — it silently fails because `redirect` works by throwing.

### Image / asset mistakes

- Using `<img>` instead of `<Image>` — misses optimization, lazy loading, and responsive sizing.
- Missing the `priority` prop on the page's main hero image — degrades LCP score.
- Using `images.domains` in `next.config.ts` (deprecated) instead of `images.remotePatterns`.
- Empty or missing `alt` on meaningful images.

### Metadata mistakes

- Not setting `metadataBase` in the root layout — breaks all relative Open Graph image URLs in production.
- Every page inheriting the root layout's default title with no page-specific override.
- Exporting `metadata` from a Client Component — it is silently ignored.
- Using `generateMetadata` on static pages that don't need route params — unnecessary server overhead.

### Caching mistakes

- Setting `export const dynamic = 'force-dynamic'` on every page as a default to avoid thinking about caching.
- Using `revalidatePath('/')` to invalidate everything after a mutation — busts all caches including unrelated pages.
- Not tagging `fetch` requests, making precise cache invalidation impossible.
- Calling mutable database operations inside a `GET` Route Handler (caching may replay them).
