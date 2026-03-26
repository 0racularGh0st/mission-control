# Mission Control — Build Plan

## Product Goal
Production-grade **AI Mission Control OS**: a keyboard-first, dark-only command center for orchestrating agents, routing tasks between models, watching logs in real time, inspecting memory/prompts, and tracking token/cost usage.

Design direction:
- **Raycast** — dense, keyboard-first command surfaces
- **Linear** — spacing, hierarchy, restraint
- **Vercel Dashboard** — operational clarity, cards, monitoring
- **Notion** — modular composition and calm layout

Core stack:
- Next.js 16 (App Router)
- TypeScript 5
- Tailwind CSS v4 (CSS-first config)
- shadcn/ui (component system)
- Lucide React (icons)
- SSE for real-time streaming

Non-negotiables:
- Commit to **main only**
- Mission-control repo contains **mission-control project files only**
- Jarvis/openclaw/routing/personal configs stay in workspace-level files
- Use `@/components/ui/<component>` imports for shadcn components
- Dev port: **3003**
- Dark-only — no light mode

---

## Current State

The MVP is substantially complete. All core pages, API routes, server readers, and runtime infrastructure are built. The app runs on port 3003 with a full dark theme, keyboard navigation, and real-time SSE streaming.

### Architecture

```
app/                          Next.js App Router (server components)
├── api/                      11 API endpoints
├── styles/tokens.css         OKLch design tokens (Jarvis Dark)
src/
├── components/               Client components + primitives
│   └── primitives/           AppShell, Panel, CommandBar, MetricCard, SectionHeader
├── viewmodels/               State/logic hooks per page
├── runtime/                  Dashboard adapter pattern (mock/real switching)
│   └── tasks/                In-memory task store + event bus
├── server/                   Server-side data readers
└── types/                    Shared TypeScript types
components/ui/                shadcn primitives
```

### Data flow
Server component (SSR fetch) → `*Client.tsx` (hydration) → ViewModel hook (transform) → UI render. Real-time updates via `useDashboardRuntime` hook polling SSE streams.

### Runtime adapter pattern
`MISSION_CONTROL_RUNTIME_SOURCE` env var switches between `"mock"` (default) and `"local"` (real adapter reading workspace data).

---

## Phase 0 — Foundation Reset ✅ COMPLETE

- Next.js 16 scaffold with App Router
- shadcn initialized (`components.json`, `@/` alias, Tailwind content wiring)
- Base dependencies installed (radix-ui, cmdk, cva, clsx, tailwind-merge)
- App runs on port 3003

## Phase 1 — Design System ✅ COMPLETE

- `app/styles/tokens.css` — full OKLch color system (Jarvis Dark theme)
- `tailwind.config.cjs` — extended with `jarvis` color palette
- `ThemeProvider` component wired into root layout
- Utility classes: `glass-panel`, `accent-glow`, `dashboard-shell`, `text-muted`, `panel`
- `globals.css` with Tailwind v4 `@theme` inline syntax

## Phase 2 — shadcn Primitive Layer ✅ COMPLETE

### Installed shadcn components
- button, card, input, input-group, textarea, dialog, command

### Not yet installed (install as needed)
- dropdown-menu, tabs, badge, table, scroll-area, separator, sheet, skeleton, tooltip

### Custom primitives built
- `AppShell` — 3-column layout (sidebar, main, inspector)
- `Panel` — card wrapper with title/description
- `CommandBar` — command palette trigger + search
- `MetricCard` — KPI display
- `SectionHeader` — title + description + action slot

## Phase 3 — App Shell ✅ COMPLETE

- Persistent 3-column layout: left sidebar, main content, right inspector skeleton
- Sidebar nav: Dashboard, Agents, Tasks, Logs, Memory, Models, Costs, Settings, Office, Automations
- `Cmd+K` command palette (Raycast-style, `CommandPalette.tsx`)
- Keyboard shortcut hints
- Geist font loaded via Google Fonts
- `data-theme="jarvis-dark"` + `dark` class on root

## Phase 4 — Dashboard v1 ✅ COMPLETE

- `DashboardClient.tsx` — metrics grid, active agents, task queue snapshot, alerts
- SSR fetch via `getDashboardRuntimeState()` → client hydration
- Real-time polling via `useDashboardRuntime` hook
- `useDashboardViewModel` transforms runtime DTO into displayable metrics
- Mock adapter provides realistic placeholder data

## Phase 5 — Model Routing Surface ✅ COMPLETE

- `/models` page with routing matrix and fallback logic
- Per-model performance metrics display
- `routingReader.ts` reads workspace-level routing config
- Repo stays clean of personal routing config

## Phase 6 — Agents + Task Queue ✅ COMPLETE

- `/agents` page with status indicators and health info
- `AgentActivityClient` — real-time activity timeline
- `agentsReader.ts` reads agent configs from workspace
- `agentActivityLog.ts` parses `.runtime/agent-activity.log`
- `sessionMonitor.ts` monitors agent session health
- `/tasks` page — full Kanban board (Now/Next/Review/Blocked/Done lanes) with detail modals
- In-memory task store (`src/runtime/tasks/store.ts`) with CRUD + event bus
- SSE stream at `/api/tasks/stream` for live task updates

## Phase 7 — Logs + Memory Inspector ✅ COMPLETE

- `/logs` page with filtering by agent/task/model
- `LogsClient.tsx` + `useLogsViewModel` for log formatting
- `/memory` page with file browser and syntax highlighting
- `memoryReader.ts` scans and indexes memory files
- Read-only inspection as planned

## Phase 8 — Cost + Usage Analytics ✅ COMPLETE

- `/costs` page with per-model breakdown, daily totals, trend visualization
- `CostsClient.tsx` — cost charts, trend analysis, per-model breakdown
- `minimaxReporting.ts` — MiniMax API integration for token costs
- `openaiAdminReporting.ts` — OpenAI Admin API integration
- `/api/openai/reporting` endpoint

## Phase 9 — QA + Hardening ⚠️ IN PROGRESS

### Done
- Playwright configured (`playwright.config.ts`)
- Keyboard navigation functional
- ESLint + TypeScript strict checking (`npm run lint`, `npm run tsc-lint`)
- Husky git hooks set up

### Remaining
- [ ] Write E2E smoke tests (Playwright — `tests/` directory is empty)
- [ ] Add UI regression checks
- [ ] Verify responsive behavior across breakpoints
- [ ] Verify all shadcn components remain canonical
- [ ] Audit hydration/layout issues
- [ ] Add error boundaries for runtime failures

---

## Additional Surfaces (Built Outside Original Plan)

### /office — Agent Office Visualization ✅ COMPLETE
Pixel-art canvas (`OfficeCanvas.tsx`, 433 lines) showing agents moving between rooms. `useOfficeViewModel` tracks agent positions. Not in the original plan but fully functional.

### /automations — Automation Rules ⚠️ PARTIAL
- `AutomationsClient.tsx` — rule builder UI with execution history display
- `automationReader.ts` — reads automation rules from filesystem
- `/api/automations` — GET/POST endpoint
- **Missing:** backend rule execution engine; rules can be defined but don't run

### /settings ❌ SCAFFOLDED ONLY
- `app/settings/page.tsx` exists but renders an empty placeholder
- No settings UI built yet

### Right Inspector Panel ⚠️ SKELETON ONLY
- Slot exists in `AppShell` layout (third column)
- No contextual content wired — clicking items does not populate the inspector

---

## What's Next

### Priority 1 — Complete Phase 9 (QA)
- Write Playwright smoke tests covering core navigation and page loads
- Add error boundaries around runtime data fetching
- Audit hydration warnings

### Priority 2 — Inspector Panel
- Wire right inspector to show contextual detail when selecting agents, tasks, logs
- Support keyboard-driven focus (select item → inspector populates)

### Priority 3 — Settings Page
- Build settings UI for theme, keyboard shortcuts, runtime source toggle
- Persist settings (localStorage or filesystem)

### Priority 4 — Automations Backend
- Wire rule execution engine to automation definitions
- Add scheduling/trigger support
- Connect to agent activity events

### Priority 5 — Additional shadcn Components
- Install dropdown-menu, tabs, badge, table, scroll-area as surfaces need them
- Avoid installing speculatively — add when a feature requires them

---

## API Endpoints Reference

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/agents` | GET, POST | List/create agents |
| `/api/agents/activity` | GET | Agent activity history |
| `/api/tasks` | GET, POST, PATCH | Task CRUD |
| `/api/tasks/stream` | GET (SSE) | Real-time task updates |
| `/api/models` | GET | Model routing config |
| `/api/costs` | GET | MiniMax token/cost data |
| `/api/memory` | GET | Memory file entries |
| `/api/automations` | GET, POST | Automation rules |
| `/api/runtime/dashboard` | GET | Dashboard state snapshot |
| `/api/runtime/dashboard/stream` | GET (SSE) | Incremental dashboard updates |
| `/api/openai/reporting` | GET | OpenAI admin cost data |

---

## Operating Notes
- Cody handles build work
- Jarvis remains orchestrator/product lead
- Runtime data comes from workspace-level files (`.runtime/`, agent configs) — not embedded in this repo
- For production: replace in-memory task store with a DB adapter

---

**Status:** MVP complete — iterating on QA, inspector, and settings
