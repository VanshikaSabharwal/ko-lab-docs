---
sidebar_position: 2
title: Setup
---

# WebSocket setup

## Run

```bash
cd apps/web-socket
npm run dev     # tsx watch, port 8080
```

Production:

```bash
npm run build   # tsc → dist/
npm start
```

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Same database as `apps/web` |
| `WS_AUTH_SECRET` | Yes | **Byte-identical** to the web app's value |
| `WS_ALLOWED_ORIGINS` | Yes | Comma-separated origins |
| `GIT_SERVICE_SECRET` | Yes | Bearer token for `/git` |
| `PORT` | No | Hardcoded to 8080 in `index.ts:9` |

:::danger The single most common failure
If `WS_AUTH_SECRET` differs between the two apps — including a trailing
newline or a stray quote — every connection is accepted at the TCP level and
then immediately closed during token verification. The browser shows a
connect/disconnect loop with no useful error.

Verify they match:

```bash
grep WS_AUTH_SECRET .env apps/web-socket/.env
```
:::

Both apps fall back to `NEXTAUTH_SECRET` when `WS_AUTH_SECRET` is unset, so
setting neither works in development as long as `NEXTAUTH_SECRET` is shared.

## Origins

```env
# Development
WS_ALLOWED_ORIGINS=http://localhost:3000

# Production — include every origin that will connect
WS_ALLOWED_ORIGINS=https://ko-lab.app,https://www.ko-lab.app
```

A rejected origin logs server-side:

```
🚫 Rejected WS connection from unauthorized origin: https://example.com
```

Preview deployments each get their own origin, so a Vercel preview will fail
to connect unless its URL is added.

## Git workspaces

Clones are written to `apps/web-socket/workspaces/`. This needs:

- **Disk** — one clone per group *per branch*, so a large repo across several
  branches adds up quickly
- **A writable filesystem** — which rules out most serverless platforms

```bash
du -sh apps/web-socket/workspaces
```

Nothing prunes these automatically. On a long-running deployment, stale
branch directories accumulate; clearing them is safe while no operation is in
flight, since they are re-cloned on demand.

## Verify

```bash
# Health
curl http://localhost:8080/health

# Origin rejection — should fail
npx wscat -c ws://localhost:8080/ws -o http://evil.example.com

# Without a token — should close immediately
npx wscat -c ws://localhost:8080/ws
```

## Deployment notes

This service **cannot run on Vercel** or any serverless platform. It needs
persistent connections and a writable disk. Use a long-running host — Railway,
Render, Fly.io or a VPS.

Because all connection state is in-process memory, **you cannot run more than
one instance** without users on different instances failing to see each
other's messages. See
[Known limitations](../operations/known-limitations.md).

## Troubleshooting

| Symptom | Cause |
|---|---|
| Connect/disconnect loop | `WS_AUTH_SECRET` mismatch |
| `Rejected … unauthorized origin` | Origin not in `WS_ALLOWED_ORIGINS` |
| Connection refused after 5 tabs | `MAX_CONNECTIONS_PER_IP` is 5 |
| Closed while typing fast | 10 msg/s rate limit |
| Large paste dropped | 8 KB message cap |
| Git endpoints 500 | Check disk space and `workspaces/` permissions |
