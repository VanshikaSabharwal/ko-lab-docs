---
sidebar_position: 5
title: Voice & video calls
---

# Voice & video calls

## Description

1:1 and group calls backed by **LiveKit**, an SFU. Ko-Lab handles signalling,
call state and notifications; LiveKit carries the media. Supports mute,
camera toggle and screen sharing.

This is the **best-tested feature** in the codebase — 11 test files.

## Setup

<details>
<summary>Self-hosted LiveKit</summary>

```bash
docker compose -f docker-compose.livekit.yml up -d
./scripts/smoke-test-livekit.sh
```

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_HOST=http://localhost:7880
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

Dev defaults — never use these in production.
</details>

<details>
<summary>LiveKit Cloud</summary>

```env
LIVEKIT_HOST=https://your-project.livekit.cloud
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=<from dashboard>
LIVEKIT_API_SECRET=<from dashboard>
```
</details>

Note the split: `LIVEKIT_HOST` is the server-side HTTP URL; the
`NEXT_PUBLIC_` one is the browser's WebSocket URL. Getting these crossed is a
common misconfiguration.

Verify:

```bash
curl -s http://localhost:3000/api/calls/health | jq
```

:::caution HTTPS in production
Browsers only grant camera and microphone access on secure origins.
`localhost` is exempt; any other host needs TLS.
:::

## Integration

```
Caller                Backend                 WebSocket        LiveKit
──────                ───────                 ─────────        ───────
initiate ──────────► POST /api/calls/initiate
                       creates CallRoom
                       status = RINGING
                            └──────────────► call_offered ──► Callee
                                                              (+ Web Push)
Callee accepts ────► PATCH /api/calls/[id]
                       status = ONGOING
                            └──────────────► call_accepted ─► Caller
Both ──────────────► POST /api/calls/token
                       AccessToken, ttl 10m
                            ─────────────────────────────────► join room
                                                                (media)
LiveKit events ────► POST /api/calls/livekit-webhook
```

**No media crosses the WebSocket service** — it carries signalling only.
Media goes browser ↔ LiveKit directly.

## Data model

| Model | Purpose |
|---|---|
| `CallRoom` | One call: `livekitRoom`, `type`, `status`, initiator, timestamps |
| `CallParticipant` | Per-user state: joined/left, muted, video off, screen sharing |
| `CallRecording` | **Schema only — recording is not implemented** |

```prisma
enum CallStatus { RINGING  ONGOING  ENDED  MISSED  REJECTED }
```

## How it works

### Access tokens are short-lived

`apps/web/app/lib/livekit.ts:15`:

```ts
const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
  identity: userId,
  ttl: "10m",
});
at.addGrant({ roomJoin: true, room: roomName /* … */ });
```

A 10-minute TTL means a token cannot be replayed long after issue. Clients
re-request rather than caching one.

`ensureLiveKitRoom` and `deleteLiveKitRoom` manage room lifecycle through
`RoomServiceClient`.

### Webhooks reconcile state

The browser is not a reliable reporter — a user can close a tab mid-call.
`POST /api/calls/livekit-webhook` receives authoritative participant-joined
and participant-left events from LiveKit and updates `CallParticipant`, so
the database reflects reality even when a client disappears.

### Missed calls

If nobody accepts, the call transitions to `MISSED` and produces a
notification. Web Push (`/api/calls/push-subscribe`) can alert a callee who
does not have the tab open.

## Testing

### Automated — 11 files

```bash
cd apps/web && npx vitest run __tests__/api/calls
```

| File | Covers |
|---|---|
| `initiate.test.ts` | Call creation |
| `token.test.ts` | Token minting and grants |
| `accept.test.ts`, `reject.test.ts`, `end.test.ts` | State transitions |
| `livekit-webhook.test.ts` | Webhook handling |
| `push-subscribe.test.ts` | Push registration |
| `health.test.ts` | Config check |
| `livekit-lib.test.ts` | The LiveKit wrapper |
| `env-validation.test.ts` | Clean failure when unconfigured |
| `prisma-models.test.ts` | Model shape |

Plus four component files: `CallUI`, `CallProvider`, `CallComponents`,
`CallResponsiveness`.

`env-validation.test.ts` is a good pattern to copy — it asserts the feature
fails cleanly rather than cryptically when keys are absent.

LiveKit is always mocked:

```ts
vi.mock("livekit-server-sdk", () => ({
  AccessToken: vi.fn(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn(() => "fake.jwt.token"),
  })),
  RoomServiceClient: vi.fn(() => ({
    createRoom: vi.fn(),
    deleteRoom: vi.fn(),
  })),
}));
```

### Gaps

Token *authorization* is thinner than token *generation*. Worth adding:

```ts
it("refuses a token for a call the user is not part of", async () => {
  const res = await POST(tokenRequest({ callId: "c1", userId: "stranger" }));
  expect(res.status).toBe(403);
});
```

### Manual — unavoidable

Media cannot be meaningfully automated. Two devices, or two browser profiles
with real camera and microphone.

**1:1**

1. A calls B → B sees incoming UI and hears a ring
2. B accepts → two-way audio and video within a few seconds
3. A mutes → B sees the muted indicator and hears nothing
4. A turns off camera → B sees the placeholder
5. A shares screen → B sees it; stopping restores the camera
6. Either ends → both return cleanly, status `ENDED`

**Group**

1. A starts a group call, B and C join
2. All three see each other
3. One leaves → the other two continue, layout reflows
4. Last participant leaves → the room is cleaned up

**Rejection and missed**

1. B declines → A sees it, status `REJECTED`
2. Nobody answers → status `MISSED`, notification created
3. B has the app closed → Web Push arrives (needs HTTPS)

**Network**

1. Disable A's wifi mid-call → B sees a connection warning
2. Re-enable → reconnects, or fails with a clear message
3. Throttle to 3G in devtools → video degrades, audio should survive
4. **Close A's tab abruptly** → B sees A leave within seconds. This
   specifically exercises the webhook reconciliation path

**Devices and permissions**

1. Deny camera permission → a clear prompt, not a crash
2. No microphone attached → handled gracefully
3. Switch input device mid-call
4. Join from mobile → check the responsive layout

**Configuration**

1. Unset `LIVEKIT_API_KEY` → `/api/calls/health` reports the problem and the
   UI degrades rather than throwing
2. Cross `LIVEKIT_HOST` and `NEXT_PUBLIC_LIVEKIT_URL` → confirm the error is
   diagnosable

## Not implemented

`CallRecording` exists in the schema and the `MINIO_*` variables are present,
but **recording is not built**. See
[Known limitations](../operations/known-limitations.md).

## Demo

:::info Video coming soon
A 1:1 call with screen sharing, then a three-person group call.
:::

{/* <iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID"
  title="Voice and video calls" frameBorder="0" allowFullScreen></iframe> */}
