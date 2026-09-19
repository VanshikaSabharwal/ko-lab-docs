---
sidebar_position: 1
title: Overview
---

# Features

Each feature page follows the same shape:

- **Description** — what it does and who it is for
- **Setup** — what must be configured before it works
- **Integration** — how frontend, backend and WebSocket fit together
- **How it works** — annotated code from the real source
- **Testing** — automated coverage, and manual checks
- **Demo** — a walkthrough video

Features are documented here rather than under each layer because almost
every one spans all three. Voice calls, for instance, touch React components,
API routes and the WebSocket signalling path — splitting that across three
sections would tell the story three times and completely nowhere.

## The four areas

| Feature | Layers | Automated tests |
|---|---|---|
| **[Groups, chat & notifications](./groups-chat.md)** | All three | Partial |
| **[Workspace boards](./workspace-boards.md)** | All three | Pure logic only |
| **[Code editor, VCS & GitHub](./code-editor-vcs.md)** | All three + git service | **None** |
| **[Voice & video](./voice-video.md)** | All three + LiveKit | Strong — 11 files |

## Dependencies

```
Auth (GitHub OAuth)
  └─ Groups ──────────────┬─ Chat ─────── Notifications
                          │
                          ├─ Workspace boards
                          │
                          ├─ GitHub link ─ Code editor ─ VCS
                          │
                          └─ Calls (LiveKit)
```

Groups are the root. Nothing except authentication works without one, so
that is the first thing to build when testing any feature by hand.

## Configuration by feature

| Feature | Needs |
|---|---|
| Groups, chat | Database, `WS_AUTH_SECRET` |
| Boards | As above |
| Code editor | GitHub OAuth, `ENCRYPTION_KEY`, git service |
| AI assistant | `GROQ_API_KEY` |
| Calls | LiveKit keys |
| Avatars, drafts | S3 credentials |

Start with groups and chat — they need the least configuration and exercise
the WebSocket path that everything else depends on.
