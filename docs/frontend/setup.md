---
sidebar_position: 2
title: Setup
---

# Frontend setup

## Prerequisites

Complete [Installation](../getting-started/installation.md) first — the
frontend needs a generated Prisma client and a reachable database even to
render most pages.

## Run

```bash
cd apps/web
npm run dev        # Next.js with Turbopack on :3000
```

Turbopack is enabled via `next dev --turbo`. If you hit a bundler-specific
oddity, fall back with `npx next dev`.

## Environment

The browser only ever sees `NEXT_PUBLIC_*` variables:

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Absolute links, invite URLs |
| `NEXT_PUBLIC_WEB_SOCKET_URL` | Realtime connection |
| `NEXT_PUBLIC_LIVEKIT_URL` | Call media |

:::danger Never prefix a secret with `NEXT_PUBLIC_`
Anything so named is inlined into the client bundle and is public. Secrets
belong in server-only variables read inside route handlers.
:::

## Build

```bash
npm run build      # includes prisma generate
npm start          # serve the production build
```

## Styling

Tailwind, configured at `apps/web/tailwind.config.js`. Dark mode is
class-based and the app defaults to dark.

**Every color needs both variants.** This is the most common visual bug in the
codebase:

```tsx
// Wrong — invisible in dark mode
<p className="text-gray-400">Loading…</p>

// Right
<p className="text-gray-500 dark:text-gray-400">Loading…</p>
```

Check contrast in both themes before shipping. A `dark:` variant that is
*darker* than its base is a bug, not a style choice.

## Adding a page

1. Create `app/<route>/page.tsx`
2. Add `"use client"` only if the page needs hooks, state or events
3. Fetch server-side where possible; reach for `useEffect` only for
   client-only data
4. Wire navigation in the relevant sidebar or navbar component

## Adding a workspace board

The three graph boards share nearly all their machinery:

1. Add the board type to the `WorkspaceBoardType` enum in the Prisma schema
2. Create `app/workspace/[groupId]/<board>/` with a client component
3. Call `useWorkspaceBoard({ groupId, type, slug, userId })` — this gives
   load, save, sync, presence and cursors for free
4. Render `<WorkspaceCanvas>` with your own `nodeTypes`
5. Add the API route at `app/api/workspace/[groupId]/<slug>/`

Read [Workspace boards](../features/workspace-boards.md) before starting —
reusing the hook correctly is most of the work.
