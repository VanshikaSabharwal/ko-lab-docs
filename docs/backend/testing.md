---
sidebar_position: 4
title: Testing
---

# Backend testing

See [Testing](../getting-started/testing.md) for setup. This page covers
route handlers and data access.

## What exists

Nineteen files under `apps/web/__tests__/api/`, of which eleven cover calls:

```
__tests__/api/
├── calls/
│   ├── initiate, token, accept, reject, end
│   ├── livekit-webhook, push-subscribe, health
│   ├── livekit-lib, env-validation, prisma-models
├── file-content, file-chunk, file-download
├── notifications, trash, memberEvents
```

```bash
cd apps/web
npx vitest run __tests__/api
```

## Testing a route handler

Import the handler directly and hand it a `Request`. No server needed.

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notifications: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/api/notifications/route";

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns notifications for a user", async () => {
    vi.mocked(prisma.notifications.findMany).mockResolvedValue([
      { id: "n1", userId: "u1", read: false },
    ] as never);

    const res = await GET(
      new Request("http://localhost/api/notifications?userId=u1"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.notifications).toHaveLength(1);
  });

  it("rejects a missing userId", async () => {
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });
});
```

### Cover the failure paths

The happy path rarely breaks. These are where route bugs live:

| Case | Expected |
|---|---|
| Required param missing | 400 |
| Caller not signed in | 401 |
| Signed in, not a member | 403 |
| Record does not exist | 404 |
| Prisma throws | 500, and no stack trace leaked to the client |

```ts
it("returns 500 without leaking internals", async () => {
  vi.mocked(prisma.notifications.findMany).mockRejectedValue(
    new Error("connection refused at 10.0.0.5:5432"),
  );

  const res = await GET(
    new Request("http://localhost/api/notifications?userId=u1"),
  );

  expect(res.status).toBe(500);
  expect(JSON.stringify(await res.json())).not.toContain("10.0.0.5");
});
```

### POST bodies

```ts
const res = await POST(
  new Request("http://localhost/api/create-group-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Team", ownerId: "u1" }),
  }),
);
```

### Sessions

```ts
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => ({ user: { id: "u1" } })),
}));
```

Test the unauthenticated case too — mock it returning `null` and assert 401.

## External services

Never reach a real service from a test.

```ts
// LiveKit
vi.mock("livekit-server-sdk", () => ({
  AccessToken: vi.fn(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn(() => "fake.jwt"),
  })),
}));

// Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(() => ({
    repos: { getContent: vi.fn().mockResolvedValue({ data: [] }) },
  })),
}));

// S3
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: vi.fn().mockResolvedValue({}) })),
  PutObjectCommand: vi.fn(),
}));
```

`__tests__/api/calls/env-validation.test.ts` is a good model for asserting
that a route fails cleanly when its configuration is absent.

## Manual API testing

```bash
# Health
curl -s http://localhost:3000/api/calls/health | jq

# Authenticated — copy the session cookie from devtools
curl -s http://localhost:3000/api/my-groups \
  -H "Cookie: next-auth.session-token=<token>" | jq

# POST
curl -s -X POST http://localhost:3000/api/create-group-data \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{"name":"Test group"}' | jq
```

### Checking authorization by hand

Worth doing on any route that touches group data, because this is not
uniformly enforced:

1. Sign in as user A, note a `groupId` they own
2. Sign in as user B in another profile, who is **not** a member
3. Call the route as B with A's `groupId`
4. A 200 with real data is a bug — expected is 403

## Database-level checks

```bash
cd apps/web
npx prisma studio              # browse
npx prisma migrate status      # drift check
npx prisma validate            # schema syntax
```

After a migration, confirm both directions: apply it to a copy of production
data, and verify the rollback path exists before deploying.

## Gaps

No tests currently cover auth flows, VCS and change requests, group
membership and `codeAccess`, or the WebSocket server. The change-request
approval path and the `codeAccess` state machine are the two highest-value
additions — both gate writes to a real GitHub repository.
