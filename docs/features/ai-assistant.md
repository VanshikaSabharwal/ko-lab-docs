---
sidebar_position: 1
---

# AI Assistant: "What Did I Miss?"

The Ko-Lab Assistant is an LLM-powered chatbot that queries your workspace across groups, tasks, code changes, and calls — all in one question.

## Overview

Instead of hopping between dashboards, ask the assistant:
- **"What did I miss?"** — Catch up on everything since you last logged in
- **"Show my groups"** — List your active projects
- **"My open tasks"** — See what's assigned to you
- **"Recent changes"** — What code changed in a specific group

The assistant runs on **Groq's `openai/gpt-oss-20b`** model, which is fast (free tier), accurate, and supports tool calling.

## Architecture

### Frontend (apps/web/app/components/AssistantChat.tsx)

React component with:
- Text input + send button
- 🎤 Voice-to-text (Web Speech API)
- 4 quick-prompt suggestions
- Multi-turn conversation history
- Loading indicator & error handling

```tsx
<AssistantChat />  // Shows only for authenticated users
```

### Backend (apps/web/app/api/assistant/route.ts)

Next.js route handler:
1. **Auth**: NextAuth session validation (no exposed API key)
2. **Message validation**: Ensures proper format
3. **Tool execution**: Runs read-only Prisma queries
4. **Tool-calling loop**: Continues conversation up to 5 iterations
5. **Error handling**: Logs to console for debugging

### Groq Integration

```typescript
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const response = await groq.chat.completions.create({
  model: "openai/gpt-oss-20b",      // High-quality open-source
  messages: messages,                 // Full conversation history
  tools: tools,                       // Tool definitions
  tool_choice: "auto",                // Let model decide when to use tools
  max_tokens: 1024,                   // Limit response size
});
```

## Tools (Read-Only)

All tools are permission-scoped — users can only query their own data.

### 1. `list_my_groups`
Lists groups the user owns or is a member of.

**Schema:**
```prisma
group.findMany({
  where: {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } }
    ]
  }
})
```

**Response:**
```json
[
  {
    "id": "grp_123",
    "groupName": "Anime Website",
    "description": "Frontend redesign",
    "isOwner": true,
    "memberCount": 3
  }
]
```

### 2. `list_my_tasks`
Planning tasks assigned to the user across all groups.

**Schema:**
```prisma
planningTask.findMany({
  where: {
    assignees: { some: { userId } },
    group: { /* permission check */ }
  }
})
```

**Response:**
```json
[
  {
    "id": "task_456",
    "title": "Fix API validation",
    "priority": "HIGH",
    "dueDate": "2026-09-25",
    "group": "Anime Website"
  }
]
```

### 3. `get_group_activity`
Recent changes, file modifications, and pull requests in a group.

**Parameters:**
- `group_id` (required): The group to query
- `limit` (optional): Number of recent items (default: 10)

**Response:**
```json
{
  "groupId": "grp_123",
  "groupName": "Anime Website",
  "recentFileChanges": [
    {
      "file": "src/api/users.ts",
      "type": "modified",
      "line": 42,
      "changedBy": "Vanshika",
      "createdAt": "2026-09-19T10:30:00Z"
    }
  ],
  "recentChangeRequests": [
    {
      "id": "cr_789",
      "title": "Add email validation",
      "status": "OPEN",
      "author": "Rahul",
      "createdAt": "2026-09-18T14:22:00Z"
    }
  ]
}
```

### 4. `get_blocked_by`
Dependency graph — what tasks are blocking a specific task.

**Parameters:**
- `task_id` (required): The planning task ID

**Response:**
```json
{
  "taskId": "task_456",
  "title": "Fix API validation",
  "blockedBy": [
    {
      "id": "task_111",
      "title": "Set up database schema",
      "priority": "HIGH"
    }
  ]
}
```

## Real-Time Notifications

When the assistant or other users trigger updates, notifications are pushed in real-time:

1. **WebSocket push** (`/internal/push` endpoint on ws server)
2. **Bearer token auth** between Next.js and WebSocket service
3. **Socket delivery** to open connections
4. **Fallback**: Notifications persist in DB, appear on next page load

### Notification Flow

```
User A updates group
    ↓
Next.js saves to DB (apps/web/app/lib/memberEvents.ts)
    ↓
Calls pushToUsers(recipientIds, payload)
    ↓
WebSocket server broadcasts to open sockets
    ↓
User B sees notification instantly (CallProvider.tsx)
    ↓
Notification page refetches in background
    ↓
No page reload needed ✓
```

## Setup & Configuration

### 1. Get Groq API Key

1. Go to https://console.groq.com/keys
2. Create an API key
3. Copy to `.env`:

```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxx
```

### 2. (Optional) Configure Notification Push

For real-time notifications, set both:

```bash
# Next.js (apps/web/.env)
GIT_SERVICE_URL=http://localhost:8080
GIT_SERVICE_SECRET=your-secret-key

# WebSocket (apps/web-socket/.env)
GIT_SERVICE_SECRET=your-secret-key  # Must match
```

Without these, notifications still work but only appear on page reload.

### 3. Restart Dev Server

```bash
npm run dev
```

## Usage Examples

### Chat in Hero Section

On the homepage (right side of hero), authenticated users see:

```
┌─────────────────────────────────────┐
│ Ko-Lab Assistant                    │
│ Ask about your groups, tasks...      │
├─────────────────────────────────────┤
│                                     │
│ Quick questions:                    │
│ ┌─ What did I miss? ──────────────┐ │
│ ├─ Show my groups ───────────────┤ │
│ ├─ My open tasks ───────────────┤ │
│ └─ Recent changes ──────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Ask me anything or use voice... 🎤  │
│                         [➤] Send   │
└─────────────────────────────────────┘
```

### Voice Input

1. Click **🎤 mic button** (turns red)
2. Say your question: *"What did I miss?"*
3. Click again to stop
4. Transcribed text appears in input
5. Press Enter or click Send

### Multi-Turn Conversation

The assistant maintains full conversation history:

```
You:      "What did I miss?"
Assistant: [Lists 5 things]
You:      "Tell me more about the change requests"
Assistant: [Drills down into CRs]
You:      "Which ones need my review?"
Assistant: [Filters CRs assigned to you]
```

## Limitations & Future Work

### Current (Phase 1)

✅ Read-only queries (safe to leave running)  
✅ Permission-scoped (users see only their data)  
✅ 4 core tools (groups, tasks, activity, dependencies)  
✅ Voice-to-text transcription  
✅ Real-time notifications  

### Planned (Phase 2)

⏳ Write operations (create tasks, add members)  
⏳ Context summarization (avoid 8K token limit on long convos)  
⏳ Custom tool definitions per group  
⏳ Chat history persistence  
⏳ Integration with code reviews  

### Known Issues

| Issue | Workaround |
|-------|-----------|
| Long conversations fill 8K context | Start a new chat |
| Tool-calling errors on complex queries | Simplify the question |
| No voice output (only input) | Manual copy+paste response |

## Cost

| Volume | Model | Cost |
|--------|-------|------|
| 1K requests (~300 tokens) | gpt-oss-20b | Free |
| 10K requests | gpt-oss-20b | ~$0.30/mo |
| 100K requests | gpt-oss-20b | ~$3/mo |
| Upgrade to accuracy | Claude Opus | $15-50/mo |

Groq's free tier is generous. You'll likely stay free unless running thousands of daily queries.

## Debugging

### Enable Server Logs

Watch the terminal for assistant errors:

```bash
npm run dev

# When you chat, look for:
Assistant API error: [details]
```

### Test Endpoint Directly

```bash
curl -X POST http://localhost:3000/api/assistant \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "hello"}
    ]
  }'
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `GROQ_API_KEY not configured` | Env var empty | Set in `.env`, restart server |
| `model_decommissioned` | Groq retired model | Check Groq console for current models |
| `401 Unauthorized` | Not logged in | Log in first |
| `400 Invalid messages format` | Bad message structure | Check role + content on each message |

## See Also

- [Notifications & Real-Time Sync](./groups-chat.md#notifications)
- [API Reference: POST /api/assistant](../backend/api-reference.md#assistant)
- [WebSocket Service: /internal/push](../websocket/overview.md#service-to-service)
