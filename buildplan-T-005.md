# T-005 — Daily Briefing Page

**Type:** Feature
**Status:** Planning
**Created:** 2026-03-28

---

## Goal

Build a Daily Briefing page that generates a structured, at-a-glance summary of the last 24 hours across all Mission Control surfaces — task completions, agent performance, session costs, failures, approvals, and key events — so operators can start each day with full situational awareness.

---

## User Value

Operators returning after hours away (sleep, meetings, weekends) need to quickly answer: _"What happened while I was gone?"_ Instead of clicking through 6+ pages, the Daily Briefing synthesizes everything into a single, scannable report — the morning standup for your AI fleet.

---

## Scope

- Dedicated page at `/briefing` showing the last 24 hours (configurable window)
- Sections: Tasks summary, Agent performance, Session costs, Failures/retries, Approvals, Key events
- Each section shows counts, deltas, and notable items
- Auto-generated insights: biggest cost driver, most active agent, completion rate
- Printable / exportable (clean layout, no interactive controls needed for print)
- Historical briefings: navigate to previous days
- Keyboard shortcut from anywhere: `G B` to go to briefing
- Refreshable on demand; no SSE needed (point-in-time snapshot)

---

## Non-Goals

- AI-generated natural language summaries (v1 is structured data, not LLM prose)
- Email or Slack delivery of briefings
- Customizable section ordering or widget selection
- Real-time updating (briefing is a snapshot, not a live view)
- Comparison between two time periods
- Predictions or forecasting

---

## Data Sources

| Source | Table / Origin | Metrics |
|---|---|---|
| Tasks | `tasks` | Created, completed, moved, blocked — counts and deltas |
| Agent activity | `agent_activity` | Runs started/completed/failed, total cost, total tokens, avg duration |
| Claude sessions | `claude_sessions` | Sessions started/ended, total cost, total tokens, models used |
| Timeline | `timeline_events` | Event count by source, notable events |
| Retries | `retries` (T-003) | Failures detected, retries attempted, resolution rate |
| Approvals | `approvals` (T-002) | Requested, approved, rejected, expired counts |

---

## Schema / Storage Implications

### No new tables required

The briefing is a read-only aggregation of existing tables. All data is computed on-demand via SQL queries with time-window filters.

### Optional: `briefing_snapshots` table (v6 migration, deferred)

If historical briefing access becomes a requirement, snapshots can be cached:

```sql
CREATE TABLE briefing_snapshots (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL UNIQUE,           -- YYYY-MM-DD
  data        TEXT NOT NULL,                  -- Full briefing JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

For v1, briefings are computed fresh each time — no snapshot table needed.

### New server module: `src/server/briefing.ts`

Responsible for:
- Querying each data source with a time window (default: last 24 hours)
- Computing aggregate metrics, deltas, and notable items
- Assembling the unified briefing response

---

## API / Routes

### `GET /api/briefing`

Query params:
- `date` — ISO date string (default: today). Returns briefing for the 24h window ending at end of that day
- `hours` — override window size (default: 24, max: 168 / 1 week)

Response:
```json
{
  "period": {
    "from": "2026-03-27T00:00:00Z",
    "to": "2026-03-28T00:00:00Z",
    "hours": 24
  },
  "tasks": {
    "created": 8,
    "completed": 5,
    "moved": 12,
    "blocked": 2,
    "completion_rate": 0.625,
    "notable": [
      { "id": "task-1", "title": "Fix auth regression", "event": "completed", "assignee": "Jarvis" }
    ]
  },
  "agents": {
    "total_runs": 14,
    "completed": 11,
    "failed": 3,
    "total_cost_usd": 0.87,
    "total_tokens": 245000,
    "avg_duration_ms": 180000,
    "most_active": "Jarvis",
    "by_agent": {
      "Jarvis": { "runs": 9, "completed": 8, "failed": 1, "cost_usd": 0.54 },
      "Cody": { "runs": 5, "completed": 3, "failed": 2, "cost_usd": 0.33 }
    }
  },
  "sessions": {
    "total": 6,
    "total_cost_usd": 0.42,
    "total_tokens": 128000,
    "models_used": ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    "costliest": { "session_id": "sess-abc", "cost_usd": 0.18, "model": "claude-sonnet-4-6" }
  },
  "costs": {
    "total_usd": 1.29,
    "breakdown": { "agents": 0.87, "sessions": 0.42 },
    "biggest_driver": "Jarvis — 9 runs totalling $0.54",
    "spikes": []
  },
  "failures": {
    "detected": 3,
    "retried": 2,
    "resolved": 1,
    "unresolved": 2
  },
  "approvals": {
    "requested": 4,
    "approved": 3,
    "rejected": 0,
    "expired": 1,
    "avg_response_time_ms": 120000
  },
  "key_events": [
    { "title": "Cost spike: Jarvis run exceeded $0.10", "occurred_at": "2026-03-27T22:14:00Z" },
    { "title": "3 agent failures in 10 minutes", "occurred_at": "2026-03-27T18:30:00Z" }
  ],
  "insights": [
    "Task completion rate: 62.5% (5 of 8 created tasks completed)",
    "Biggest cost driver: Jarvis agent runs ($0.54 across 9 runs)",
    "2 unresolved failures still need attention"
  ]
}
```

---

## UI Sections / Components

### Page: `app/briefing/page.tsx`

Server component shell, renders `<BriefingClient />`.

### `src/components/BriefingClient.tsx`

Client wrapper. Fetches briefing data on mount and date change.

Layout:
```
┌──────────────────────────────────────────────────────┐
│ Daily Briefing                 [← Mar 27] Mar 28 [→] │
│ Last 24 hours · Generated at 09:00                    │
├──────────────────────────────────────────────────────┤
│                                                       │
│ ┌─ Insights ──────────────────────────────────────┐  │
│ │ • Task completion rate: 62.5%                    │  │
│ │ • Biggest cost: Jarvis ($0.54 across 9 runs)     │  │
│ │ • 2 unresolved failures need attention           │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─ Tasks ────────┐  ┌─ Agents ───────────────────┐  │
│ │ Created    8    │  │ Runs     14  (11✓ 3✕)     │  │
│ │ Completed  5    │  │ Cost     $0.87             │  │
│ │ Blocked    2    │  │ Tokens   245K              │  │
│ │ Rate       63%  │  │ Top: Jarvis (9 runs)       │  │
│ └────────────────┘  └───────────────────────────┘  │
│                                                       │
│ ┌─ Sessions ─────┐  ┌─ Costs ────────────────────┐  │
│ │ Total      6    │  │ Total    $1.29             │  │
│ │ Cost       $0.42│  │ Agents   $0.87  (67%)     │  │
│ │ Models     2    │  │ Sessions $0.42  (33%)     │  │
│ └────────────────┘  └───────────────────────────┘  │
│                                                       │
│ ┌─ Failures ─────┐  ┌─ Approvals ────────────────┐  │
│ │ Detected   3    │  │ Requested  4               │  │
│ │ Resolved   1    │  │ Approved   3               │  │
│ │ Pending    2    │  │ Expired    1               │  │
│ └────────────────┘  └───────────────────────────┘  │
│                                                       │
│ ┌─ Key Events ────────────────────────────────────┐  │
│ │ 22:14 Cost spike: Jarvis run > $0.10            │  │
│ │ 18:30 3 agent failures in 10 minutes            │  │
│ └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Sub-components

| Component | Location | Purpose |
|---|---|---|
| `BriefingHeader` | `src/components/briefing/BriefingHeader.tsx` | Date picker, time window, generation timestamp |
| `BriefingInsights` | `src/components/briefing/BriefingInsights.tsx` | Top 3-5 auto-generated insight bullets |
| `BriefingSection` | `src/components/briefing/BriefingSection.tsx` | Reusable card with title, metric rows, notable items |
| `BriefingMetricRow` | `src/components/briefing/BriefingMetricRow.tsx` | Label + value + optional delta/trend indicator |
| `BriefingKeyEvents` | `src/components/briefing/BriefingKeyEvents.tsx` | Chronological list of notable events with timestamps |
| `BriefingWidget` | `src/components/BriefingWidget.tsx` | Dashboard widget: today's headline metrics |

### ViewModel: `src/viewmodels/useBriefingViewModel.ts`

- Fetches briefing data for selected date
- Holds `briefing`, `selectedDate`, `isLoading`
- Exposes `setDate(date)`, `refresh()`, `nextDay()`, `prevDay()`
- Caches previous dates to avoid re-fetching

---

## Phased Milestones

### Phase 1 — Server-side aggregation
- [ ] Add `src/server/briefing.ts` with query functions for each data source
- [ ] Tasks: count created/completed/moved/blocked in time window
- [ ] Agents: aggregate runs, costs, tokens, durations by agent
- [ ] Sessions: aggregate costs, tokens, models used
- [ ] Assemble unified briefing response object

### Phase 2 — Briefing API
- [ ] `GET /api/briefing` endpoint with `date` and `hours` params
- [ ] TypeScript types in `src/types/briefing.ts`
- [ ] Insight generation: derive top 3-5 observations from metrics
- [ ] Handle missing data sources gracefully (T-002/T-003 tables may not exist yet)

### Phase 3 — Briefing page
- [ ] `app/briefing/page.tsx` server shell
- [ ] `BriefingClient.tsx` with date navigation
- [ ] `BriefingHeader`, `BriefingSection`, `BriefingMetricRow` components
- [ ] `BriefingInsights` and `BriefingKeyEvents` components
- [ ] `useBriefingViewModel.ts`
- [ ] Add `/briefing` nav item to AppShell sidebar

### Phase 4 — Dashboard widget + navigation
- [ ] `BriefingWidget` on dashboard (today's headline metrics)
- [ ] Add "Go to Briefing" (G B) command to CommandPalette
- [ ] Date navigation: arrow keys or prev/next buttons to navigate days

### Phase 5 — Polish
- [ ] Print-friendly CSS (`@media print` styles)
- [ ] Graceful degradation when T-002/T-003 tables don't exist yet
- [ ] Loading skeleton while briefing is being computed
- [ ] Zero-data state for days with no activity

---

## Edge Cases

| Case | Handling |
|---|---|
| No activity in the last 24 hours | Show all sections with zero counts; insights say "Quiet day — no activity recorded" |
| Approvals/retries tables don't exist yet (T-002/T-003 not implemented) | Omit those sections; show available data only; no errors |
| Very high activity day (>1000 events) | Aggregation queries use indexed columns; notable items capped at 10 per section |
| Date in the future | Return empty briefing with note: "No data available for future dates" |
| Date before Mission Control was installed | Return empty briefing; same as zero-activity day |
| Timezone differences | All times stored as UTC; display in local timezone with UTC indicator |
| Briefing takes >2 seconds to compute | Show loading skeleton; consider caching in `briefing_snapshots` table |
| Cost data missing for some runs | Show "N/A" for missing costs; don't include in totals |
| Session with no model info | Group under "unknown" in models breakdown |
| Multiple requests for same date | Cache response in memory for 5 minutes to avoid re-computation |

---

## Acceptance Criteria

- [ ] `/briefing` page loads and displays structured summary of the last 24 hours
- [ ] All metric sections show accurate counts derived from database queries
- [ ] Date navigation allows browsing to previous days
- [ ] Insights section highlights top 3-5 observations (completion rate, cost driver, failures)
- [ ] Key events section shows notable timeline events with timestamps
- [ ] Sections for unimplemented features (approvals, retries) degrade gracefully
- [ ] Dashboard widget shows today's headline metrics
- [ ] "Go to Briefing" command works in CommandPalette with `G B` shortcut
- [ ] Page renders correctly with zero data (new install)
- [ ] Page handles high-activity days without performance issues
- [ ] Print layout is clean and readable
- [ ] TypeScript strict mode: no `any` in new files
- [ ] `npm run build` passes with no errors after implementation
