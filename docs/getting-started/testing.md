---
sidebar_position: 5
title: Testing
---

# Testing

Ko-Lab uses **Vitest** with jsdom and Testing Library. As of writing:
**31 test files, 261 tests, all passing** in ~70 seconds.

```bash
cd apps/web

npm test              # one run
npm run test:watch    # watch mode
npm run test:coverage # with coverage
```

:::warning Use Vitest, not Jest
The runner is Vitest. `npx jest` fails on all 31 files with ESM/CommonJS
errors — it is not the configured runner, and those failures mean nothing.
:::

## Configuration

`apps/web/vitest.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./__tests__/setup.ts"],
    environment: "jsdom",
    globals: true,
    include: ["__tests__/**/*.test.{ts,tsx}"],
    alias: { "@": path.resolve(__dirname, "./app") },
  },
});
```

`globals: true` means `describe`/`it`/`expect` need no import, though existing
tests import them explicitly anyway.

## Layout

```
apps/web/__tests__/
├── setup.ts                 # global setup
├── api/                     # route handler tests
│   ├── calls/               # 11 files — the call system
│   ├── notifications.test.ts
│   └── trash.test.ts
├── components/              # React component tests
│   └── CallUI, CallProvider, TrashPanel, …
└── workspace/               # pure-logic tests
    ├── dependencyCycle.test.ts
    ├── timelineScale.test.ts
    └── monthGrid.test.ts
```

Three tiers, roughly: pure logic (`workspace/`), route handlers (`api/`), and
rendered components (`components/`).

## Running a subset

```bash
npx vitest run __tests__/workspace          # a directory
npx vitest run dependencyCycle              # by name fragment
npx vitest run -t "rejects a longer loop"   # a single test
```

---

## Writing tests

### Pure logic — the cheapest and most valuable

Extract the rule, then test it directly. `wouldCreateCycle` guards the
planning graph against loops, and
`__tests__/workspace/dependencyCycle.test.ts` covers it without touching React
or the database:

```ts
import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "../../app/api/workspace/[groupId]/planning/_shared";

describe("wouldCreateCycle", () => {
  it("allows a chain to extend", () => {
    const edges = [{ blockerId: "a", dependentId: "b" }];
    expect(wouldCreateCycle(edges, "b", "c")).toBe(false);
  });

  it("rejects a longer loop closing back to the start", () => {
    const edges = [
      { blockerId: "a", dependentId: "b" },
      { blockerId: "b", dependentId: "c" },
    ];
    expect(wouldCreateCycle(edges, "c", "a")).toBe(true);
  });
});
```

Note the comment style in the real file: it explains *why* the invariant
matters (a cycle makes graph traversal non-terminating), not just what the
assertion does.

### Route handlers

Import the handler and call it with a `Request`. Mock Prisma so nothing
touches a live database:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notifications: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/api/notifications/route";

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns notifications for a user", async () => {
    vi.mocked(prisma.notifications.findMany).mockResolvedValue([
      { id: "n1", userId: "u1" },
    ] as never);

    const res = await GET(
      new Request("http://localhost/api/notifications?userId=u1"),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("rejects a missing userId", async () => {
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(400);
  });
});
```

Always cover the failure paths — missing params, unauthorised callers, and
not-found. Those are where route bugs actually live.

### Components

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardToolbar from "@/workspace/[groupId]/ui-design/BoardToolbar";

describe("BoardToolbar", () => {
  it("disables Group until two nodes are selected", () => {
    render(<BoardToolbar canGroup={false} onGroup={vi.fn()} /* … */ />);
    expect(screen.getByTitle(/Group selection/)).toBeDisabled();
  });

  it("calls onGroup when clicked", () => {
    const onGroup = vi.fn();
    render(<BoardToolbar canGroup onGroup={onGroup} /* … */ />);
    fireEvent.click(screen.getByTitle(/Group selection/));
    expect(onGroup).toHaveBeenCalledOnce();
  });
});
```

Query by what the user perceives — role, label, title — rather than by CSS
class, so refactoring styles does not break tests.

### Mocking external services

```ts
// LiveKit — never hit a real SFU in tests
vi.mock("livekit-server-sdk", () => ({
  AccessToken: vi.fn(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn(() => "fake.jwt.token"),
  })),
}));

// S3
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: vi.fn().mockResolvedValue({}) })),
  PutObjectCommand: vi.fn(),
}));

// WebSocket
class MockWebSocket {
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
}
vi.stubGlobal("WebSocket", MockWebSocket);
```

---

## Manual testing

Automated tests do not cover realtime collaboration, drag interactions, or
media. These need two browsers and a human.

### Realtime — the two-window rule

Anything collaborative must be verified with **two browser windows in
different profiles** (or one normal, one incognito), signed in as different
users in the same group.

<details>
<summary>Group chat</summary>

1. Both windows open the same group
2. Send from A → appears in B within ~1s, no refresh
3. Kill the WS server → the offline indicator appears
4. Restart it → reconnects and backfills
5. Confirm delivery receipts update
</details>

<details>
<summary>Workspace boards</summary>

1. Both open `/workspace/<groupId>/ui-design`
2. A drops a component → appears for B
3. Move the mouse in A → B sees A's live cursor with their name
4. Both edit **different** nodes at once → no lost updates
5. Both drag the **same** node → last write wins, no crash or desync
6. A goes offline, edits, comes back → state converges
7. Reload both → the board persists identically
</details>

<details>
<summary>Voice & video</summary>

Needs real devices; cannot be automated meaningfully.

1. A calls B → B sees the incoming UI and hears a ring
2. Accept → two-way audio and video
3. Mute, camera off, screen share — each reflected on the far side
4. Third participant joins → all three see each other
5. Network drop → reconnect behaviour
6. Decline, and unanswered-timeout, both land in notifications
</details>

<details>
<summary>Code editor & VCS</summary>

1. Open a repo-linked group's editor
2. Edit a file → draft persists across reload
3. Create a branch, commit, raise a change request
4. As the owner, review the diff and approve → verify the commit on GitHub
5. Reject with a reason → the author sees it in notifications
6. Confirm a member **without** code access cannot commit
</details>

### Accessibility and responsive

- Keyboard-only: tab through, confirm focus is always visible
- Dark **and** light mode on every page — the app defaults to dark, and
  light-mode contrast bugs are the common regression
- 320 px, 768 px, 1440 px widths
- Zoom to 200%

---

## CI

There is no CI workflow in the repo yet. A minimal one:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run db:web
      - run: cd apps/web && npm test
      - run: npx tsc --noEmit
        working-directory: apps/web
      - run: npm run lint
```

## Gaps worth closing

| Area | State |
|---|---|
| Call system | Well covered — 11 files |
| Workspace pure logic | Good — cycles, timeline, grid |
| File handling | Covered — chunking, download, trash |
| **Auth flows** | **No tests** |
| **VCS / change requests** | **No tests** |
| **Group membership & access** | **No tests** |
| **WebSocket server** | **No tests** — `apps/web-socket` has no suite |
| **End-to-end** | None — no Playwright or Cypress |

The highest-value additions would be the `codeAccess` state machine and the
change-request approval path: both gate repository writes, and both are
currently unguarded by any test.
