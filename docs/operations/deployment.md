---
sidebar_position: 1
title: Deployment
---

# Deployment

Two applications with **different hosting requirements**. This is the main
thing to get right.

| App | Needs | Suitable hosts |
|---|---|---|
| `apps/web` | Standard Next.js | Vercel, Netlify, any Node host |
| `apps/web-socket` | Persistent connections, writable disk | Railway, Render, Fly.io, VPS |

:::danger `apps/web-socket` cannot run on Vercel
It needs long-lived WebSocket connections and a writable filesystem for git
clones. Serverless gives neither.
:::

## Prerequisites

- PostgreSQL (Neon, Supabase, RDS, or self-hosted)
- A host for the WebSocket service
- S3-compatible storage (R2 recommended — no egress fees)
- LiveKit Cloud or a self-hosted SFU, if calls are enabled
- A domain with TLS

## 1. Database

```bash
cd apps/web
DATABASE_URL="<production-url>" npx prisma migrate deploy
```

Use `migrate deploy`, never `migrate dev`, in production — `dev` can prompt
and can reset.

Take a backup before any migration that drops or alters a column.

## 2. WebSocket service

Deploy `apps/web-socket` first — the web app needs its URL.

```env
DATABASE_URL=<same database>
WS_AUTH_SECRET=<generated, shared>
WS_ALLOWED_ORIGINS=https://your-domain.com
GIT_SERVICE_SECRET=<generated>
NODE_ENV=production
```

```bash
npm run build
npm start
```

Requirements:

- **Persistent disk** for `workspaces/` — size it for one clone per group per
  branch
- **Exactly one instance** — see below
- Health check at `/health`

:::danger Do not scale beyond one instance
All connection state is in-process memory. Two instances means two users on
different instances cannot see each other's messages, and the failure is
intermittent and confusing. `ioredis` is installed but unused — the
cross-instance path was never built.
:::

## 3. Web app

```env
DATABASE_URL=<production-url>
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generated>
GITHUB_ID=<production OAuth app>
GITHUB_SECRET=<production OAuth app>
ENCRYPTION_KEY=<64 hex chars — NEVER the fallback>
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_WEB_SOCKET_URL=wss://ws.your-domain.com/ws
WS_AUTH_SECRET=<same as the WS service>
GIT_SERVICE_URL=https://ws.your-domain.com
GIT_SERVICE_SECRET=<same as the WS service>
# Optional
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_HOST=https://your-project.livekit.cloud
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
S3_ENDPOINT=...
S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
GROQ_API_KEY=...
```

On Vercel, set the root directory to `apps/web`.

:::warning `wss://`, not `ws://`
An HTTPS page cannot open an insecure WebSocket. Browsers block it silently
enough that it reads as "realtime is broken".
:::

## 4. Production OAuth app

Create a **separate** GitHub OAuth app — do not reuse the development one.

| Field | Value |
|---|---|
| Homepage | `https://your-domain.com` |
| Callback | `https://your-domain.com/api/auth/callback/github` |

## 5. Add a new env var later

Turborepo hashes declared variables. Add it to the `env` array in
`turbo.json`, or builds will be cached against a stale value and silently
use the wrong configuration.

## Post-deploy verification

```bash
curl -I https://your-domain.com
curl https://ws.your-domain.com/health
curl -s https://your-domain.com/api/calls/health | jq
```

Then by hand:

1. Sign in with GitHub
2. Create a group
3. Open it in two browsers and send a message — verifies WebSocket end to end
4. Open a workspace board and move a node in one window
5. Link a repository and open the code editor — verifies the git service
6. Place a call, if LiveKit is configured

Step 3 is the one that catches most misconfigurations.

## Rollback

```bash
# Web — Vercel keeps previous deployments
vercel rollback

# WS service — redeploy the previous image or commit
```

Database migrations do not roll back automatically. Verify the down path
before deploying a destructive migration.

## Operations

**Monitor**

- Disk on the WS host — `workspaces/` grows without bound
- Database connections — Prisma pools per instance
- WS connection count and rejection logs

**Housekeeping**

Nothing prunes stale clones. Clearing them is safe while no git operation is
in flight, since they are re-cloned on demand:

```bash
du -sh apps/web-socket/workspaces
```

**Logs to watch**

| Message | Meaning |
|---|---|
| `🚫 Rejected WS connection from unauthorized origin` | Origin not allowlisted |
| Prisma connection errors | Pool exhausted or database unreachable |
| Git clone failures | Disk full or permissions |

## Cost notes

- **R2 over S3** — no egress fees, meaningful for file downloads
- **LiveKit Cloud** bills per participant-minute; self-hosting trades that
  for bandwidth and ops
- **Groq** has a free tier adequate for light use
