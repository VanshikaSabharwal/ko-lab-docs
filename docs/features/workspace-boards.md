---
sidebar_position: 3
title: Workspace boards
---

# Workspace boards

## Description

Four collaborative canvases per group, each a live multi-user surface with
cursors and presence:

| Board | Route | Purpose |
|---|---|---|
| **UI design** | `/workspace/[groupId]/ui-design` | Wireframes from a component palette |
| **Mind map** | `/workspace/[groupId]/mind-map` | Free-form idea graph |
| **DB schema** | `/workspace/[groupId]/db-schema` | Tables, columns, relations |
| **Planning** | `/workspace/[groupId]/planning` | Kanban, workflow graph, milestones |

The first three are React Flow graphs sharing one hook. Planning is
different — it has its own relational tables rather than a JSON document.

## Setup

Nothing beyond the base install. Boards need the database and a working
WebSocket connection.

## Integration

```
Frontend                          Backend              WebSocket
────────                          ───────              ─────────
useWorkspaceBoard()
  ├─ load ──────────────────────► GET  /api/workspace/[id]/<slug>
  ├─ save (debounced) ──────────► PUT  /api/workspace/[id]/<slug>
  ├─ broadcast op ─────────────────────────────────────► workspace_op
  └─ cursor (throttled) ───────────────────────────────► workspace_presence
```

Graph boards persist `{ nodes, edges }` as a JSON document on
`WorkspaceBoard`. A `PUT` replaces the whole document, which is why saves are
debounced rather than fired per change.

## How it works

`apps/web/app/workspace/lib/useWorkspaceBoard.ts` is the heart of all three
graph boards. Three mechanisms in it are worth understanding.

### 1. Drag broadcasts are throttled — and this fixed a real bug

A drag fires roughly 60 position changes per second. The WebSocket server
caps messages at **10 per second** and replies with `{type:"error"}` on
excess — which this client ignores. Unthrottled dragging therefore *silently
dropped operations and desynced peers*.

The fix, from `useWorkspaceBoard.ts:201`:

```ts
// A continuous drag fires ~60 position changes/second. The WS server caps
// both message size and messages-per-second and answers with {type:"error"},
// which this client ignores — so unthrottled dragging silently drops ops and
// desyncs peers. Local state still updates on every change (dragging stays
// smooth); only the broadcast is rate-limited.
const lastDragSend = useRef(0);
const pendingDrag = useRef<Map<string, NodePositionChange>>(new Map());
```

The split in `onNodesChange` (`useWorkspaceBoard.ts:222`) is the important
part — in-flight drag ticks are deferred and coalesced, everything else goes
immediately:

```ts
const deferred: NodePositionChange[] = [];
const immediate: NodeChange[] = [];
for (const c of changes) {
  if (c.type === "position" && c.dragging) deferred.push(c);
  else immediate.push(c);
}
```

Two details that are easy to get wrong if you touch this code:

- **Coalescing is keyed by node id** (`pendingDrag.current.set(c.id, c)`) —
  only the latest position for a node matters, so intermediate ticks are
  discarded rather than queued.
- **A trailing flush** (`:243`) guarantees the final tick of a drag is sent.
  Without it, a drag ending inside the throttle window would leave peers
  showing a stale position.
- **Ordering** (`:249`): a queued move is flushed *before* any immediate
  change, so the drag-end resting position cannot arrive before the move it
  follows.

Local state updates on every change regardless, so dragging stays smooth for
the person doing it. Only the wire is rate-limited.

### 2. Saves are debounced

```ts
saveTimer.current = setTimeout(() => {
  // PUT the whole { nodes, edges } document
}, SAVE_DEBOUNCE_MS);
```

Since `PUT` replaces the document wholesale, saving per change would be both
wasteful and a source of lost updates.

### 3. Grouping

The UI design board supports grouping nodes into a container, via two ops:

```ts
| { action: "group_nodes"; container: Node; childIds: string[];
    positions: Record<string, XYPosition> }
| { action: "ungroup_nodes"; containerId: string;
    positions: Record<string, XYPosition> }
```

Both carry explicit `positions`, because grouping re-parents children to
coordinates relative to the container — a peer applying the op needs the
resulting absolute positions rather than recomputing them.

:::note Last write wins
There is no CRDT or operational transform. Two users dragging the same node
produce a flicker and the later write survives. Acceptable for these boards;
it would not be acceptable for collaborative text.
:::

## Planning board

Planning does not use the JSON document model. It has real tables —
`PlanningTask`, `PlanningMilestone`, `TaskDependency` — and its own routes
under `/api/workspace/[groupId]/planning/`.

The dependency graph **must stay acyclic**: both layout and schedule ordering
walk the edges, and a cycle makes that non-terminating. `wouldCreateCycle` in
`planning/_shared.ts` guards every new edge, and is well covered by
`__tests__/workspace/dependencyCycle.test.ts`.

## Testing

### Automated

Six files under `__tests__/workspace/`, all pure logic:

| File | Covers |
|---|---|
| `dependencyCycle.test.ts` | Cycle rejection in the workflow graph |
| `timelineScale.test.ts` | Milestone timeline scaling |
| `monthGrid.test.ts` | Calendar grid generation |
| `position.test.ts` | Node positioning maths |
| `planningBackfill.test.ts` | Backfill migration |
| `taskMeta.test.ts` | Task metadata |

```bash
cd apps/web && npx vitest run __tests__/workspace
```

This is the right instinct — the pure helpers are extracted and tested,
while the React Flow surface is left to manual checks.

### Worth adding

The drag-throttle logic is subtle and currently untested. It is testable with
fake timers:

```ts
import { vi, describe, it, expect } from "vitest";

it("coalesces drag ticks into one broadcast per window", () => {
  vi.useFakeTimers();
  const send = vi.fn();
  // drive onNodesChange with 30 position changes for the same node
  // …
  vi.advanceTimersByTime(DRAG_BROADCAST_MS);
  expect(send).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

it("always flushes the final tick of a drag", () => { /* … */ });
```

### Manual — needs two windows

Automated tests cannot reach drag, cursors or presence.

**Basics**

1. Both windows open the same board
2. A adds a node → appears for B
3. A drags a node → B sees it move smoothly, no jumping
4. A deletes → disappears for B
5. Reload both → identical state

**The throttle specifically**

1. A drags a node continuously for ~10 seconds
2. B should see continuous motion, not freeze-then-jump
3. A releases → B's final position must match A's exactly
4. Watch A's console — no `{type:"error"}` frames, and the connection stays open

Step 3 is the regression test for the bug the throttle fixed.

**Grouping (UI design)**

1. A selects two nodes → the Group button enables
2. A groups them → B sees the container with both children
3. A drags the container → children move with it for B
4. A ungroups → children return to absolute positions for both

**Presence**

1. A moves the mouse → B sees a labelled cursor
2. A closes the tab → the cursor disappears for B within a few seconds
3. Three users at once → three distinct cursors

**Conflict**

1. Both drag the *same* node simultaneously → flicker is expected, a crash is not
2. Both edit *different* nodes → no lost updates
3. A goes offline, edits, reconnects → converges after reload

**Planning**

1. Create tasks, drag across Kanban columns
2. Add a dependency → the workflow graph updates
3. Attempt a cycle → rejected with a clear message
4. Milestones appear correctly on the timeline

## Demo

:::info Video coming soon
Two users collaborating on a UI design board — live cursors, grouping, and
conflict behaviour.
:::

{/* <iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID"
  title="Workspace boards" frameBorder="0" allowFullScreen></iframe> */}
