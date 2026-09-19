---
sidebar_position: 2
title: Known limitations
---

# Known limitations

Where Ko-Lab's behaviour differs from what the code, schema or configuration
suggests. Collected while writing these docs by reading the source.

## Specified but not built

### Call recording

`CallRecording` and `RecordingStatus` exist in the schema, and
`MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_ENDPOINT` and `MINIO_BUCKET`
are declared in `turbo.json`. **No recording code exists.** Setting the MinIO
variables does nothing.

### OTP sign-in

The `Otp` model and `/api/auth/send-otp` remain, along with eight
`EMAIL_*` variables, but the flow is not wired into sign-in. Treat the email
configuration as legacy.

### Redis / Kafka scale-out

`ioredis` and `kafkajs` are dependencies and `apps/web-socket/src/redisClient.ts`
exists, but **nothing imports them**. The cross-instance messaging path was
started and abandoned. Its absence is what forces single-instance deployment.

## Structural

### The WebSocket service cannot scale horizontally

All connection and room state is in-process memory. Two instances means two
users connected to different ones cannot see each other's messages — and the
failure is intermittent, which makes it hard to diagnose.

**Consequence:** exactly one instance, which is a single point of failure and
a ceiling on concurrent connections.

**Fix:** implement the Redis pub/sub relay the dependencies were added for.

### The git service is stateful

Clones on local disk mean the service cannot be freely rescheduled or
replicated, and rules out serverless hosting.

### Boards are last-write-wins

No CRDT or operational transform. Two users dragging the same node produce a
flicker, and the later write survives. Adequate for graph boards; it would
not be adequate for collaborative text.

### Nothing prunes git workspaces

`workspaces/<groupId>/<branch>/` accumulates one clone per group per branch,
with no cleanup. On a long-running deployment this fills the disk.

**Workaround:** delete stale directories while no operation is in flight;
they are re-cloned on demand.

## Correctness and safety

### Hardcoded encryption fallback

`apps/web/app/lib/encryption.ts:5-6` falls back to a key committed in the
repository when `ENCRYPTION_KEY` is unset. Tokens encrypted under it are
effectively plaintext, and the fallback is silent. See
[Security](../architecture/security.md#1-hardcoded-encryption-fallback--highest-priority).

### Authorization is not uniform

Some routes accept a client-supplied `userId` and trust it. See
[Security](../architecture/security.md#2-inconsistent-authorization).

### Messages can persist without broadcasting, or vice versa

Chat writes over HTTP and broadcasts over WebSocket independently. If the
HTTP write fails, the message appears live and vanishes on reload. If the
broadcast fails, it is stored but not seen until refresh. There is no
reconciliation.

### WebSocket payloads are largely unvalidated

The server relays `workspace_op` without checking its shape.

## Test coverage gaps

261 tests pass, but coverage is uneven:

| Area | State |
|---|---|
| Calls | Strong — 11 files |
| Workspace pure logic | Good — 6 files |
| File handling | Covered |
| **Auth flows** | **None** |
| **VCS and change requests** | **None** |
| **`codeAccess` state machine** | **None** — gates repository writes |
| **WebSocket server** | **None** — no suite at all |
| **End-to-end** | **None** |

There is also no CI workflow, so nothing runs the suite automatically. A
starter config is in [Testing](../getting-started/testing.md#ci).

## Documentation drift

These docs exist because the previous README had diverged substantially:

| Claim | Reality |
|---|---|
| 13 environment variables | 46 across `turbo.json` and `.env.example` |
| 19 database models | 34 |
| Schema in `packages/db` | `packages/db` is empty; schema is in `apps/web/prisma/` |
| 21 API routes | ~40 route directories |
| Shared UI in `packages/ui` | Mostly unused; components live in `apps/web/app/components/` |
| `apps/web-socket` is a WebSocket server | It is also a git microservice |

## Misleading structure

| Thing | Why it misleads |
|---|---|
| `packages/db` | Empty despite the name |
| `packages/ui` | Largely unused |
| `redisClient.ts` | Imported nowhere |
| `MINIO_*` variables | Configure a feature that does not exist |
| `EMAIL_*` variables | Serve a flow that is not wired up |

None of these break anything. All of them cost a newcomer time.

---

## Rough priority

If this list were a backlog:

1. **Remove the encryption fallback** — small change, real exposure
2. **Audit route authorization** — a focused pass over ~40 routes
3. **Test the `codeAccess` gate** — it protects a real repository
4. **Add CI** — 261 tests exist and nothing runs them
5. **Redis relay for the WS service** — unblocks scaling
6. **Prune git workspaces** — prevents a slow disk-fill outage
7. **Delete dead code and variables** — cheap, and saves onboarding time
