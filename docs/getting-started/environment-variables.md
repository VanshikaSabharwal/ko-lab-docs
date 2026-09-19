---
sidebar_position: 4
title: Environment variables
---

# Environment variables

:::info Reconciled reference
Ko-Lab had **three disagreeing sources of truth**: `turbo.json` declared 46
variables, `.env.example` covered 23 (four of which `turbo.json` omits), and
the old README documented 13. This page reconciles all three against the
source. Where a variable is redundant or dead, it says so.
:::

**Legend** — **Required**: the app will not boot or the feature is broken ·
**Optional**: feature-gated · **Deprecated**: prefer an alternative

## Core

| Variable | Status | Notes |
|---|---|---|
| `DATABASE_URL` | **Required** | PostgreSQL connection string |
| `NODE_ENV` | Auto | Set by the framework |
| `NEXT_PUBLIC_APP_URL` | **Required** | Public base URL; used in emails and invite links |
| `ALLOWED_ORIGINS` | Optional | CORS allowlist for API routes |

## Authentication

| Variable | Status | Notes |
|---|---|---|
| `NEXTAUTH_URL` | **Required** | Must match the deployed origin exactly |
| `NEXTAUTH_SECRET` | **Required** | Session signing; also the `WS_AUTH_SECRET` fallback |
| `JWT_SECRET` | Optional | Legacy; `NEXTAUTH_SECRET` covers current flows |
| `GITHUB_ID` | **Required** | OAuth client ID |
| `GITHUB_SECRET` | **Required** | OAuth client secret |
| `GOOGLE_CLIENT_ID` | Optional | Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Optional | Google sign-in |
| `ENCRYPTION_KEY` | **Required** | 64 hex chars. [Has an insecure fallback](./credentials.md#encryption_key) |

## WebSocket & git service

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_WEB_SOCKET_URL` | **Required** | Browser-facing, e.g. `ws://localhost:8080/ws` |
| `NEXT_PUBLIC_WS_URL` | **Deprecated** | Duplicate of the above |
| `WEB_SOCKET_URL` | Optional | Server-side variant |
| `WS_AUTH_SECRET` | **Required** | Must match across both apps; falls back to `NEXTAUTH_SECRET` |
| `WS_ALLOWED_ORIGINS` | **Required** | Comma-separated; connections from other origins are refused |
| `GIT_SERVICE_URL` | **Required** | Where `apps/web` reaches the git microservice |
| `GIT_SERVICE_SECRET` | **Required** | Bearer token for that service |

:::warning Three variables, one value
`NEXT_PUBLIC_WEB_SOCKET_URL`, `NEXT_PUBLIC_WS_URL` and `WEB_SOCKET_URL` all
describe the same endpoint. Set `NEXT_PUBLIC_WEB_SOCKET_URL`; treat the others
as legacy.
:::

## Voice & video (LiveKit)

| Variable | Status | Notes |
|---|---|---|
| `LIVEKIT_API_KEY` | Calls | Server-side |
| `LIVEKIT_API_SECRET` | Calls | Server-side |
| `LIVEKIT_HOST` | Calls | HTTP(S) URL for server API |
| `NEXT_PUBLIC_LIVEKIT_URL` | Calls | `ws://`/`wss://` for the browser |

## Object storage

| Variable | Status | Notes |
|---|---|---|
| `S3_ENDPOINT` | Uploads | LocalStack, R2 or AWS |
| `S3_BUCKET` | Uploads | Main bucket |
| `DRAFT_BUCKET` | Uploads | Unsaved editor drafts |
| `S3_FORCE_PATH_STYLE` | Uploads | `true` for LocalStack and R2 |
| `S3_PUBLIC_BASE_URL` | Uploads | Public read URL |
| `AWS_ACCESS_KEY_ID` | Uploads | |
| `AWS_SECRET_ACCESS_KEY` | Uploads | |
| `AWS_REGION` | Uploads | `auto` for R2 |
| `LOCALSTACK_AUTH_TOKEN` | Local only | **Now mandatory**; absent from `turbo.json` |
| `MINIO_ACCESS_KEY` | Unused | Specced for call recording — [not built](../operations/known-limitations.md) |
| `MINIO_SECRET_KEY` | Unused | As above |
| `MINIO_ENDPOINT` | Unused | As above |
| `MINIO_BUCKET` | Unused | As above |

## AI

| Variable | Status | Notes |
|---|---|---|
| `GROQ_API_KEY` | AI features | Editor assistant, README generation |
| `GROQ_MODEL` | AI features | Default `llama-3.3-70b-versatile` |

## Bug reporting

| Variable | Status | Notes |
|---|---|---|
| `BUG_REPORT_GITHUB_TOKEN` | Bug reports | PAT with `repo` scope |
| `BUG_REPORT_REPO` | Bug reports | `owner/repo` for filed issues |
| `BUG_ADMIN_EMAIL` | Bug reports | Notification recipient |

## Email

:::caution Largely dead code
Eight email variables exist with heavy overlap. The OTP sign-in flow they
served is **no longer wired up**. Treat these as legacy unless you are
reviving that flow.
:::

| Variable | Status |
|---|---|
| `EMAIL_FROM` | Legacy |
| `EMAIL_USER` / `EMAIL_PASS` | Legacy — duplicate pair |
| `EMAIL_PASSWORD` | Legacy — duplicate of `EMAIL_PASS` |
| `EMAIL_SERVER_HOST` / `EMAIL_SERVER_PORT` | Legacy |
| `EMAIL_SERVER_USER` / `EMAIL_SERVER_PASSWORD` | Legacy |

## Platform (Vercel)

| Variable | Status |
|---|---|
| `VERCEL_URL` | Auto-injected |
| `VERCEL_PROJECT_PRODUCTION_URL` | Auto-injected |

---

## Adding a new variable

Turborepo hashes declared env vars for caching. A new variable **must** be
added to the `env` array in `turbo.json`, or builds will be cached against a
stale value and silently pick up the wrong config.
