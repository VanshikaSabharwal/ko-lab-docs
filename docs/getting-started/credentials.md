---
sidebar_position: 3
title: Credentials
---

# Generating credentials

Every key and secret Ko-Lab needs, and how to produce it. Start with the
**minimal set** — that is enough for groups, chat, the editor and boards.

## Minimal set

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `NEXTAUTH_URL` | Base URL for auth callbacks |
| `NEXTAUTH_SECRET` | Session signing |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth |
| `ENCRYPTION_KEY` | Encrypts stored GitHub tokens |
| `WS_AUTH_SECRET` | Signs WebSocket tokens |

---

## Locally generated secrets

### `NEXTAUTH_SECRET`

```bash
openssl rand -base64 32
```

### `ENCRYPTION_KEY`

**Exactly 64 hex characters (32 bytes).** Enforced at
`apps/web/app/lib/encryption.ts:8` — a wrong length throws at startup:

```ts
if (key.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY must be 64 hex chars (32 bytes), got ${hex.trim().length} chars → ${key.length} bytes`,
  );
}
```

Generate:

```bash
openssl rand -hex 32
```

:::danger Hardcoded fallback
`encryption.ts:5-6` falls back to a **committed default key** when
`ENCRYPTION_KEY` is unset. That value is public in the repo, so any GitHub
token encrypted under it is effectively plaintext. Always set this explicitly
outside local throwaway work.
:::

This key uses AES-256-CBC to encrypt GitHub access tokens at rest. **Rotating
it invalidates every stored token** — users must reconnect GitHub.

### `WS_AUTH_SECRET`

```bash
openssl rand -base64 32
```

Must be **byte-identical** in `apps/web` and `apps/web-socket`. It falls back
to `NEXTAUTH_SECRET` (`apps/web/app/lib/wsToken.ts:7`), so if you set neither,
signing throws. Tokens are HMAC-SHA256 with a **300-second TTL**
(`wsToken.ts:27`) and are verified with `timingSafeEqual`.

---

## GitHub OAuth

1. [github.com/settings/developers](https://github.com/settings/developers) →
   **New OAuth App**
2. Fill in:

| Field | Local | Production |
|---|---|---|
| Homepage URL | `http://localhost:3000` | `https://your-domain.com` |
| Callback URL | `http://localhost:3000/api/auth/callback/github` | `https://your-domain.com/api/auth/callback/github` |

3. Copy Client ID → `GITHUB_ID`, generate a secret → `GITHUB_SECRET`

:::tip Most common setup failure
The callback path must be exactly `/api/auth/callback/github`. A trailing
slash or wrong scheme produces `redirect_uri_mismatch`.
:::

Requested scopes include `repo` — Ko-Lab reads and writes repository contents,
creates branches, and manages collaborator invitations.

## Google OAuth (optional)

[console.cloud.google.com](https://console.cloud.google.com/) → **APIs &
Services** → **Credentials** → OAuth client ID (Web application).

Redirect URI: `http://localhost:3000/api/auth/callback/google`

→ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## LiveKit (voice & video)

<details>
<summary>Self-hosted with Docker</summary>

```bash
docker compose -f docker-compose.livekit.yml up -d
```

Dev defaults are `devkey` / `secret`. **Never use these in production.**

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_HOST=http://localhost:7880
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```
</details>

<details>
<summary>LiveKit Cloud</summary>

Create a project at [cloud.livekit.io](https://cloud.livekit.io/), then take
the API key, secret and WebSocket URL from the dashboard.

```env
LIVEKIT_HOST=https://your-project.livekit.cloud
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```
</details>

Note the split: `LIVEKIT_HOST` is server-side HTTP; `NEXT_PUBLIC_LIVEKIT_URL`
is the browser-facing `ws://`/`wss://` URL.

## Object storage

<details>
<summary>LocalStack (local)</summary>

```bash
docker compose -f docker-compose.localstack.yml up -d
aws --endpoint-url=http://localhost:4566 s3 mb s3://ko-lab-uploads
```

```env
LOCALSTACK_AUTH_TOKEN=your-token
S3_ENDPOINT=http://localhost:4566
S3_BUCKET=ko-lab-uploads
S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
```

A free token from [app.localstack.cloud](https://app.localstack.cloud/) is now
mandatory.
</details>

<details>
<summary>Cloudflare R2 (production)</summary>

R2 → **Manage R2 API Tokens** → create a token with Object Read & Write.

```env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=ko-lab-uploads
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret-key>
AWS_REGION=auto
```
</details>

## Groq (AI assistant)

Free key at [console.groq.com/keys](https://console.groq.com/keys).

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

Powers the editor's AI assistant and `POST /api/generate-readme`.

## Bug reporting → GitHub issues

A PAT with `repo` scope, from
[github.com/settings/tokens](https://github.com/settings/tokens):

```env
BUG_REPORT_GITHUB_TOKEN=ghp_...
BUG_REPORT_REPO=VanshikaSabharwal/ko-lab
BUG_ADMIN_EMAIL=you@example.com
```

## Git microservice

```bash
openssl rand -base64 32   # → GIT_SERVICE_SECRET
```

```env
GIT_SERVICE_SECRET=<generated>
GIT_SERVICE_URL=http://localhost:8080
```

Shared between `apps/web` and `apps/web-socket` as a bearer token.

---

## Minimal working `.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kolab
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
GITHUB_ID=<from GitHub OAuth app>
GITHUB_SECRET=<from GitHub OAuth app>
ENCRYPTION_KEY=<openssl rand -hex 32>
WS_AUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_WEB_SOCKET_URL=ws://localhost:8080/ws
WS_ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

:::caution Never commit `.env`
Rotate anything that lands in git history — deleting the commit is not enough.
:::
