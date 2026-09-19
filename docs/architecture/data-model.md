---
sidebar_position: 2
title: Data model
---

# Data model

**34 models, 12 enums**, at `apps/web/prisma/schema.prisma` (673 lines).

:::note The old README said 19 models
It listed 19 and placed the schema in `packages/db`. There are 34, and
`packages/db` is empty.
:::

## Authentication

| Model | Purpose |
|---|---|
| `User` | Core identity |
| `Account` | OAuth links (NextAuth) |
| `Session` | Active sessions |
| `VerificationToken` | Email verification |
| `Otp` | One-time codes — **legacy, flow not wired up** |

## Social

| Model | Purpose |
|---|---|
| `Friendship` | User connections |
| `Chat` | DM conversations |
| `Messages` | DM contents |
| `Testimonial` | Landing page quotes |

## Groups

| Model | Purpose |
|---|---|
| `Group` | Team, optional `githubRepo` |
| `GroupMember` | Membership, `role`, `codeAccess` |
| `GroupMessage` | Group chat |
| `Invite` | Email invitations |
| `GroupInviteLink` | Tokenised join links |
| `GuestUser`, `GuestGroup` | Limited guest access |

```prisma
enum GroupRole { OWNER  ADMIN  MEMBER }

enum CodeAccessStatus {
  NONE            // no repository access
  PENDING_GITHUB  // awaiting collaborator invite
  INVITED         // invite sent, unaccepted
  ACTIVE          // full access
}
```

`codeAccess` is the gate on repository writes. Only `ACTIVE` may commit.

## Files & version control

| Model | Purpose |
|---|---|
| `File` | Tracked repository files |
| `ModifiedFiles` | Working-tree changes |
| `Change` | Individual edits |
| `ChangeRequest` | Review unit |
| `ApprovedCr`, `RejectedCr` | Review outcomes |

```prisma
enum ChangeRequestStatus { OPEN  MERGED  REJECTED  CONFLICT }
enum FileStatus { /* tracked file lifecycle */ }
```

`CONFLICT` is set when the base SHA moved between raising and merging a CR.

## Workspace

| Model | Purpose |
|---|---|
| `WorkspaceBoard` | JSON `{ nodes, edges }` for graph boards |
| `PlanningColumn` | Kanban columns |
| `PlanningTask` | Tasks |
| `PlanningTaskDependency` | Task edges — **must stay acyclic** |
| `PlanningAssignee` | Task assignment |
| `PlanningMilestone` | Timeline milestones |

```prisma
enum WorkspaceBoardType { MIND_MAP  PLANNING  DB_SCHEMA  UI_DESIGN }
enum PlanningPriority { /* task priority */ }
```

Two storage strategies live side by side: the three graph boards store a JSON
document on `WorkspaceBoard`, while planning uses real relational tables.
The graph boards need whole-document replacement anyway; planning needs
per-task queries and assignment, which JSON would make painful.

## Calls

| Model | Purpose |
|---|---|
| `CallRoom` | A call: room name, type, status, initiator |
| `CallParticipant` | Per-user: joined/left, muted, video, screen sharing |
| `CallRecording` | **Schema only — not implemented** |
| `PushSubscription` | Web Push endpoints |

```prisma
enum CallStatus { RINGING  ONGOING  ENDED  MISSED  REJECTED }
enum CallType { /* 1:1 or group */ }
enum RecordingStatus { /* unused */ }
```

## Other

| Model | Purpose |
|---|---|
| `Notifications` | In-app feed |
| `BugReport` | Reports that become GitHub issues |

```prisma
enum BugStatus { … }
enum BugSeverity { … }
enum BugCategory { … }
```

## Relationships

```
User ─┬─ GroupMember ─── Group ─┬─ GroupMessage
      │                         ├─ WorkspaceBoard
      │                         ├─ PlanningTask ─── PlanningTaskDependency
      │                         ├─ ChangeRequest ─┬─ ApprovedCr
      │                         │                 └─ RejectedCr
      │                         └─ CallRoom ────── CallParticipant
      ├─ Account / Session
      ├─ Friendship
      ├─ Chat ─── Messages
      └─ Notifications
```

`Group` is the hub. Most queries start from a `groupId` and a membership
check — which is exactly why authorization bugs in this codebase tend to be
missing membership checks rather than broken ones.

## Working with the schema

```bash
cd apps/web
npx prisma studio                          # browse
npx prisma migrate dev --name <name>       # new migration
npx prisma generate                        # regenerate the client
npx prisma validate                        # syntax check
npx prisma migrate status                  # drift check
```

Always regenerate after a schema edit, or TypeScript will not see new
fields. Review generated SQL before committing — Prisma will write a
destructive migration if the change implies one.

## Dead schema

| Model / enum | Why it is here |
|---|---|
| `Otp` | OTP sign-in, no longer wired up |
| `CallRecording`, `RecordingStatus` | Recording specced, never built |

Neither is harmful, but both mislead. See
[Known limitations](../operations/known-limitations.md).
