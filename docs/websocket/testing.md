---
sidebar_position: 4
title: Testing
---

# WebSocket testing

:::warning No automated tests exist
`apps/web-socket` has **no test suite** — no test files, no test script. All
261 tests live in `apps/web`. Everything below is either manual, or a
suggestion for tests worth adding.
:::

## Manual testing with wscat

```bash
npm install -g wscat
```

### Health

```bash
curl http://localhost:8080/health
```

### Guards

Each of these should fail, and failing is the pass condition:

```bash
# No token → closes immediately
npx wscat -c "ws://localhost:8080/ws"

# Bad origin → rejected at handshake
npx wscat -c "ws://localhost:8080/ws" -o "http://evil.example.com"

# Expired token → closes (wait >300s after minting)
npx wscat -c "ws://localhost:8080/ws?token=<stale>"
```

Check the server log for `🚫 Rejected WS connection from unauthorized origin`.

### A real session

Get a token from the browser — sign in, then in devtools:

```js
await fetch("/api/ws-token").then((r) => r.json());
```

```bash
npx wscat -c "ws://localhost:8080/ws?token=<token>" -o http://localhost:3000

> {"type":"join_group","groupId":"<groupId>"}
< {"type":"joined_group","groupId":"<groupId>"}

> {"type":"message","groupId":"<groupId>","content":"hello"}
```

Open the group in a browser at the same time — the message should appear
there.

### Rate limit

```bash
# 20 rapid frames; the connection should close partway
for i in $(seq 1 20); do
  echo "{\"type\":\"message\",\"groupId\":\"g1\",\"content\":\"$i\"}"
done | npx wscat -c "ws://localhost:8080/ws?token=<token>" -o http://localhost:3000
```

### Size limit

```bash
# ~9 KB — over the 8 KB cap
node -e '
const big = "x".repeat(9000);
console.log(JSON.stringify({type:"message",groupId:"g1",content:big}));
' | npx wscat -c "ws://localhost:8080/ws?token=<token>" -o http://localhost:3000
```

### Connections per IP

Open six `wscat` sessions from one machine. The sixth should be refused —
the cap is 5.

This one matters in practice: a developer with several tabs plus a `wscat`
session can hit it accidentally and misread it as a bug.

## Git endpoints

```bash
SECRET=<GIT_SERVICE_SECRET>

curl -X POST http://localhost:8080/git/ensure \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"g1","repoUrl":"https://github.com/owner/repo","branch":"main"}'

curl -X POST http://localhost:8080/git/content \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"g1","branch":"main","path":""}'
```

### Path traversal — test this

`safeResolve` (`gitWorkspace.ts:26`) is the guard. Confirm it holds:

```bash
curl -G http://localhost:8080/git/file \
  -H "Authorization: Bearer $SECRET" \
  --data-urlencode "groupId=g1" \
  --data-urlencode "branch=main" \
  --data-urlencode "path=../../../../etc/passwd"
```

Anything other than an error is a serious vulnerability. Try the encoded
variants too — `%2e%2e%2f`, and a leading `/`.

## Realtime behaviour

Needs two browser profiles signed in as different users in one group.

| Check | Expected |
|---|---|
| A sends a message | Appears for B in ~1s |
| A moves a board node | B sees it move |
| A moves the mouse | B sees A's cursor with their name |
| Kill the WS server | Both show an offline state |
| Restart it | Both reconnect and resync |
| A edits while offline, returns | Board converges |
| Both drag the same node | Last write wins, no crash |

## Suggested automated tests

The service has no suite; these would be the first ones worth writing.

**Token verification** — pure and easy to test:

```ts
import { describe, expect, it } from "vitest";
import { verifyWsToken } from "../src/wsToken";
import { signWsToken } from "../../web/app/lib/wsToken";

describe("verifyWsToken", () => {
  it("accepts a freshly signed token", () => {
    const token = signWsToken("u1", ["g1"], 300);
    expect(verifyWsToken(token)?.userId).toBe("u1");
  });

  it("rejects a tampered payload", () => {
    const token = signWsToken("u1", ["g1"], 300);
    const [payload, sig] = token.split(".");
    expect(verifyWsToken(`${payload}x.${sig}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signWsToken("u1", ["g1"], -1);
    expect(verifyWsToken(token)).toBeNull();
  });
});
```

**`safeResolve`** — the traversal guard deserves a test per attack shape:

```ts
it("rejects traversal outside the workspace", () => {
  expect(() => safeResolve("/ws/g1/main", "../../etc/passwd")).toThrow();
  expect(() => safeResolve("/ws/g1/main", "/etc/passwd")).toThrow();
});

it("allows a normal path", () => {
  expect(safeResolve("/ws/g1/main", "src/index.ts")).toBe("/ws/g1/main/src/index.ts");
});
```

**`withGroupLock`** — assert that two concurrent calls serialise rather than
interleave.

Rate limiting and origin rejection can be tested with a real `ws` client
against a server started on an ephemeral port.
