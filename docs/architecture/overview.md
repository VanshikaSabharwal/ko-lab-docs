---
sidebar_position: 1
title: Overview
---

# Architecture

## Shape

Two deployable applications over one PostgreSQL database:

```
                    ┌──────────────┐
                    │   Browser    │
                    └──────┬───────┘
              HTTP         │        WebSocket + media
        ┌─────────────────┼──────────────────┬──────────┐
        ▼                 │                  ▼          ▼
┌───────────────┐         │        ┌─────────────┐  ┌────────┐
│   apps/web    │         │        │ web-socket  │  │LiveKit │
│   Next.js 14  │◄────────┴───────►│  ws + git   │  │  SFU   │
│   UI + API    │   git service    │             │  └────────┘
└───────┬───────┘      (HTTP)      └──────┬──────┘
        │                                 │
        │         ┌──────────────┐        │
        └────────►│  PostgreSQL  │◄───────┘
                  └──────────────┘
                          ▲
                  ┌───────┴───────┐
                  │ S3 / R2 / LS  │
                  └───────────────┘
```

| Component | Responsibility |
|---|---|
| `apps/web` | UI, REST API, auth, persistence |
| `apps/web-socket` | Realtime hub **and** git microservice |
| PostgreSQL | All durable state |
| S3-compatible | Avatars, editor drafts |
| LiveKit | Call media |

Both apps share `apps/web/prisma/schema.prisma`.

## Monorepo

npm workspaces with Turborepo:

```
ko-lab/
├── apps/
│   ├── web/          # Next.js — UI + API + schema
│   └── web-socket/   # Node — WS + git
├── packages/
│   ├── ui/           # mostly unused
│   ├── db/           # EMPTY — no schema here
│   ├── eslint-config/
│   └── typescript-config/
└── turbo.json
```

:::warning Two misleading directories
`packages/db` is empty despite its name — the schema is in
`apps/web/prisma/`. And `packages/ui` is largely unused; components live in
`apps/web/app/components/`. Both mislead newcomers reading the tree.
:::

## Request paths

**Standard request** — browser → Next.js route handler → Prisma →
PostgreSQL. Nothing unusual.

**Realtime** — the client holds a WebSocket to `apps/web-socket`. Chat and
board operations go over it for immediacy while also being persisted over
HTTP. The socket carries no media and no file contents.

**Git** — `apps/web` never shells out to git. It calls the git microservice
over HTTP with a bearer token, and that service operates on clones under
`workspaces/`. This keeps disk-bound work out of the Next.js process, which
may be serverless.

**Calls** — signalling over WebSocket, media directly between browser and
LiveKit. `apps/web` mints short-lived tokens and reconciles state from
LiveKit webhooks.

## Trust boundaries

| Boundary | Mechanism |
|---|---|
| Browser → `apps/web` | NextAuth session |
| Browser → `apps/web-socket` | HMAC token, 300s TTL, origin allowlist |
| `apps/web` → git service | `GIT_SERVICE_SECRET` bearer token |
| `apps/web` → GitHub | OAuth token, AES-256-CBC at rest |
| Browser → LiveKit | LiveKit access token, 10m TTL |

## Deliberate choices

**No CRDT.** Board collaboration is last-write-wins. Simple, adequate for
graph boards, and would not survive collaborative text editing.

**Git in a separate process.** Cloning needs a writable disk and is slow —
both a poor fit for serverless.

**Dual-path messages.** Chat persists over HTTP and broadcasts over
WebSocket. Simple, at the cost of a failure mode where one path succeeds and
the other does not.

## Structural constraints

**Single WebSocket instance.** All connection state is in-process memory.
`ioredis` and `kafkajs` are installed and `redisClient.ts` exists, but
nothing imports them — the scale-out path was started and abandoned. Running
two instances splits users into groups that cannot see each other.

**The git service is stateful.** Clones on local disk mean it cannot be
freely rescheduled or horizontally scaled.

**One database.** No read replicas or sharding.

For what this means in practice, see
[Known limitations](../operations/known-limitations.md).
