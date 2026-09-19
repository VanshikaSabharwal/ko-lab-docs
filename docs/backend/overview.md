---
sidebar_position: 1
title: Overview
---

# Backend

## Description

The backend is **Next.js API routes** inside `apps/web/app/api/`, backed by
**Prisma** and **PostgreSQL**. There is no separate backend server — the same
deployment serves UI and API. The one exception is the git microservice, which
lives in [the WebSocket app](../websocket/overview.md).

## Stack

| Concern | Choice |
|---|---|
| Runtime | Next.js 14 route handlers (Node) |
| ORM | Prisma 5 |
| Database | PostgreSQL |
| Auth | NextAuth v4, JWT sessions |
| Storage | S3-compatible (LocalStack / R2 / AWS) |
| AI | Groq |
| Media | LiveKit server SDK |
| GitHub | Octokit |

## Route groups

~40 route directories. Grouped by domain:

| Group | Routes |
|---|---|
| **Auth** | `auth/[...nextauth]`, `auth/signup`, `auth/send-otp`, `auth/setcookie` |
| **Groups** | `groups`, `groups/[groupId]`, `my-groups`, `create-group-data`, `add-group-member`, `check-group-member`, `send-invite`, `guest-mode` |
| **Chat** | `save-group-message`, `direct-message`, `direct-message/unread` |
| **Users** | `profile`, `profile/avatar`, `check-user`, `check-phone-number`, `lookup-user`, `get-user-id`, `get-user-number`, `set-phone`, `friends`, `friend-search` |
| **GitHub** | `github/link`, `github/status`, `github/collaborator`, `github/invitations` |
| **Files** | `files`, `file-content`, `file-chunk`, `file-download`, `delete-file`, `save-coding-files`, `trash` |
| **VCS** | `vcs/branches`, `vcs/base-sha`, `vcs/change-request`, `vcs/merge`, `vcs/reject`, `vcs/reconnect`, `change-request`, `commit-changes`, `modified-files`, `rejected-cr` |
| **Workspace** | `workspace/[groupId]/{ui-design,mind-map,db-schema,planning}` |
| **Calls** | `calls/initiate`, `calls/token`, `calls/[id]`, `calls/livekit-webhook`, `calls/push-subscribe`, `calls/health` |
| **Misc** | `notifications`, `bug-report`, `generate-readme`, `testimonial-card`, `group-live-url` |

Full detail in the [API reference](./api-reference.md).

## Route handler shape

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId required" },
      { status: 400 },
    );
  }

  const notifications = await prisma.notifications.findMany({
    where: { userId },
  });

  return NextResponse.json({ success: true, notifications });
}
```

Responses consistently carry a `success` boolean, which the client checks
before reading data.

## Shared library modules

`apps/web/app/lib/` holds the cross-cutting pieces. Reuse these rather than
reimplementing:

| Module | Responsibility |
|---|---|
| `prisma.ts` | Client singleton — avoids exhausting connections in dev |
| `apiAuth.ts` | Session and permission checks for handlers |
| `encryption.ts` | AES-256-CBC for GitHub tokens at rest |
| `wsToken.ts` | Mints short-lived HMAC tokens for the WS service |
| `livekit.ts` | Call access tokens |
| `s3.ts` | Object storage |
| `vcs.ts`, `vcsLimits.ts` | Branch/diff/merge, with size guards |
| `gitClient.ts` | Talks to the git microservice |
| `githubCollaborator.ts`, `githubFiles.ts`, `githubLink.ts` | Octokit wrappers |
| `draftStore.ts` | Unsaved editor drafts |
| `memberEvents.ts`, `systemMessages.ts` | Membership events → chat messages |

## Database

PostgreSQL via Prisma. The schema lives at **`apps/web/prisma/schema.prisma`**
— 673 lines, **34 models, 12 enums**.

:::warning `packages/db` is empty
Despite the name and the old README's claim, `packages/db` contains no schema
and no source. It is a leftover husk. The schema is in `apps/web/prisma/`.
:::

See the [data model](../architecture/data-model.md) for a domain breakdown.

## Next

- **[Setup](./setup.md)** — database, migrations, seeds
- **[API reference](./api-reference.md)** — routes in detail
- **[Testing](./testing.md)** — handler tests with mocked Prisma
