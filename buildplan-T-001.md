# T-001 — Timeline / Activity Feed

**Type:** Feature
**Status:** Planning
**Created:** 2026-03-28

---

## Goal

Build a unified, real-time Timeline / Activity Feed that surfaces a chronological stream of everything happening across Mission Control — task mutations, agent activity, Claude session starts/ends, cost events, and log highlights — in a single scannable view.

---

## User Value

Operators need situational awareness without switching between pages. The timeline answers: _"What has been happening in the last hour?"_ — task moved to blocked, agent Cody finished a run, session costs spiked, a P0 task was created. One feed, zero tab-hopping.

---

## Scope

- Unified event feed merging events from: tasks, agent_activity, claude_sessions
- Real-time updates via SSE (same pattern as `/api/tasks/stream`)
- Filterable by event source (tasks | agents | sessions | costs)
- Paginated / virtualized for large histories (50 events per page)
- Dedicated page at `/timeline` + widget on Dashboard
- Keyboard-navigable (arrow keys to step through events, `f` to focus filter)

---

## Non-Goals

- Log line streaming (that is `/logs` — separate page)
- Full task detail editing from the timeline (link out to `/tasks`)
- Push notifications or webhooks
- Cross-machine event aggregation (local SQLite only)
- Replaying or undoing events

---

## Data Sources

| Source | Table / Origin | Event Types |
|---|---|---|
| Tasks | `tasks` (SQLite) | `task.created`, `task.moved`, `task.updated`, `task.deleted` |
| Agent activity | `agent_activity` (SQLite) | `agent.started`, `agent.completed`, `agent.failed` |
| Claude sessions | `claude_sessions` (SQLite) | `session.started`, `session.ended` |
| Costs | Derived from `agent_activity.cost_usd` + `claude_sessions.cost_usd` | `cost.spike` (threshold-based) |

---

## Schema / Storage Implications

### New table: `timeline_events` (v3 migration)

```sql
CREATE TABLE timeline_events (
  id          TEXT PRIMARY KEY,              -- nanoid
  event_type  TEXT NOT NULL,                 -- e.g. 'task.created', 'agent.completed'
  source      TEXT NOT NULL                  -- 'tasks' | 'agents' | 'sessions' | 'costs'
              CHECK(source IN ('tasks','agents','sessions','costs')),
  ref_id      TEXT NOT NULL DEFAULT '',      -- FK to originating row (task id, session_id, etc.)
  actor       TEXT NOT NULL DEFAULT '',      -- 'Jarvis' | 'Cody' | 'system' | session model
  title       TEXT NOT NULL,                 -- Human-readable one-liner
  detail      TEXT NOT NULL DEFAULT '',      -- Optional extra context (JSON blob or plain text)
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timeline_occurred ON timeline_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_source   ON timeline_events(source);
CREATE INDEX IF NOT EXISTS idx_timeline_ref      ON timeline_events(ref_id);
```

### Write path

Events are written by server-side helpers called from:
1. **Task store** (`src/runtime/tasks/store.ts`) — after `createTask`, `moveTask`, `updateTask`, `deleteTask`
2. **Agent activity ingestion** — when rows are inserted/updated in `agent_activity`
3. **Session ingestion** — when `claude_sessions` rows are inserted/updated
4. A `recordEvent(type, source, refId, actor, title, detail?)` helper in `src/server/timeline.ts`

### No event sourcing — events are append-only denormalized snapshots. The originating tables remain the source of truth for current state.

---

## API / Routes

### `GET /api/timeline`

Query params:
- `source` — filter by source (comma-separated, e.g. `tasks,agents`)
- `before` — ISO timestamp cursor for pagination
- `limit` — default 50, max 200

Response:
```json
{
  "events": [
    {
      "id": "...",
      "event_type": "task.moved",
      "source": "tasks",
      "ref_id": "task-abc123",
      "actor": "Cody",
      "title": "Task 'Fix login bug' moved → blocked",
      "detail": "{\"from\":\"now\",\"to\":\"blocked\"}",
      "occurred_at": "2026-03-28T14:32:11Z"
    }
  ],
  "next_cursor": "2026-03-28T14:30:00Z",
  "has_more": true
}
```

### `GET /api/timeline/stream`

SSE endpoint. Emits `event: timeline` with JSON payload for each new event. Same pattern as `/api/tasks/stream`. Clients reconnect automatically.

---

## UI Sections / Components

### Page: `app/timeline/page.tsx`

Server component shell, renders `<TimelineClient />`.

### `src/components/TimelineClient.tsx`

Client wrapper. Owns SSE subscription, filter state, and pagination.

Layout:
```
┌─────────────────────────────────────────────┐
│ Timeline                      [Filter bar ▾] │
├─────────────────────────────────────────────┤
│ ○ Mar 28, 14:32 — Task 'Fix login' → blocked │
│   Cody · tasks                               │
│                                              │
│ ○ Mar 28, 14:29 — Session ended (claude)     │
│   claude-sonnet-4-6 · sessions · $0.04       │
│                                              │
│ ○ Mar 28, 14:18 — Agent Jarvis completed     │
│   task: 'Refactor auth' · agents · 2m 14s   │
│ ...                                          │
├─────────────────────────────────────────────┤
│ [← Prev]  Page 1 of 12  [Next →]            │
└─────────────────────────────────────────────┘
```

### Sub-components

| Component | Location | Purpose |
|---|---|---|
| `TimelineEvent` | `src/components/TimelineEvent.tsx` | Single event row — icon, timestamp, title, badges |
| `TimelineFilterBar` | `src/components/TimelineFilterBar.tsx` | Multi-select filter: All / Tasks / Agents / Sessions / Costs |
| `TimelineEventIcon` | inline in `TimelineEvent` | Source-specific icon (Lucide): `CheckSquare`, `Bot`, `Terminal`, `DollarSign` |
| `TimelinePaginator` | reuse existing pattern from `/claude` page | Prev/Next + page numbers |

### Dashboard widget

Add a `<TimelineWidget />` to `app/page.tsx` showing the 5 most recent events, linking to `/timeline` for full view. Replaces or sits alongside the existing Activity Feed placeholder.

### ViewModel: `src/viewmodels/useTimelineViewModel.ts`

- Manages SSE connection (`EventSource`)
- Holds `events[]`, `filter`, `page`, `hasMore`
- Exposes `setFilter(sources)`, `nextPage()`, `prevPage()`
- Prepends live SSE events to the top of the list (real-time, no full refresh)

---

## Phased Milestones

### Phase 1 — Schema + write path (no UI yet)
- [ ] Add `timeline_events` table via v3 migration in `src/server/db.ts`
- [ ] Add `src/server/timeline.ts` with `recordEvent()` helper
- [ ] Wire `recordEvent()` into task store (`createTask`, `moveTask`, `updateTask`, `deleteTask`)
- [ ] Verify events appear in DB after task operations

### Phase 2 — Read API
- [ ] `GET /api/timeline` with cursor pagination and source filter
- [ ] `GET /api/timeline/stream` SSE endpoint
- [ ] TypeScript types in `src/types/timeline.ts`

### Phase 3 — Timeline page
- [ ] `app/timeline/page.tsx` server shell
- [ ] `src/components/TimelineClient.tsx` with SSE subscription
- [ ] `TimelineEvent`, `TimelineFilterBar`, `TimelinePaginator` components
- [ ] `useTimelineViewModel.ts`
- [ ] Add `/timeline` nav item to AppShell sidebar

### Phase 4 — Agent + session events
- [ ] Wire `recordEvent()` into agent_activity ingestion path
- [ ] Wire `recordEvent()` into claude_sessions ingestion path
- [ ] Cost spike detection: emit `cost.spike` when session cost > $0.10 threshold (configurable)

### Phase 5 — Dashboard widget
- [ ] `TimelineWidget` component (5 most recent events, static fetch)
- [ ] Embed in `app/page.tsx` dashboard

---

## Edge Cases

| Case | Handling |
|---|---|
| No events yet | Empty state: "No activity yet. Events will appear as tasks and agents run." |
| SSE disconnects | `EventSource` auto-reconnects; show a subtle "reconnecting…" badge |
| Very high event volume (>1000/hr) | Pagination + cursor; never load all events into memory |
| Same event written twice (duplicate insert) | `id` is PRIMARY KEY — ignore on conflict |
| Task deleted before timeline refs it | `ref_id` is a soft FK; show "deleted item" with strikethrough |
| Timestamps out of order (clock skew) | Sort by `occurred_at DESC` — display order is always server-authoritative |
| Filter with no results | Show empty state per filter, not generic empty |
| `detail` JSON parse failure | Render `detail` as raw string if JSON.parse throws |

---

## Acceptance Criteria

- [ ] Creating a task via the Tasks UI produces a `task.created` event visible in `/timeline` within 1 second
- [ ] Moving a task lane produces a `task.moved` event with `from` and `to` in `detail`
- [ ] Filter to "Tasks only" shows only `source = 'tasks'` events; other sources are hidden
- [ ] SSE stream delivers new events in real-time without a page reload
- [ ] Timeline page is keyboard-navigable: arrow keys step through events, `f` opens filter
- [ ] Pagination correctly pages through 50-event chunks; cursor is stable across reloads
- [ ] Dashboard widget shows the 5 most recent events and links to `/timeline`
- [ ] Empty state renders when no events exist (new install)
- [ ] No events are lost if SSE disconnects and reconnects
- [ ] TypeScript strict mode: no `any` in new files
- [ ] `npm run build` passes with no errors after implementation
