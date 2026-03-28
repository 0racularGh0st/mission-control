# T-002 — Approvals Inbox

**Type:** Feature
**Status:** Planning
**Created:** 2026-03-28

---

## Goal

Build a centralized Approvals Inbox where operators can review, approve, or reject pending actions from agents before they execute — providing a human-in-the-loop control plane for high-stakes operations like deployments, data mutations, cost-heavy runs, and external API calls.

---

## User Value

Agents are powerful but not infallible. Operators need a single place to see _"What is waiting for my sign-off?"_ without hunting across Slack, email, or terminal prompts. The Approvals Inbox turns Mission Control into the authority gate — nothing risky ships without explicit approval.

---

## Scope

- Dedicated page at `/approvals` showing pending, approved, and rejected items
- Agents submit approval requests via API; requests block agent execution until resolved
- Each request includes: what the agent wants to do, why, risk level, and context
- Real-time updates via SSE (same pattern as `/api/tasks/stream`)
- Approve / reject with optional comment
- Auto-expire stale requests after configurable timeout (default 1 hour)
- Keyboard-navigable: `a` to approve, `r` to reject, arrow keys to navigate
- Badge count of pending approvals in sidebar nav
- Dashboard widget showing pending count + oldest waiting item

---

## Non-Goals

- Multi-user approval chains or quorum-based approvals (single operator)
- Granular RBAC or per-agent permission policies
- Automatic approval rules or auto-approve policies (v1 is manual only)
- Approval history analytics or reporting
- Integration with external approval systems (Slack, PagerDuty)

---

## Data Sources

| Source | Origin | Event Types |
|---|---|---|
| Agent requests | Agents call `/api/approvals` to create requests | `approval.requested` |
| Operator actions | UI approve/reject triggers update | `approval.approved`, `approval.rejected` |
| Expiry | Background check or on-read expiry | `approval.expired` |

---

## Schema / Storage Implications

### New table: `approvals` (v4 migration)

```sql
CREATE TABLE approvals (
  id          TEXT PRIMARY KEY,              -- nanoid
  agent       TEXT NOT NULL,                 -- 'Jarvis' | 'Cody' | agent identifier
  action      TEXT NOT NULL,                 -- Human-readable description of the action
  reason      TEXT NOT NULL DEFAULT '',      -- Why the agent wants to do this
  risk_level  TEXT NOT NULL DEFAULT 'medium' -- 'low' | 'medium' | 'high' | 'critical'
              CHECK(risk_level IN ('low','medium','high','critical')),
  context     TEXT NOT NULL DEFAULT '',      -- JSON blob: file paths, commands, costs, etc.
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK(status IN ('pending','approved','rejected','expired')),
  comment     TEXT NOT NULL DEFAULT '',      -- Operator's note on approve/reject
  ref_id      TEXT NOT NULL DEFAULT '',      -- Optional FK to task, session, etc.
  expires_at  TEXT NOT NULL,                 -- ISO timestamp; default 1hr from creation
  resolved_at TEXT,                          -- When approved/rejected/expired
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_agent ON approvals(agent);
```

### Write path

- Agents create approval requests via `POST /api/approvals`
- Operator resolves via `PATCH /api/approvals` with `action: "approve"` or `"reject"`
- Expiry check runs on read (lazy) — any `pending` item past `expires_at` is marked `expired`
- All state changes emit timeline events via `recordEvent()`

---

## API / Routes

### `POST /api/approvals`

Create a new approval request.

Request body:
```json
{
  "agent": "Jarvis",
  "action": "Deploy auth-service to production",
  "reason": "All tests pass, PR #142 merged",
  "risk_level": "high",
  "context": "{\"pr\": 142, \"branch\": \"feat/auth-v2\", \"estimated_cost\": \"$0.00\"}",
  "ref_id": "task-abc123",
  "ttl_minutes": 60
}
```

Response: `201` with created approval object.

### `GET /api/approvals`

Query params:
- `status` — filter: `pending` | `approved` | `rejected` | `expired` (default: `pending`)
- `agent` — filter by agent name
- `limit` — default 50, max 200
- `before` — ISO timestamp cursor for pagination

Response:
```json
{
  "approvals": [ { "id": "...", "agent": "Jarvis", "action": "...", "status": "pending", ... } ],
  "pending_count": 3,
  "next_cursor": "2026-03-28T14:30:00Z",
  "has_more": false
}
```

### `PATCH /api/approvals`

Resolve an approval.

Request body:
```json
{
  "id": "approval-xyz",
  "action": "approve",
  "comment": "Looks good, ship it"
}
```

### `GET /api/approvals/stream`

SSE endpoint. Emits `event: approval` on new requests and status changes. Same pattern as `/api/tasks/stream`.

---

## UI Sections / Components

### Page: `app/approvals/page.tsx`

Server component shell, renders `<ApprovalsClient />`.

### `src/components/ApprovalsClient.tsx`

Client wrapper. Owns SSE subscription, filter state, and approval actions.

Layout:
```
┌───────────────────────────────────────────────────┐
│ Approvals Inbox                   [Filter: status] │
├───────────────────────────────────────────────────┤
│ 🔴 HIGH · Jarvis                   2 min ago      │
│ Deploy auth-service to production                  │
│ "All tests pass, PR #142 merged"                   │
│ [Approve (a)]  [Reject (r)]  [Details →]          │
├───────────────────────────────────────────────────┤
│ 🟡 MEDIUM · Cody                   15 min ago     │
│ Run database migration on staging                  │
│ "Schema v4 ready, 3 tables affected"               │
│ [Approve (a)]  [Reject (r)]  [Details →]          │
├───────────────────────────────────────────────────┤
│ (empty or resolved items below fold)               │
└───────────────────────────────────────────────────┘
```

### Sub-components

| Component | Location | Purpose |
|---|---|---|
| `ApprovalCard` | `src/components/ApprovalCard.tsx` | Single approval row — risk badge, agent, action, timestamps, action buttons |
| `ApprovalDetailPanel` | `src/components/ApprovalDetailPanel.tsx` | Expanded view with full context JSON, related task link, comment input |
| `ApprovalFilterBar` | `src/components/ApprovalFilterBar.tsx` | Status filter: Pending / Approved / Rejected / Expired / All |
| `ApprovalsBadge` | `src/components/ApprovalsBadge.tsx` | Sidebar badge showing pending count (pulsing if > 0) |
| `ApprovalsWidget` | `src/components/ApprovalsWidget.tsx` | Dashboard widget: pending count + oldest item |

### ViewModel: `src/viewmodels/useApprovalsViewModel.ts`

- Manages SSE connection
- Holds `approvals[]`, `statusFilter`, `pendingCount`
- Exposes `approve(id, comment?)`, `reject(id, comment?)`, `setFilter(status)`
- Optimistic updates on approve/reject, rollback on API failure

---

## Phased Milestones

### Phase 1 — Schema + write API
- [ ] Add `approvals` table via v4 migration in `src/server/db.ts`
- [ ] Add `src/server/approvals.ts` with `createApproval()`, `resolveApproval()`, `getApprovals()`, `expireStale()`
- [ ] `POST /api/approvals` and `PATCH /api/approvals` routes
- [ ] Wire approval events into timeline via `recordEvent()`

### Phase 2 — Read API + SSE
- [ ] `GET /api/approvals` with status filter and cursor pagination
- [ ] `GET /api/approvals/stream` SSE endpoint
- [ ] TypeScript types in `src/types/approvals.ts`
- [ ] Event bus: `src/runtime/approvals/eventsBus.ts`

### Phase 3 — Approvals page
- [ ] `app/approvals/page.tsx` server shell
- [ ] `ApprovalsClient.tsx` with SSE subscription
- [ ] `ApprovalCard`, `ApprovalFilterBar`, `ApprovalDetailPanel` components
- [ ] `useApprovalsViewModel.ts`
- [ ] Keyboard shortcuts: `a` approve, `r` reject, arrow keys navigate
- [ ] Add `/approvals` nav item to AppShell sidebar

### Phase 4 — Sidebar badge + dashboard widget
- [ ] `ApprovalsBadge` component with live pending count
- [ ] Wire badge into AppShell nav item
- [ ] `ApprovalsWidget` on dashboard (pending count + oldest item)
- [ ] Add "Go to Approvals" command to CommandPalette

### Phase 5 — Expiry + timeline integration
- [ ] Lazy expiry on read (mark `expired` if past `expires_at`)
- [ ] Timeline events for all approval state changes
- [ ] Cost spike approvals: auto-create approval when projected cost > threshold

---

## Edge Cases

| Case | Handling |
|---|---|
| No pending approvals | Empty state: "All clear. No approvals waiting." with checkmark icon |
| Approval expires while operator is viewing it | SSE pushes `approval.expired`; card greys out with "Expired" badge, action buttons disabled |
| Agent submits duplicate request | Deduplicate by `agent + action + ref_id` within 5-minute window; return existing approval |
| Approve/reject race condition (double-click) | Optimistic lock: `PATCH` checks `status = 'pending'` in WHERE clause; 409 if already resolved |
| Very long action description | Truncate to 2 lines in card view; full text in detail panel |
| Context JSON is malformed | Render as raw string in detail panel, same as timeline `detail` fallback |
| SSE disconnects | Auto-reconnect; re-fetch pending count on reconnect |
| High volume of requests (>50 pending) | Pagination + "oldest first" sort for pending; newest first for resolved |

---

## Acceptance Criteria

- [ ] `POST /api/approvals` creates a pending approval visible in `/approvals` within 1 second
- [ ] Approving an item changes its status to `approved` and removes it from the pending view
- [ ] Rejecting an item changes its status to `rejected` with the operator's comment stored
- [ ] Expired items (past `expires_at`) display as "Expired" and cannot be approved/rejected
- [ ] SSE stream delivers new approval requests in real-time without page reload
- [ ] Keyboard navigation works: arrow keys step through cards, `a` approves, `r` rejects
- [ ] Sidebar badge shows accurate pending count, updates in real-time
- [ ] Dashboard widget shows pending count and links to `/approvals`
- [ ] Filter by status works correctly (pending/approved/rejected/expired/all)
- [ ] Timeline receives events for all approval state changes
- [ ] Empty state renders for new installs with no approvals
- [ ] TypeScript strict mode: no `any` in new files
- [ ] `npm run build` passes with no errors after implementation
