---
sidebar_position: 3
title: Protocol
---

# Message protocol

All frames are JSON with a `type` discriminator:

```json
{ "type": "message", "groupId": "…", "content": "…" }
```

Messages over **8 KB** are rejected, and more than **10 per second** closes
the connection.

## Membership

| Type | Direction | Payload |
|---|---|---|
| `join_group` | client → server | `groupId` |
| `joined_group` | server → client | `groupId` |
| `leave_group` | client → server | `groupId` |

A client must `join_group` before it receives anything for that group. The
token carries the user's memberships, so joining a group they do not belong
to is refused.

## Chat

| Type | Direction | Payload |
|---|---|---|
| `message` | both | `groupId`, `content`, `senderId`, `timestamp` |
| `message_delivered` | server → client | `messageId` |

Sending a message does two things in parallel: a `POST` to
`/api/save-group-message` for durability, and a WS frame for immediacy. If
the HTTP call fails, the message appears live but vanishes on reload — worth
remembering when debugging "disappearing messages".

## Workspace boards

| Type | Direction | Payload |
|---|---|---|
| `workspace_op` | both | `groupId`, `boardType`, operation payload |
| `workspace_presence` | both | `groupId`, `userId`, cursor position |

`workspace_op` is the broadcast channel for board edits — node moves,
creations, deletions, grouping. The server relays to everyone in the group
except the sender; it does not interpret or validate the operation.

`workspace_presence` carries live cursors and is sent at a much higher rate,
so it is throttled client-side. Presence is never persisted.

:::note Last write wins
There is no operational transform or CRDT. Two users dragging the same node
simultaneously produce a brief flicker and the later write survives. This is
acceptable for the current boards but would not survive collaborative text
editing.
:::

## Call signalling

| Type | Direction | Payload |
|---|---|---|
| `call_offer` | client → server | `groupId`, `calleeId`, `callId` |
| `call_offered` | server → client | Incoming call notification |
| `call_accepted` | both | `callId` |
| `call_rejected` | both | `callId` |
| `call_ended` | both | `callId` |
| `call_missed` | server → client | `callId` |

Signalling only — **no media flows over this socket**. Once both sides accept,
they connect to LiveKit directly with tokens minted by `/api/calls/token`.
See [Voice & video](../features/voice-video.md).

## Client usage

The app wraps this in hooks rather than using raw sockets:

```ts
// apps/web/app/workspace/lib/useWorkspaceSocket.ts
const { send, connected } = useWorkspaceSocket({
  groupId,
  onMessage: (msg) => {
    if (msg.type === "workspace_op") applyRemoteOp(msg);
    if (msg.type === "workspace_presence") updateCursor(msg);
  },
});
```

The hook handles token fetching, reconnect with backoff, and re-joining
groups after a drop.

## Reconnection

Tokens expire after 300 seconds, so the client cannot simply reuse one:

1. Socket closes
2. Client requests a fresh token from `apps/web`
3. Reconnects to `/ws`
4. Re-sends `join_group` for every active group

Board state is reloaded over HTTP after a reconnect rather than replayed —
there is no operation log, so any ops missed while disconnected are lost.
Reloading is what makes the board converge again.

## Adding a message type

1. Add the case to the handler in `apps/web-socket/src/index.ts`
2. Validate the payload — the server currently trusts most fields
3. Decide the fan-out: sender-excluded broadcast, whole group, or one user
4. Handle it in the client hook
5. Document it here

Keep new types small. The 8 KB cap applies to every frame, and board
operations are already the largest thing on the wire.
