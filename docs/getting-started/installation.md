---
sidebar_position: 2
title: Installation
---

# Installation

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | ≥ 18 (20 recommended) | `node -v` |
| npm | 10.8.1 | `npm -v` |
| PostgreSQL | 14+ | `psql --version` |
| Docker | Optional — LiveKit, LocalStack | `docker -v` |

The repo is an **npm workspaces + Turborepo** monorepo. Install from the root;
do not run `npm install` inside `apps/web` on its own.

## 1. Clone and install

```bash
git clone https://github.com/VanshikaSabharwal/ko-lab.git
cd ko-lab
npm install
```

This installs every workspace: `apps/web`, `apps/web-socket`, and the shared
packages.

:::warning Disk space
A full install is ~1.5 GB. Combined with the build output, budget 2–3 GB free.
:::

## 2. Configure environment

```bash
cp .env.example .env
```

`.env.example` covers the common variables but **not all of them** — the full
list lives in [Environment variables](./environment-variables.md). For a first
boot you only need the minimal set in [Credentials](./credentials.md).

## 3. Set up the database

```bash
# Generate the Prisma client
npm run db:web

# Apply migrations
cd apps/web && npx prisma migrate dev && cd ../..
```

Verify with Prisma Studio:

```bash
cd apps/web && npx prisma studio
```

## 4. Run

Everything at once, via Turborepo:

```bash
npm run dev
```

Or each service separately, which is easier to debug:

```bash
# Terminal 1 — Next.js on :3000
cd apps/web && npm run dev

# Terminal 2 — WebSocket + git service on :8080
cd apps/web-socket && npm run dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| WebSocket | ws://localhost:8080/ws |
| Git microservice | http://localhost:8080 |

## 5. Confirm it works

```bash
# WS health
curl http://localhost:8080/health

# Test suite — expect 31 files, 261 tests
cd apps/web && npm test
```

Then open http://localhost:3000, sign in with GitHub, and create a group. If
sign-in fails, the OAuth callback URL is the usual culprit — see
[Credentials](./credentials.md#github-oauth).

## Optional services

<details>
<summary>LiveKit — voice and video</summary>

```bash
docker compose -f docker-compose.livekit.yml up -d
./scripts/smoke-test-livekit.sh
```

Then set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_HOST`, and
`NEXT_PUBLIC_LIVEKIT_URL`.
</details>

<details>
<summary>LocalStack — S3 for uploads</summary>

```bash
docker compose -f docker-compose.localstack.yml up -d
aws --endpoint-url=http://localhost:4566 s3 mb s3://ko-lab-uploads
```

:::warning Not mentioned in the old README
LocalStack now requires `LOCALSTACK_AUTH_TOKEN`. Get a free token at
[app.localstack.cloud](https://app.localstack.cloud/). Without it the container
starts but S3 calls fail — the app then silently loses avatar uploads.
:::
</details>

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `PrismaClientInitializationError` | Client not generated | `npm run db:web` |
| WS connects then drops | `WS_AUTH_SECRET` mismatch | Must be **identical** in both apps |
| `Origin not allowed` | Origin not allowlisted | Add to `WS_ALLOWED_ORIGINS` |
| Avatar upload silently fails | S3/LocalStack down | Check the container, and `LOCALSTACK_AUTH_TOKEN` |
| OAuth redirect mismatch | Callback URL wrong | See [Credentials](./credentials.md) |
