---
sidebar_position: 2
title: Groups, chat & notifications
---

# Groups, chat & notifications

## Description

A **group** is the unit of collaboration: a team, optionally bound to a
GitHub repository. Everything else in Ko-Lab hangs off one. Groups carry
members with roles, a chat channel, workspace boards, and — once linked — a
repository with per-member code access.

Alongside group chat there are 1:1 **direct messages**, and a
**notification centre** that collects membership events, change-request
outcomes and missed calls.

## Setup

Needs only the database and a working WebSocket connection:

```env
DATABASE_URL=postgresql://...
WS_AUTH_SECRET=<shared with apps/web-socket>
NEXT_PUBLIC_WEB_SOCKET_URL=ws://localhost:8080/ws
WS_ALLOWED_ORIGINS=http://localhost:3000
```

Email invites additionally need SMTP, but link invites work without it.

## Integration

```
Frontend                 Backend                  WebSocket
────────                 ───────                  ─────────
/groups               ─► GET /api/my-groups
/create-group         ─► POST /api/create-group-data
/group/[groupId]      ─► GET /api/groups/[id]
  │                                                  │
  ├─ send message ────► POST /api/save-group-message │
  │                       (durability)               │
  └─ send message ─────────────────────────────────► │ {type:"message"}
                                                     │  broadcast
/notifications        ─► GET /api/notifications
```

Note the **dual path** for a message: HTTP for persistence, WebSocket for
immediacy. Both must succeed.

## Data model

| Model | Purpose |
|---|---|
| `Group` | Name, owner, optional `githubRepo` |
| `GroupMember` | Membership, role, `codeAccess` |
| `GroupMessage` | Group chat history |
| `DirectMessage` | 1:1 messages |
| `Notifications` | In-app notification feed |
| `InviteLink` | Tokenised join links |

## How it works

### Messages take two paths

Sending does both at once, which is why a message can appear live and then
vanish on reload if the HTTP write failed:

```ts
// Persist
await fetch("/api/save-group-message", {
  method: "POST",
  body: JSON.stringify({ groupId, content, senderId }),
});

// Broadcast
send({ type: "message", groupId, content, senderId, timestamp: Date.now() });
```

When debugging "disappearing messages", check the network tab for a failed
`save-group-message` — the WebSocket half almost always worked.

### Membership events become chat messages

`apps/web/app/lib/memberEvents.ts` and `systemMessages.ts` turn joins, leaves
and role changes into system messages in the channel, so the chat doubles as
an audit trail. `__tests__/api/memberEvents.test.ts` covers this.

### Guest mode

`POST /api/guest-mode` grants limited access without a full account — useful
for showing a board to someone outside the team. Guests cannot commit code.

## Testing

### Automated

| File | Covers |
|---|---|
| `__tests__/api/memberEvents.test.ts` | Membership → system messages |
| `__tests__/api/notifications.test.ts` | Notification list |

Group creation, membership and invite flows have **no tests**. A worthwhile
first addition:

```ts
describe("POST /api/add-group-member", () => {
  it("rejects a caller who is not the group owner", async () => {
    // owner is u1; u2 attempts to add u3
    const res = await POST(
      new Request("http://localhost/api/add-group-member", {
        method: "POST",
        body: JSON.stringify({ groupId: "g1", userId: "u3", callerId: "u2" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
```

### Manual

Two browser profiles, signed in as different users.

**Group lifecycle**

1. A creates a group → appears in `/groups`
2. A invites B by link → B opens `/join/<token>` and lands in the group
3. B appears in `/viewMembers/<groupId>` for A
4. A system message announces the join in chat
5. A removes B → B loses access immediately

**Chat**

1. Both open the group
2. A sends → appears for B in ~1s with no refresh
3. Delivery receipt updates
4. Kill the WS server → offline indicator appears
5. Send while offline → queued or clearly failed, never silently lost
6. Restart the server → reconnects and backfills
7. Reload both → history matches

**Direct messages**

1. A messages B from `/chat`
2. B sees an unread badge
3. Opening the thread clears it
4. Verify `GET /api/direct-message/unread` matches the badge

**Notifications**

1. Trigger a membership change, a rejected CR and a missed call
2. Each appears in `/notifications`
3. Marking read persists across reload

### Edge cases worth checking

- A user in 10+ groups — does the group list stay responsive?
- A very long message — the WS cap is 8 KB
- Rapid sending — the rate limit is 10/s and will close the socket
- Two tabs as the same user — both should receive

## Demo

:::info Video coming soon
A walkthrough of group creation, invites and live chat.
:::

{/* Replace with the embed once recorded:
<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID"
  title="Groups and chat" frameBorder="0" allowFullScreen></iframe>
*/}
