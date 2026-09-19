---
sidebar_position: 1
slug: /
title: Introduction
---

# Ko-Lab

Ko-Lab is a collaborative development workspace. A team creates a **group**,
links it to a GitHub repository, and then works inside one place: editing code,
planning on shared boards, chatting, and talking over voice and video — with
every change flowing through a review step before it reaches the repo.

## What it does

| Area | Summary |
|---|---|
| **Groups** | A team bound to a GitHub repo, with roles and per-member code access |
| **Chat** | Group chat and 1:1 direct messages, delivered live over WebSocket |
| **Workspace boards** | Four collaborative canvases — UI design, mind map, DB schema, planning — with live cursors and presence |
| **Code editor** | In-browser IDE over the linked repo, with a Groq-backed AI assistant |
| **VCS** | Branches, change requests, diff review, and merge — without leaving the app |
| **Voice & video** | LiveKit-backed 1:1 and group calls with screen sharing |
| **Notifications** | In-app centre plus Web Push |
| **Bug reporting** | In-app reports that open GitHub issues |

## How it is put together

Three deployable pieces:

```
┌─────────────────┐     HTTP      ┌──────────────────┐
│  apps/web       │◄─────────────►│   PostgreSQL     │
│  Next.js 14     │    Prisma     │                  │
│  UI + REST API  │               └──────────────────┘
└────────┬────────┘
         │ WebSocket (/ws)
         ▼
┌─────────────────┐   simple-git  ┌──────────────────┐
│ apps/web-socket │◄─────────────►│  Git workspaces  │
│ WS hub + git    │               │  on disk         │
│ microservice    │               └──────────────────┘
└─────────────────┘
```

- **[Frontend](../frontend/overview.md)** — Next.js 14 App Router, React 18, Tailwind
- **[Backend](../backend/overview.md)** — Next.js API routes, Prisma, PostgreSQL
- **[WebSocket](../websocket/overview.md)** — a standalone Node service that is
  *two* things at once: a realtime hub **and** a git microservice

That last point surprises most people reading the code for the first time, so
it is called out explicitly in the [WebSocket overview](../websocket/overview.md).

## External services

Ko-Lab talks to several third parties. Only the first four are needed to boot:

| Service | Required? | Used for |
|---|---|---|
| PostgreSQL | **Yes** | All persistence |
| GitHub OAuth | **Yes** | Sign-in, repo linking |
| Google OAuth | Optional | Alternative sign-in |
| LiveKit | Calls only | Voice/video SFU |
| S3 / R2 / LocalStack | Uploads only | Avatars, file drafts |
| Groq | AI only | Code assistant, README generation |

## Where to go next

1. **[Installation](./installation.md)** — get it running locally
2. **[Credentials](./credentials.md)** — generate every key and secret
3. **[Environment variables](./environment-variables.md)** — the full reconciled reference
4. **[Testing](./testing.md)** — 261 tests, and how to run them

:::note Documentation status
These docs were written by reading the source directly, because the previous
README had drifted badly from reality — it documented 13 environment variables
where 46 exist, and 19 database models where there are 34. Where something is
specified but **not built**, the page says so.
:::
