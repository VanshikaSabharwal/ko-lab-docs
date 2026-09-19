---
sidebar_position: 4
title: Code editor, VCS & GitHub
---

# Code editor, VCS & GitHub

## Description

An in-browser IDE over a group's linked repository, with a review workflow
layered on top. A member edits files, commits to a branch, and raises a
**change request**; the group owner reviews the diff and merges or rejects.
Changes reach GitHub only through that gate.

Includes a **Groq-backed AI assistant** for explaining and editing code, and
README generation.

## Setup

```env
# GitHub OAuth with `repo` scope
GITHUB_ID=...
GITHUB_SECRET=...

# Encrypts stored access tokens — 64 hex chars
ENCRYPTION_KEY=...

# Git microservice
GIT_SERVICE_URL=http://localhost:8080
GIT_SERVICE_SECRET=...

# AI assistant (optional)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

The [WebSocket service](../websocket/overview.md) must be running — it hosts
the git microservice that reads repository files.

Then, in the app: link a repo at `/github`, and grant members code access.

## Integration

```
Frontend                    Backend                    Git service
────────                    ───────                    ───────────
/code-editor/[g]/[repo]
  ├─ file tree ───────────► GET /api/files ──────────► POST /git/content
  ├─ open file ──────────► GET /api/file-content ───► GET  /git/file
  ├─ edit ────────────────► draftStore (S3)
  ├─ commit ─────────────► POST /api/commit-changes
  └─ raise CR ───────────► POST /api/vcs/change-request
                                    │
/confirm-changes/[g]                ▼
  ├─ diff ───────────────► GET  /api/modified-files
  ├─ approve ────────────► POST /api/vcs/merge ──────► GitHub
  └─ reject ─────────────► POST /api/vcs/reject
```

## Code access

`CodeAccessStatus` is a four-state machine on `GroupMember`:

```prisma
enum CodeAccessStatus {
  NONE            // no repository access
  PENDING_GITHUB  // awaiting a GitHub collaborator invite
  INVITED         // invite sent, not yet accepted
  ACTIVE          // full access
}
```

Only `ACTIVE` members can commit. The transitions matter: an owner grants
access, Ko-Lab sends a GitHub collaborator invitation via
`lib/githubCollaborator.ts`, and the member becomes `ACTIVE` only once
GitHub confirms acceptance.

:::danger This state machine has no tests
It gates writes to a real repository and is entirely uncovered. See
[Testing](#testing).
:::

## Change requests

```prisma
enum ChangeRequestStatus {
  OPEN
  MERGED
  REJECTED
  CONFLICT
}
```

`CONFLICT` is set when the base SHA has moved since the CR was raised —
`/api/vcs/base-sha` captures it at creation, and the merge path compares
before applying.

## How it works

### Tokens are encrypted at rest

GitHub access tokens are stored encrypted with AES-256-CBC
(`apps/web/app/lib/encryption.ts`), keyed by `ENCRYPTION_KEY`:

```ts
const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
```

Rotating that key invalidates every stored token and forces all users to
reconnect GitHub.

:::danger Hardcoded fallback key
`encryption.ts:5-6` falls back to a **key committed in the repository** when
`ENCRYPTION_KEY` is unset. Tokens encrypted under it are effectively
plaintext. Always set the variable explicitly.
:::

### Git operations are serialised per group

Clones live at `workspaces/<groupId>/<branch>/`. Concurrent operations on one
working directory corrupt it, so every mutating path goes through
`withGroupLock` (`apps/web-socket/src/gitWorkspace.ts:11`).

### Path traversal is guarded

`safeResolve` (`gitWorkspace.ts:26`) resolves a requested path and rejects
anything escaping the workspace root. This is the only thing standing between
a crafted `path` parameter and the host filesystem — see the
[traversal test](../websocket/testing.md#path-traversal--test-this).

### Drafts

Unsaved edits go to `DRAFT_BUCKET` via `lib/draftStore.ts`, so a reload does
not lose work. Drafts are per user and per file, and are cleared on commit.

## Testing

### Automated

**None.** This is the largest untested surface in the codebase. Nothing
covers code access, change requests, merges, or GitHub integration.

Three tests worth writing first, in priority order:

**1. The `codeAccess` gate** — it protects repository writes:

```ts
describe("POST /api/commit-changes", () => {
  it.each(["NONE", "PENDING_GITHUB", "INVITED"])(
    "rejects a commit from a member with codeAccess=%s",
    async (status) => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        userId: "u2", groupId: "g1", codeAccess: status,
      } as never);

      const res = await POST(commitRequest({ groupId: "g1", userId: "u2" }));
      expect(res.status).toBe(403);
    },
  );

  it("allows a commit from an ACTIVE member", async () => { /* … */ });
});
```

**2. Merge authorization** — only the owner should merge:

```ts
it("rejects a merge by a non-owner", async () => {
  const res = await POST(mergeRequest({ crId: "cr1", callerId: "notOwner" }));
  expect(res.status).toBe(403);
});
```

**3. Conflict detection** — a moved base SHA must not merge silently:

```ts
it("marks the CR CONFLICT when the base SHA has moved", async () => {
  // CR created at sha A; branch now at sha B
  const res = await POST(mergeRequest({ crId: "cr1" }));
  expect((await res.json()).status).toBe("CONFLICT");
});
```

### Manual

Needs a real GitHub repo you can safely write to. **Use a throwaway repo** —
these flows create branches and commits.

**Linking**

1. Sign in with GitHub, open `/github`
2. Link a repository to a group
3. `/api/github/status` reports connected
4. Confirm the token is stored encrypted — inspect the row in Prisma Studio
   and verify it is not readable plaintext

**Editor**

1. Open `/code-editor/<groupId>/<repo>`
2. File tree loads — this exercises the git service
3. Open a file → syntax highlighting matches the language
4. Edit, reload the page → the draft survives
5. Open a large file → check the chunked path, not a hang
6. Open a binary file → handled gracefully, not rendered as text

**Access control** — the important one

1. As owner, grant B code access → B becomes `PENDING_GITHUB`, then `INVITED`
2. B accepts the GitHub invitation → `ACTIVE`
3. As a `NONE` member, attempt a commit → must fail with 403
4. As `INVITED` (not yet accepted), attempt a commit → must fail
5. Revoke access → the next commit fails

Steps 3–5 are the ones to re-run after any change near this code, since
nothing automated protects it.

**Change request flow**

1. B (ACTIVE) edits a file, commits to a branch
2. B raises a change request
3. Owner sees it at `/confirm-changes/<groupId>`
4. The diff renders correctly
5. Approve → verify the commit lands on GitHub
6. Reject with a reason → B sees it in `/notifications` and `/rejected-cr`

**Conflicts**

1. B raises a CR from base SHA A
2. Push a separate commit to the same branch directly on GitHub
3. Owner attempts the merge → status becomes `CONFLICT`, nothing is silently
   overwritten

**AI assistant**

1. Select code, ask the assistant to explain it
2. Ask for an edit → the proposal is reviewable before applying
3. Unset `GROQ_API_KEY` → the feature degrades with a clear message rather
   than crashing
4. `POST /api/generate-readme` produces sensible output

**Security checks**

1. Path traversal through the file endpoints — see
   [WebSocket testing](../websocket/testing.md#path-traversal--test-this)
2. Request another group's `groupId` as a non-member → must be refused
3. Confirm no access token appears in any API response or client bundle

## Demo

:::info Video coming soon
Editing a file, raising a change request, and merging it to GitHub.
:::

{/* <iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID"
  title="Code editor and VCS" frameBorder="0" allowFullScreen></iframe> */}
