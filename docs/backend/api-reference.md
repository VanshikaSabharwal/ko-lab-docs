---
sidebar_position: 3
title: API reference
---

# API reference

All routes live under `/api/`. Responses carry `{ success: boolean, … }`.

:::note Enumerated from the source
The previous README listed 21 routes; ~40 route directories exist on disk.
This page lists what is actually there. Request and response shapes are
summarised — read the handler for exact fields.
:::

## Authentication

| Method | Route | Purpose |
|---|---|---|
| `*` | `/api/auth/[...nextauth]` | NextAuth handler — GitHub and Google |
| `POST` | `/api/auth/signup` | Credentials sign-up |
| `POST` | `/api/auth/send-otp` | OTP email — **legacy, not wired up** |
| `POST` | `/api/auth/setcookie` | Session cookie helper |

## Groups

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/groups` | List groups |
| `GET` | `/api/groups/[groupId]` | Group detail |
| `GET` | `/api/my-groups` | Caller's groups |
| `POST` | `/api/create-group-data` | Create a group |
| `POST` | `/api/add-group-member` | Add a member |
| `GET` | `/api/check-group-member` | Membership check |
| `POST` | `/api/send-invite` | Email or link invite |
| `POST` | `/api/guest-mode` | Guest access |
| `GET` | `/api/group-live-url` | Live session URL |

## Chat

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/save-group-message` | Persist a group message |
| `GET`/`POST` | `/api/direct-message` | DM history and send |
| `GET` | `/api/direct-message/unread` | Unread counts by peer |

Messages persist over HTTP and broadcast over
[WebSocket](../websocket/protocol.md). Both paths must succeed for a message
to be both seen live and durable.

## Users

| Method | Route | Purpose |
|---|---|---|
| `GET`/`PATCH` | `/api/profile` | Read and update profile |
| `POST` | `/api/profile/avatar` | Avatar upload → S3 |
| `GET` | `/api/check-user` | Existence check |
| `GET` | `/api/check-phone-number` | Phone availability |
| `GET` | `/api/lookup-user` | Lookup by identifier |
| `GET` | `/api/get-user-id`, `/api/get-user-number` | Identity helpers |
| `POST` | `/api/set-phone` | Set phone number |
| `GET` | `/api/friends`, `/api/friend-search` | Social graph |

## GitHub

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/github/link` | Link a repo to a group |
| `GET` | `/api/github/status` | Connection status |
| `POST` | `/api/github/collaborator` | Invite as collaborator |
| `GET` | `/api/github/invitations` | Pending invitations |

Access tokens are encrypted at rest with `ENCRYPTION_KEY`.

## Files

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/files` | List repo files |
| `GET` | `/api/file-content` | Read a file |
| `POST` | `/api/file-chunk` | Chunked upload for large files |
| `GET` | `/api/file-download` | Download |
| `DELETE` | `/api/delete-file` | Delete |
| `POST` | `/api/save-coding-files` | Persist editor state |
| `GET`/`POST` | `/api/trash` | Soft-delete and restore |

## Version control

| Method | Route | Purpose |
|---|---|---|
| `GET`/`POST` | `/api/vcs/branches` | List and create branches |
| `GET` | `/api/vcs/base-sha` | Base commit for a diff |
| `POST` | `/api/vcs/change-request` | Raise a change request |
| `POST` | `/api/vcs/merge` | Merge an approved CR |
| `POST` | `/api/vcs/reject` | Reject with a reason |
| `POST` | `/api/vcs/reconnect` | Re-establish a workspace |
| `GET`/`POST` | `/api/change-request` | Legacy CR endpoint |
| `POST` | `/api/commit-changes` | Commit |
| `GET` | `/api/modified-files` | Working-tree changes |
| `GET` | `/api/rejected-cr` | Rejections for the caller |

Heavy git operations delegate to the [git
microservice](../websocket/overview.md#git-microservice).

## Workspace boards

| Method | Route | Purpose |
|---|---|---|
| `GET`/`PUT` | `/api/workspace/[groupId]/ui-design` | UI design board |
| `GET`/`PUT` | `/api/workspace/[groupId]/mind-map` | Mind map |
| `GET`/`PUT` | `/api/workspace/[groupId]/db-schema` | Schema designer |
| `GET`/`PUT` | `/api/workspace/[groupId]/planning` | Planning data |
| `*` | `/api/workspace/[groupId]/planning/tasks/[taskId]` | Task CRUD |

Graph boards store `{ nodes, edges }` as JSON on `WorkspaceBoard`. `PUT`
replaces the whole document, so the client debounces to avoid write storms.

## Calls

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/calls/initiate` | Start a call and notify the callee |
| `POST` | `/api/calls/token` | Mint a LiveKit access token |
| `GET`/`PATCH` | `/api/calls/[id]` | State: accept, reject, end |
| `POST` | `/api/calls/livekit-webhook` | LiveKit server events |
| `POST` | `/api/calls/push-subscribe` | Web Push registration |
| `GET` | `/api/calls/health` | Configuration sanity check |

The best-tested area of the codebase — 11 test files.

## Other

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/notifications` | Notification list |
| `GET`/`POST` | `/api/bug-report`, `/api/bug-report/[id]` | Bug reports → GitHub issues |
| `POST` | `/api/generate-readme` | Groq-generated README |
| `GET` | `/api/testimonial-card` | Landing page testimonials |

---

## Conventions

**Success**

```json
{ "success": true, "data": {} }
```

**Failure**

```json
{ "success": false, "error": "Human-readable reason" }
```

| Status | Meaning |
|---|---|
| 200 | OK |
| 400 | Missing or invalid input |
| 401 | Not signed in |
| 403 | Signed in but not permitted |
| 404 | Not found |
| 500 | Server error |

:::warning Authorization is not uniform
Not every route enforces authorization the same way — some accept a `userId`
parameter and trust it. Treat this page as a map of what exists, not a
guarantee that each route is correctly guarded. See
[Security](../architecture/security.md).
:::
