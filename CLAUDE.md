# Mission Control — Claude Code Context

## Project Overview
AI Mission Control OS — a keyboard-first, dark-only command center for orchestrating agents, routing tasks between models, watching logs in real-time, inspecting memory/prompts, and tracking token/cost usage.

**Reference sites:** Raycast (dense, keyboard-first), Linear (spacing/hierarchy), Vercel Dashboard (operational clarity), Notion (modular composition)

## Tech Stack
- **Framework:** Next.js 16.2.1 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 + CSS variables (dark-only theme)
- **Components:** shadcn/ui (custom primitives in `src/components/primitives/`)
- **State:** React hooks, Zustand-ready
- **Icons:** Lucide React
- **Ports:** Dev = **3003**

## Directory Structure
```
mission-control/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard
│   ├── layout.tsx        # Root layout (HAS BUG — duplicate export, see below)
│   ├── agents/page.tsx
│   ├── tasks/page.tsx
│   ├── logs/page.tsx
│   ├── memory/page.tsx
│   ├── models/page.tsx
│   ├── costs/page.tsx
│   ├── settings/page.tsx
│   ├── automations/page.tsx
│   ├── claude/page.tsx    # Claude sessions viewer (paginated, 10/page)
│   ├── office/            # Office page (placeholder)
│   └── api/              # API routes
├── src/
│   ├── components/       # Client components
│   │   ├── primitives/   # AppShell, Panel, CommandBar, MetricCard, SectionHeader
│   │   └── *Client.tsx   # Page-level client wrappers
│   ├── viewmodels/       # State/logic hooks per page
│   ├── runtime/          # Runtime state management
│   │   ├── dashboard/    # Dashboard adapter pattern
│   │   └── tasks/        # Task store (SQLite-backed) + SSE event bus
│   ├── server/           # Server-side data readers
│   └── types/            # Shared TypeScript types
├── components/ui/        # shadcn primitives (button, card, input, dialog, command, etc.)
├── lib/utils.ts          # cn() helper
└── styles/               # Design tokens (tokens.css)
```

## Important Conventions

### Imports
- Use `@/` alias for project root (configured in tsconfig)
- shadcn components: `@/components/ui/<component>`
- Primitives: `@/src/components/primitives/<component>`
- Never use relative paths from deep component files

### CSS/Tailwind
- Theme is **dark-only** — no light mode
- CSS variables for all design tokens (in `styles/tokens.css`)
- Use `bg-background`, `text-foreground`, `border-border` from theme
- Glass panels: `glass-panel` class (defined in `styles/tokens.css`, uses blue-ish `--mc-surface-elevated` with `@supports` color-mix fallback)
- Utility classes: `text-muted-foreground`, `bg-accent/35`, `bg-muted/60`

### Components
- Server components by default in `app/` directory
- Wrap with `*Client.tsx` for client-side interactivity
- ViewModels (`use*ViewModel.ts`) handle state/logic, components consume them

## Design Tokens
The `styles/tokens.css` file defines the mission-control color palette using oklch:
- `--mc-bg`: Main background (hue 235)
- `--mc-surface`: Card/panel surface (hue 230)
- `--mc-surface-elevated`: Elevated surfaces / glass panels (hue 225)
- `--mc-border`: Border color (hue 235)
- `--mc-accent`: Primary accent (green, hue 158)
- `--mc-accent-cyan`: Cyan accent (hue 220)
```

## Known Issues

### 1. layout.tsx has duplicate export (BUG)
The file has two `export default` statements:
- `export default function RootLayout` (valid)
- `export default async function Home` (INVALID — follows layout)

**Fix:** Move the Home function export to `app/page.tsx` and remove from layout.tsx.

## Coding Rules

1. **No main branch pushes without PR review** (unless hotfix)
2. **Dark-only** — never add light mode
3. **Keyboard-first** — all interactions should be keyboard accessible
4. **Commit message format:** `type: description` (feat:, fix:, docs:, refactor:)
5. **Dev port is 3003** — always `npm run dev` for local work

## Build Plan Phases (Reference)
The BUILD_PLAN.md defines 9 phases:
1. Foundation Reset (scaffold + shadcn init)
2. Design System (tokens + theme)
3. shadcn Primitive Layer
4. App Shell (sidebar + command bar + inspector)
5. Dashboard v1
6. Model Routing Surface
7. Agents + Task Queue
8. Logs + Memory Inspector
9. Cost + Usage Analytics
10. QA + Hardening

Current state: Shell + primitives exist; tokens.css missing; layout.tsx bug.

## Recent Additions

### Navigation
- **Office** nav item added to AppShell sidebar (between Claude and Settings)
- **"Go to Office"** command added to CommandPalette with `Building2` icon

### Claude Sessions Page (`/claude`)
- Displays Claude Code session data with pagination
- 10 sessions per page, prev/next buttons + numbered page controls

### Tasks Page (`/tasks`) — SQLite-backed
- Kanban board with 5 lanes: now, next, review, blocked, done
- CRUD via API routes (`/api/tasks`) with SSE streaming (`/api/tasks/stream`)
- Tasks persisted in `tasks` table in SQLite (`src/server/db.ts`)
- Store in `src/runtime/tasks/store.ts` — all operations go through DB, no in-memory state
- No placeholder/seed data — page starts empty until tasks are created

#### Task Field Constraints (enforced at TS, API, and DB layers)
- `assignee`: union type `TaskAssignee = "Jarvis" | "Cody"` — `<select>` dropdown in create AND edit forms, API rejects other values, DB CHECK constraint (v2 migration)
- `lane`: union type `TaskLane = "now" | "next" | "review" | "blocked" | "done"` — `<select>` dropdown in create AND edit forms, API rejects other values, DB CHECK constraint
- Canonical arrays `TASK_ASSIGNEES` and `TASK_LANES` exported from `store.ts` — single source of truth used by UI dropdowns, API validators, and DB constraints
- DB migration v2 in `db.ts` normalises legacy free-text assignees to `"Jarvis"` then recreates the table with the CHECK constraint
- Edit form (`EditTaskDialog`) pre-fills current values; submits PATCH `action:"update"` to `/api/tasks`

### Timeline / Activity Feed (`/timeline`) — T-001
- Unified chronological feed of all activity (tasks, agents, sessions, costs)
- **DB:** `timeline_events` table (v3 migration in `src/server/db.ts`) — append-only, `INSERT OR IGNORE`
- **Write path:** `recordEvent()` in `src/server/timeline.ts` — called from task store, agent activity log, and session scanner
- **Event bus:** `src/runtime/timeline/eventsBus.ts` — in-memory pub/sub, same pattern as task events bus
- **API:** `GET /api/timeline` (cursor pagination, source filter) + `GET /api/timeline/stream` (SSE)
- **Types:** `src/types/timeline.ts` — `TimelineEvent`, `TimelineSource`, `TimelineEventType`
- **Page:** `app/timeline/page.tsx` → `TimelineClient` → `useTimelineViewModel`
- **Components:** `TimelineEvent.tsx`, `TimelineFilterBar.tsx`, `TimelineClient.tsx`, `TimelineWidget.tsx`
- **Dashboard widget:** `TimelineWidget` shows 5 most recent events on dashboard
- **Nav:** "Timeline" in AppShell sidebar + "Go to Timeline" (G T) in CommandPalette
- **Keyboard:** Arrow keys / j/k step through events, `f` focuses filter bar
- **Cost spike detection:** Emits `cost.spike` events when agent or session cost > $0.10
- **Event sources wired:** task store (create/update/delete/move), agent activity log, session scanner

### Approvals Inbox (`/approvals`) — T-002
- Human-in-the-loop control plane: agents submit approval requests, operators approve/reject
- **DB:** `approvals` table (v4 migration in `src/server/db.ts`) — status CHECK (pending/approved/rejected/expired), risk_level CHECK (low/medium/high/critical)
- **Server:** `src/server/approvals.ts` — `createApproval()`, `resolveApproval()`, `getApprovals()`, `expireStale()`, `getPendingCount()`
- **Deduplication:** Same agent + action + ref_id within 5-minute window returns existing approval
- **Lazy expiry:** `expireStale()` runs on every read; marks pending items past `expires_at` as expired
- **Optimistic lock:** PATCH only resolves if `status = 'pending'`; returns 409 if already resolved
- **Event bus:** `src/runtime/approvals/eventsBus.ts` — in-memory pub/sub, same pattern as timeline/tasks
- **API:** `POST /api/approvals` (create), `PATCH /api/approvals` (approve/reject), `GET /api/approvals` (list with status/agent/cursor filters), `GET /api/approvals/stream` (SSE)
- **Types:** `src/types/approvals.ts` — `Approval`, `ApprovalStatus`, `ApprovalRiskLevel`
- **Page:** `app/approvals/page.tsx` → `ApprovalsClient` → `useApprovalsViewModel`
- **Components:** `ApprovalCard.tsx`, `ApprovalFilterBar.tsx`, `ApprovalDetailPanel.tsx`, `ApprovalsClient.tsx`, `ApprovalsBadge.tsx`, `ApprovalsWidget.tsx`
- **Dashboard widget:** `ApprovalsWidget` shows pending count + oldest item
- **Nav:** "Approvals" in AppShell sidebar (with live badge) + "Go to Approvals" (G A) in CommandPalette
- **Keyboard:** Arrow keys / j/k navigate, `a` approve, `r` reject, `f` focus filter, Enter expand details, Escape close
- **Timeline integration:** All approval state changes emit timeline events via `recordEvent()`

### Retry Center (`/retries`) — T-003
- Surfaces all failed agent runs, task executions, and session crashes in one place
- **DB:** `retries` table + `retry_attempts` table (v5 migration in `src/server/db.ts`)
- **Statuses:** `failed` | `retrying` | `resolved` | `dismissed` — CHECK constraints
- **Sources:** `agents` | `tasks` | `sessions`
- **Server:** `src/server/retries.ts` — `createRetryEntry()`, `attemptRetry()`, `dismissRetry()`, `getRetries()`, `getFailedCount()`, `getAttempts()`
- **Max attempts:** Default 3 per retry; auto-dismiss when exceeded
- **Event bus:** `src/runtime/retries/eventsBus.ts` — in-memory pub/sub, same pattern as timeline/approvals
- **API:** `GET /api/retries` (status/source/cursor pagination), `POST /api/retries` (create), `POST /api/retries/retry` (retry), `PATCH /api/retries` (dismiss), `GET /api/retries/stream` (SSE)
- **Types:** `src/types/retries.ts` — `RetryEntry`, `RetryAttempt`, `RetrySource`, `RetryStatus`
- **Page:** `app/retries/page.tsx` → `RetriesClient` → `useRetriesViewModel`
- **Components:** `RetryCard.tsx`, `RetryFilterBar.tsx`, `RetryDetailPanel.tsx`, `RetriesClient.tsx`, `RetriesBadge.tsx`, `RetriesWidget.tsx`
- **Dashboard widget:** `RetriesWidget` shows failed count + most recent failure
- **Nav:** "Retries" in AppShell sidebar (with live red badge) + "Go to Retries" (G R) in CommandPalette
- **Keyboard:** Arrow keys / j/k navigate, `R` retry, `d` dismiss, `f` focus filter, Enter expand details, Escape close
- **Timeline integration:** All retry state changes emit timeline events via `recordEvent()`
- **Optimistic UI:** Cards show immediate status change, roll back on API failure

### Design Tokens Color Scheme
- Core colors use blue-ish hues (hue ~225-235) for bg, surface, and borders
- Glass-panel class uses `--mc-surface-elevated` and `--mc-border` with blue hues
- Accent colors: `--mc-accent` (green, hue 158), `--mc-accent-cyan` (cyan, hue 220)

## Feature Build Plans

Individual feature build plans live in the repo root as `buildplan-T-XXX.md` files. These are implementation-ready specs covering goal, data sources, schema, API routes, UI components, phased milestones, edge cases, and acceptance criteria.

| File | Task | Status |
|---|---|---|
| `buildplan-T-001.md` | Timeline / Activity Feed | Implemented |
| `buildplan-T-002.md` | Approvals Inbox | Implemented |
| `buildplan-T-003.md` | Retry Center | Implemented |
| `buildplan-T-004.md` | Prompt / Run Inspector | Planning |
| `buildplan-T-005.md` | Daily Briefing Page | Planning |
| `buildplan-T-006.md` | Agent Memory Graph | Planning |

## Quick Commands
```bash
npm run dev          # Start dev server on port 3003
npm run build        # Production build
npm run lint         # ESLint check
npm run tsc-lint     # TypeScript check
npm run purge        # Clean .next cache
```
