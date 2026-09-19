---
sidebar_position: 1
title: Overview
---

# WebSocket service

## Description

`apps/web-socket` is a standalone Node service on port **8080**. It is two
things in one process:

1. **A realtime hub** — WebSocket at `/ws`, relaying chat, board operations,
   presence and call signalling
2. **A git microservice** — HTTP under `/git`, cloning and reading
   repositories on disk with `simple-git`

:::note This surprises most readers
The directory name suggests only WebSockets. The git half is substantial and
carries the code editor's file browsing. Both live in the same process, and a
crash in either takes down the other.
:::

## Stack

| Concern | Choice |
|---|---|
| WebSocket | `ws` 8.18 |
| HTTP | Express 4.21 |
| Git | `simple-git` 3.27 |
| Database | Prisma (shared schema) |

## Source layout

```
apps/web-socket/src/
├── index.ts          # WS server, message routing, Express bootstrap
├── gitRouter.ts      # /git HTTP endpoints
├── gitWorkspace.ts   # clone, lock, tree walk, file read
├── wsToken.ts        # HMAC token verification
├── prismaClient.ts   # DB client
└── redisClient.ts    # dead code — see below
```

:::warning `ioredis` and `kafkajs` are unused
Both are dependencies, and `redisClient.ts` exists, but nothing imports
them. They are leftovers from an abandoned scale-out design. The service
holds all connection state **in memory in a single process**, which is the
key constraint on deployment — see
[Known limitations](../operations/known-limitations.md).
:::

## Connection lifecycle

```
Browser                    apps/web                 apps/web-socket
   │                          │                           │
   │── request WS token ─────►│                           │
   │                          │ signWsToken(userId,       │
   │                          │   groupIds, ttl=300s)     │
   │◄──── token ──────────────│                           │
   │                                                      │
   │───── connect /ws?token=… ───────────────────────────►│
   │                                          verifyClient │
   │                                          ├ origin?    │
   │                                          ├ IP limit?  │
   │                                          └ HMAC?      │
   │◄──────────── open ───────────────────────────────────│
   │                                                      │
   │───── { type: "join_group", groupId } ───────────────►│
   │◄───── { type: "joined_group" } ──────────────────────│
```

Tokens are HMAC-SHA256, valid for **300 seconds**, and carry the user's group
memberships. Because they expire quickly, the client re-requests one on
reconnect rather than caching.

## Guards

Applied in `index.ts` before and during the connection:

| Guard | Value | Where |
|---|---|---|
| Origin allowlist | `WS_ALLOWED_ORIGINS` | `index.ts:40` — `verifyClient` |
| Connections per IP | 5 | `index.ts:19` |
| Messages per second | 10 | `index.ts:17` |
| Message size | 8 KB | `index.ts:18` |
| HTTP body size | 50 KB | `index.ts:26` |

Exceeding the message rate or size closes the connection rather than dropping
the message.

## Git microservice

Mounted at `/git` (`index.ts:544`):

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/git/default-branch` | Resolve a repo's default branch |
| `POST` | `/git/ensure` | Clone or update a workspace |
| `POST` | `/git/content` | Directory listing |
| `GET` | `/git/file` | Single file contents |
| `POST` | `/git/files` | Batch file read |

Clones live under `apps/web-socket/workspaces/<groupId>/<branch>/`.

Two safety mechanisms in `gitWorkspace.ts` are worth knowing:

- **`withGroupLock(groupId, fn)`** (`gitWorkspace.ts:11`) serialises git
  operations per group. Concurrent clones or checkouts on one working
  directory corrupt it, so every mutating path goes through this.
- **`safeResolve(dir, filePath)`** (`gitWorkspace.ts:26`) resolves a
  requested path and rejects anything escaping the workspace root. This is
  the guard against `../../etc/passwd` traversal through the file endpoints.

## Health

```bash
curl http://localhost:8080/health
```

## Next

- **[Setup](./setup.md)** — run and configure it
- **[Protocol](./protocol.md)** — every message type
- **[Testing](./testing.md)** — there are no automated tests; here is how to check it by hand
