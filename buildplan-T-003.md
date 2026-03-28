# T-003 — Retry Center

**Type:** Feature
**Status:** Planning
**Created:** 2026-03-28

---

## Goal

Build a Retry Center that surfaces all failed or errored agent runs, task executions, and session crashes in one place — letting operators inspect failures, understand root causes, and retry with one click (or keyboard shortcut).

---

## User Value

When agents fail, operators waste time digging through logs to find what broke and how to re-run it. The Retry Center answers: _"What failed, why, and can I retry it right now?"_ — reducing mean-time-to-recovery from minutes of investigation to seconds of informed action.

---

## Scope

- Dedicated page at `/retries` showing failed items across all sources
- Aggregates failures from: agent runs, task executions, session errors
- Each failure shows: what failed, error summary, stack trace preview, retry eligibility
- One-click retry that re-dispatches the original operation
- Retry history per item (attempt count, timestamps, outcomes)
- Filterable by source, error type, and retry status
- Real-time updates via SSE
- Keyboard-navigable: `R` to retry selected, `d` to dismiss, arrow keys to navigate

---

## Non-Goals

- Automatic retry policies or exponential backoff (v1 is manual only)
- Error pattern detection or anomaly alerting
- Root cause analysis or AI-powered error diagnosis
- Retry of external system failures (only Mission Control operations)
- Bulk retry of all failures at once (one at a time for safety)

---

## Data Sources

| Source | Table / Origin | Failure Indicators |
|---|---|---|
| Agent runs | `agent_activity` | `status = 'error'` or `status = 'failed'` |
| Tasks | `tasks` | Tasks stuck in `blocked` lane with error metadata |
| Claude sessions | `claude_sessions` | Sessions with non-zero exit codes or crash indicators |
| Retries | `retries` (new) | Tracks retry attempts and outcomes |

---

## Schema / Storage Implications

### New table: `retries` (v5 migration)

```sql
CREATE TABLE retries (
  id             TEXT PRIMARY KEY,              -- nanoid
  source         TEXT NOT NULL                  -- 'agents' | 'tasks' | 'sessions'
                 CHECK(source IN ('agents','tasks','sessions')),
  ref_id         TEXT NOT NULL,                 -- FK to failed item (agent_activity.id, task.id, session_id)
  error_summary  TEXT NOT NULL,                 -- One-line error description
  error_detail   TEXT NOT NULL DEFAULT '',      -- Full error/stack trace
  original_params TEXT NOT NULL DEFAULT '{}',   -- JSON: params needed to retry the operation
  status         TEXT NOT NULL DEFAULT 'failed'
                 CHECK(status IN ('failed','retrying','resolved','dismissed')),
  attempt_count  INTEGER NOT NULL DEFAULT 0,    -- Number of retry attempts
  max_attempts   INTEGER NOT NULL DEFAULT 3,    -- Max retries before auto-dismiss
  last_attempt_at TEXT,                         -- Timestamp of most recent retry
  resolved_at    TEXT,                          -- When successfully retried or dismissed
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_retries_status ON retries(status);
CREATE INDEX IF NOT EXISTS idx_retries_source ON retries(source);
CREATE INDEX IF NOT EXISTS idx_retries_created ON retries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retries_ref ON retries(ref_id);
```

### New table: `retry_attempts` (v5 migration)

```sql
CREATE TABLE retry_attempts (
  id         TEXT PRIMARY KEY,
  retry_id   TEXT NOT NULL REFERENCES retries(id),
  attempt    INTEGER NOT NULL,               -- 1, 2, 3...
  outcome    TEXT NOT NULL                   -- 'success' | 'failed'
             CHECK(outcome IN ('success','failed')),
  error      TEXT NOT NULL DEFAULT '',       -- Error if failed again
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_retry_attempts_retry ON retry_attempts(retry_id);
```

### Write path

- Failures are detected by watchers on `agent_activity` and `claude_sessions` status changes
- `src/server/retries.ts` provides `createRetryEntry()`, `attemptRetry()`, `dismissRetry()`, `getRetries()`
- On retry: re-dispatch the original operation using `original_params`, record attempt in `retry_attempts`
- All state changes emit timeline events via `recordEvent()`

---

## API / Routes

### `GET /api/retries`

Query params:
- `status` — filter: `failed` | `retrying` | `resolved` | `dismissed` (default: `failed`)
- `source` — filter by source
- `limit` — default 50, max 200
- `before` — ISO timestamp cursor

Response:
```json
{
  "retries": [
    {
      "id": "...",
      "source": "agents",
      "ref_id": "activity-xyz",
      "error_summary": "Agent Cody crashed: OOM in code generation",
      "status": "failed",
      "attempt_count": 1,
      "max_attempts": 3,
      "created_at": "2026-03-28T14:32:11Z"
    }
  ],
  "failed_count": 5,
  "next_cursor": "...",
  "has_more": false
}
```

### `POST /api/retries/retry`

Retry a failed item.

Request body:
```json
{
  "id": "retry-abc",
  "override_params": {}
}
```

Response: `200` with updated retry object and new attempt record.

### `PATCH /api/retries`

Dismiss a failed item.

Request body:
```json
{
  "id": "retry-abc",
  "action": "dismiss"
}
```

### `GET /api/retries/stream`

SSE endpoint for real-time failure and retry status updates.

---

## UI Sections / Components

### Page: `app/retries/page.tsx`

Server component shell, renders `<RetriesClient />`.

### `src/components/RetriesClient.tsx`

Client wrapper. Owns SSE subscription, filter state, and retry actions.

Layout:
```
┌────────────────────────────────────────────────────┐
│ Retry Center                  [Filter: source/status] │
├────────────────────────────────────────────────────┤
│ ✕ FAILED · agents · Cody              3 min ago    │
│ OOM in code generation                              │
│ Attempt 1/3 · original run: 2m 14s                 │
│ [Retry (R)]  [Dismiss (d)]  [View Error →]         │
├────────────────────────────────────────────────────┤
│ ⟳ RETRYING · sessions · claude-sonnet-4-6 1 min ago│
│ Session crashed: context limit exceeded             │
│ Attempt 2/3 · retrying...                          │
├────────────────────────────────────────────────────┤
│ ✓ RESOLVED · agents · Jarvis           20 min ago  │
│ API timeout on deploy step                          │
│ Resolved on attempt 2                               │
└────────────────────────────────────────────────────┘
```

### Sub-components

| Component | Location | Purpose |
|---|---|---|
| `RetryCard` | `src/components/RetryCard.tsx` | Single failure row — status icon, source badge, error summary, attempt count, action buttons |
| `RetryDetailPanel` | `src/components/RetryDetailPanel.tsx` | Expanded: full error/stack trace, attempt history timeline, original params |
| `RetryFilterBar` | `src/components/RetryFilterBar.tsx` | Source filter + status filter (failed/retrying/resolved/dismissed) |
| `RetriesWidget` | `src/components/RetriesWidget.tsx` | Dashboard widget: failed count + most recent failure |

### ViewModel: `src/viewmodels/useRetriesViewModel.ts`

- Manages SSE connection
- Holds `retries[]`, `sourceFilter`, `statusFilter`, `failedCount`
- Exposes `retry(id)`, `dismiss(id)`, `setFilter(source, status)`
- Optimistic UI: card shows "Retrying..." immediately, rolls back on failure

---

## Phased Milestones

### Phase 1 — Schema + failure detection
- [ ] Add `retries` and `retry_attempts` tables via v5 migration in `src/server/db.ts`
- [ ] Add `src/server/retries.ts` with `createRetryEntry()`, `getRetries()`, `dismissRetry()`
- [ ] Wire failure detection into agent activity log (on `status = 'error'`)
- [ ] Wire failure detection into session scanner (on crash/error indicators)

### Phase 2 — Retry execution + API
- [ ] `attemptRetry()` in `src/server/retries.ts` — re-dispatch original operation
- [ ] `GET /api/retries` with status/source filters and cursor pagination
- [ ] `POST /api/retries/retry` endpoint
- [ ] `PATCH /api/retries` for dismiss
- [ ] TypeScript types in `src/types/retries.ts`

### Phase 3 — Retries page
- [ ] `app/retries/page.tsx` server shell
- [ ] `RetriesClient.tsx` with SSE subscription
- [ ] `RetryCard`, `RetryFilterBar`, `RetryDetailPanel` components
- [ ] `useRetriesViewModel.ts`
- [ ] Keyboard shortcuts: `R` retry, `d` dismiss, arrow keys navigate
- [ ] Add `/retries` nav item to AppShell sidebar

### Phase 4 — SSE + dashboard widget
- [ ] `GET /api/retries/stream` SSE endpoint
- [ ] Event bus: `src/runtime/retries/eventsBus.ts`
- [ ] `RetriesWidget` on dashboard (failed count + most recent failure)
- [ ] Add "Go to Retries" command to CommandPalette
- [ ] Wire retry events into timeline via `recordEvent()`

### Phase 5 — Polish
- [ ] Attempt history sub-timeline in detail panel
- [ ] Max attempts enforcement: auto-dismiss after `max_attempts` reached
- [ ] Sidebar badge with failed count (red pulse when > 0)

---

## Edge Cases

| Case | Handling |
|---|---|
| No failures | Empty state: "All systems nominal. No failures to retry." with green checkmark |
| Retry succeeds | Move to `resolved` status; show success toast; emit `retry.resolved` timeline event |
| Retry fails again | Increment `attempt_count`; stay in `failed` status; record attempt in `retry_attempts` |
| Max attempts reached | Auto-set status to `dismissed` with note "Max retry attempts exceeded" |
| Original operation no longer valid | Show warning in detail panel: "Original context may have changed"; allow retry with override params |
| Retry while another retry is in progress | Block with 409: "Retry already in progress" |
| Agent that failed no longer exists | Show "Agent unavailable" badge; disable retry button |
| Error detail is very long (>10KB) | Truncate in card view; full text in detail panel with scroll |
| SSE disconnects | Auto-reconnect; re-fetch failed count on reconnect |
| Concurrent failure spike (>20 failures/min) | No special handling in v1; pagination handles volume |

---

## Acceptance Criteria

- [ ] Agent failures automatically appear in `/retries` within 2 seconds of detection
- [ ] Clicking "Retry" re-dispatches the original operation and shows "Retrying..." status
- [ ] Successful retry moves the item to `resolved` with a success indicator
- [ ] Failed retry increments attempt count and keeps the item in `failed`
- [ ] Dismissing a failure removes it from the default view
- [ ] Filter by source (agents/tasks/sessions) works correctly
- [ ] Filter by status (failed/retrying/resolved/dismissed) works correctly
- [ ] Keyboard navigation: arrow keys, `R` to retry, `d` to dismiss
- [ ] Attempt history is visible in the detail panel
- [ ] Dashboard widget shows accurate failed count, updates in real-time
- [ ] Timeline receives events for failures, retries, and resolutions
- [ ] Empty state renders for installations with no failures
- [ ] TypeScript strict mode: no `any` in new files
- [ ] `npm run build` passes with no errors after implementation
