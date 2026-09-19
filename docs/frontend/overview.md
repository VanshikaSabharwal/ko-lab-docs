---
sidebar_position: 1
title: Overview
---

# Frontend

## Description

`apps/web` is a **Next.js 14 App Router** application in TypeScript. It serves
both the UI and the REST API — the [Backend](../backend/overview.md) section
covers the API half; this section covers what runs in the browser.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18.3.1 |
| Styling | Tailwind CSS, dark mode by class |
| Canvas | `@xyflow/react` 12 (React Flow) |
| Editor | CodeMirror 6 with per-language modes |
| Realtime | Native `WebSocket` via custom hooks |
| Calls | `livekit-client` + `@livekit/components-react` |
| Auth | NextAuth v4 |
| Notifications | `react-hot-toast` |
| Onboarding | Shepherd.js guided tours |
| Animation | Framer Motion |

:::note React 18 is pinned
The root `package.json` has `overrides` forcing `react` and `react-dom` to
`18.3.1` across every workspace. Adding a dependency that needs React 19 will
not work without lifting that pin.
:::

## Route map

Under `apps/web/app/`:

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/signin`, `/signup`, `/auth/*` | Authentication |
| `/groups`, `/create-group`, `/group/[groupId]` | Group list, creation, chat |
| `/addGroupMember/[id]`, `/viewMembers/[groupId]` | Membership management |
| `/chat`, `/chat-room`, `/chat/[chatId]` | Direct messages |
| `/workspace/[groupId]` | Workspace hub |
| `/workspace/[groupId]/ui-design` | UI design canvas |
| `/workspace/[groupId]/mind-map` | Mind map |
| `/workspace/[groupId]/db-schema` | Schema designer |
| `/workspace/[groupId]/planning` | Kanban, workflow, milestones |
| `/code-editor/[groupId]/[githubRepo]` | In-browser IDE |
| `/confirm-changes/[groupId]` | Change-request review |
| `/github` | Repo linking |
| `/join/[token]` | Invite-link join |
| `/notifications` | Notification centre |
| `/bugs` | Bug reports |
| `/profile` | Profile and connected accounts |
| `/friend-search` | User lookup by phone |

## Directory conventions

```
apps/web/app/
├── components/          # Shared UI
│   ├── call/            # Call surface
│   └── bug/             # Bug report widget
├── lib/                 # 22 cross-cutting modules
│   ├── prisma.ts        # DB client singleton
│   ├── encryption.ts    # AES-256-CBC for GitHub tokens
│   ├── wsToken.ts       # HMAC WS tokens
│   ├── livekit.ts       # Call token minting
│   ├── s3.ts            # Object storage
│   └── vcs.ts           # Branch/diff/merge helpers
├── workspace/
│   ├── components/      # Canvas shell, cursors, presence
│   └── lib/             # Board hooks and pure helpers
└── api/                 # Route handlers → Backend section
```

Feature-local components live beside their route; only genuinely shared ones
go in `app/components/`.

:::tip `packages/ui` is mostly unused
The monorepo has a `packages/ui` workspace, but the app keeps its components
in `app/components/`. Do not assume shared components live there.
:::

## Realtime in the browser

Boards and chat both talk to the WebSocket service through hooks:

- `app/workspace/lib/useWorkspaceSocket.ts` — connection, auth, reconnect
- `app/workspace/lib/useWorkspaceBoard.ts` — board state, op broadcast, persistence

The board hook is the one to read first: it owns optimistic local updates,
throttled broadcast, and debounced saves. See
[Workspace boards](../features/workspace-boards.md) for a walk through its
internals.

## Next

- **[Setup](./setup.md)** — run the frontend alone
- **[Testing](./testing.md)** — component tests and manual checks
