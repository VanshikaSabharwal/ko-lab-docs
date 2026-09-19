---
sidebar_position: 3
title: Security
---

# Security

What is in place, and what needs attention. Findings here came from reading
the source while writing these docs — they are observations, not a formal
audit.

## In place

### WebSocket

| Guard | Value | Source |
|---|---|---|
| Origin allowlist | `WS_ALLOWED_ORIGINS` | `index.ts:40` |
| Token auth | HMAC-SHA256, 300s TTL | `wsToken.ts` |
| Timing-safe compare | `timingSafeEqual` | `wsToken.ts:49` |
| Connections per IP | 5 | `index.ts:19` |
| Messages per second | 10 | `index.ts:17` |
| Message size | 8 KB | `index.ts:18` |
| HTTP body size | 50 KB | `index.ts:26` |

Using `timingSafeEqual` rather than `===` for signature comparison is
correct and worth preserving.

### Git service

- **Path traversal** — `safeResolve` (`gitWorkspace.ts:26`) rejects paths
  escaping the workspace root
- **Concurrency** — `withGroupLock` (`gitWorkspace.ts:11`) serialises git
  operations per group, preventing working-directory corruption
- **Auth** — `GIT_SERVICE_SECRET` bearer token

### Tokens at rest

GitHub access tokens are encrypted with AES-256-CBC before storage
(`apps/web/app/lib/encryption.ts`).

### Call tokens

LiveKit access tokens carry a **10-minute TTL** (`lib/livekit.ts:18`),
limiting replay.

---

## Needs attention

### 1. Hardcoded encryption fallback — highest priority

`apps/web/app/lib/encryption.ts:5-6`:

```ts
const key =
  process.env.ENCRYPTION_KEY ||
  "238d654b1ee39c0663cf2bb6602315cdbc48c322b3a06f50a90e92248468b743";
```

If `ENCRYPTION_KEY` is unset, tokens are encrypted with **a key committed to
the repository**. Anyone with repo access — it is public — can decrypt them.
Since the fallback is silent, a production deploy that forgets the variable
looks completely normal.

**Fix:** throw on a missing key instead.

```ts
const hex = process.env.ENCRYPTION_KEY;
if (!hex) {
  throw new Error("ENCRYPTION_KEY is required");
}
```

Failing at boot is far better than silently storing recoverable tokens. Note
that rotating the key invalidates existing tokens — users must reconnect
GitHub.

### 2. Inconsistent authorization

Several routes accept a `userId` (or similar) parameter from the client and
trust it, rather than deriving identity from the session. Where that value
selects the data returned, any signed-in user can read another's data by
changing it.

**Pattern to avoid:**

```ts
const userId = searchParams.get("userId");
const data = await prisma.notifications.findMany({ where: { userId } });
```

**Preferred:**

```ts
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ success: false }, { status: 401 });
}
const data = await prisma.notifications.findMany({
  where: { userId: session.user.id },
});
```

For group-scoped routes, check membership explicitly:

```ts
const member = await prisma.groupMember.findFirst({
  where: { groupId, userId: session.user.id },
});
if (!member) {
  return NextResponse.json({ success: false }, { status: 403 });
}
```

Auditing every route against this is worth doing as a focused pass. The
[manual authorization check](../backend/testing.md#checking-authorization-by-hand)
describes how to test one route by hand.

### 3. `codeAccess` is untested

The four-state machine gating repository writes has **no automated tests**.
A regression here means an unauthorised member can commit to a real
repository. Suggested tests are in
[Code editor & VCS](../features/code-editor-vcs.md#testing).

### 4. WebSocket payloads are largely untrusted

The server relays `workspace_op` without validating its shape or checking
that the sender may modify that board beyond group membership. A malicious
client can send malformed operations to peers.

### 5. Rate limits are per-IP only

`MAX_CONNECTIONS_PER_IP = 5` is easy to bypass from multiple addresses, and
also catches legitimate users behind shared NAT. Per-user limits keyed on the
authenticated token would be more accurate in both directions.

---

## Deployment checklist

- [ ] `ENCRYPTION_KEY` set explicitly — never the fallback
- [ ] `NEXTAUTH_SECRET` unique to the environment
- [ ] `WS_AUTH_SECRET` identical across both apps, unique per environment
- [ ] `WS_ALLOWED_ORIGINS` lists only real origins — no wildcards
- [ ] HTTPS everywhere (required for camera and microphone)
- [ ] LiveKit dev keys (`devkey`/`secret`) replaced
- [ ] `GIT_SERVICE_SECRET` set and strong
- [ ] Database not publicly reachable
- [ ] S3 bucket not world-writable
- [ ] `.env` absent from git history
- [ ] Error responses leak no stack traces

## Reporting

Report suspected vulnerabilities privately to the maintainer rather than
opening a public issue.
