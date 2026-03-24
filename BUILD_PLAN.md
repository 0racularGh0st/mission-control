# Mission Control — Refined Build Plan

## Product Goal
Build a production-grade **AI Mission Control OS**: a keyboard-first, dark-only command center for orchestrating agents, routing tasks between models, watching logs in real time, inspecting memory/prompts, and tracking token/cost usage.

Design direction:
- **Raycast** → dense, keyboard-first command surfaces
- **Linear** → spacing, hierarchy, restraint
- **Vercel Dashboard** → operational clarity, cards, monitoring
- **Notion** → modular composition and calm layout

Core stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- **shadcn/ui as the default component system**
- Zustand (or equivalent) for client state when needed
- SSE/WebSocket-ready log surfaces

Non-negotiables:
- Commit to **main only**
- Mission-control repo contains **mission-control project files only**
- Jarvis/openclaw/routing/personal configs stay in workspace-level files
- Use `@/components/ui/<component>` imports for shadcn components
- Dev port: **3003**

---

## Current Reality Check
Before building features, the foundation must be corrected:
- shadcn is **not fully installed/wired correctly yet**
- the current scaffold needs a proper design-system-first setup
- model routing config belongs to workspace/OpenClaw, not this repo
- we should build the UI shell only after the shadcn layer is stable

So the revised plan below is stricter and more implementation-ready.

---

## Phase 0 — Foundation Reset (Immediate)
Objective: make the repo a clean, dependable product foundation.

### Tasks
1. Verify/create clean Next.js scaffold in repo root
2. Properly initialize shadcn with the provided preset
3. Ensure generated files are correct:
   - `components.json`
   - `app/globals.css`
   - alias support in `tsconfig.json`
   - proper Tailwind content wiring
4. Install required base UI dependencies
5. Confirm the following work before any feature building:
   - `npx shadcn@latest add button` works
   - components generate under `components/ui/`
   - app runs on port 3003

### Deliverables
- working Next app
- shadcn initialized and functional
- button/card/input/dialog installable without friction
- clean base commit on `main`

---

## Phase 1 — Design System (Jarvis UI Core)
Objective: establish a reusable visual system before screens.

### Tasks
1. Create dark-first token layer:
   - `app/styles/tokens.css`
2. Define:
   - background
   - panel/surface
   - border
   - text tiers
   - accent
   - spacing scale: `4, 8, 12, 16, 24, 32`
   - radii and elevation
3. Wire tokens into Tailwind theme
4. Create theme/provider plumbing
5. Add utility classes for:
   - glass panels
   - muted text
   - accent glow
   - dashboard shells

### Deliverables
- `tokens.css`
- Tailwind theme mapping
- Theme provider
- stable dark-only visual foundation

---

## Phase 2 — shadcn Primitive Layer
Objective: create the reusable UI building blocks.

### Required shadcn components
Install and standardize at least:
- button
- card
- input
- textarea
- dialog
- dropdown-menu
- tabs
- badge
- table
- scroll-area
- separator
- sheet
- skeleton
- tooltip
- command

### Tasks
1. Install missing shadcn components via CLI
2. Create thin wrappers/compositions only where needed
3. Build shared primitives:
   - `AppShell`
   - `Panel`
   - `MetricCard`
   - `SectionHeader`
   - `CommandBar`
4. Keep styling restrained and compositional

### Deliverables
- stable `components/ui/*`
- reusable higher-level dashboard primitives
- no ad-hoc random styling everywhere

---

## Phase 3 — Information Architecture + App Shell
Objective: create the structural layout of Mission Control.

### Main layout
- **Left Sidebar**
  - Dashboard
  - Agents
  - Tasks
  - Logs
  - Memory
  - Models
  - Costs
  - Settings
- **Top Command Bar**
  - global search / command input
  - quick actions
  - keyboard-first entry
- **Main Content Grid**
- **Right Inspector**
  - contextual detail pane

### Tasks
1. Build persistent app shell
2. Add responsive layout behavior
3. Add keyboard shortcut hints
4. Add `Cmd+K` command palette shell

### Deliverables
- navigable shell
- sidebar/topbar/inspector layout
- keyboard-first UX foundation

---

## Phase 4 — Dashboard v1
Objective: make the landing screen feel like a real operational center.

### Dashboard sections
- Active agents
- Task queue snapshot
- Token/cost summary
- Model routing summary
- Recent logs
- Alerts / stuck tasks

### Tasks
1. Build dashboard cards with strong hierarchy
2. Use placeholder/mock operational data initially
3. Prioritize legibility and scanning speed
4. Avoid clutter and decorative noise

### Deliverables
- polished dashboard homepage
- visually coherent command center feel

---

## Phase 5 — Model Routing Surface
Objective: expose model orchestration clearly.

### Tasks
1. Build UI for:
   - selected/default model
   - routing policy summary
   - fallbacks
   - task → model mapping
2. Visualize route flow:
   - input
   - router decision
   - selected model
   - fallback path
3. Pull routing data from workspace-level config or mocked adapter
4. Keep repo free of personal routing config

### Deliverables
- models page
- routing panel
- route visualization cards/flow

---

## Phase 6 — Agents + Task Queue
Objective: monitor work happening across agents.

### Tasks
1. Build agents page with:
   - status
   - current task
   - model used
   - token/cost summary
   - last activity
2. Build task queue UI with:
   - queued
   - running
   - blocked
   - done
3. Support future live updates with SSE/WebSocket-friendly state boundaries

### Deliverables
- agents board
- queue board
- execution status views

---

## Phase 7 — Logs + Memory Inspector
Objective: make internals inspectable.

### Logs
- stream viewer
- filter by agent/task/model
- severity states
- compact readable rows

### Memory
- inspect memory entries
- inspect prompts/system context summaries
- read-only first

### Deliverables
- logs page
- memory page
- inspector integration

---

## Phase 8 — Cost + Usage Analytics
Objective: operational visibility.

### Tasks
1. Add cost cards:
   - per task
   - per model
   - daily total
2. Add token usage summaries
3. Add trend charts (simple first)
4. Add cheap-vs-expensive routing comparisons

### Deliverables
- cost dashboard
- usage breakdown panels

---

## Phase 9 — QA + Hardening
Objective: ensure the app is stable enough to iterate fast.

### Tasks
1. Add smoke tests
2. Add UI regression checks later
3. Verify keyboard nav
4. Verify responsive behavior
5. Verify shadcn components remain canonical
6. Fix hydration/layout issues early

### Deliverables
- stable local QA baseline
- reduced regression risk

---

## Build Order (Strict Execution Sequence)
1. Fix scaffold + shadcn init
2. Install core shadcn components
3. Add token/theme system
4. Build primitive layer
5. Build shell layout
6. Build dashboard
7. Build models/routing UI
8. Build agents/tasks/logs
9. Build costs/memory
10. QA and polish

---

## Immediate Execution Tasks
These are the first implementation tickets to execute now:

### Ticket 1 — shadcn foundation
- initialize/fix shadcn
- verify `button`, `card`, `input`, `dialog`, `command`
- commit to `main`

### Ticket 2 — theme system
- add tokens
- wire Tailwind theme
- add ThemeProvider
- commit to `main`

### Ticket 3 — primitive layer
- create shell-safe reusable primitives built on shadcn
- commit to `main`

### Ticket 4 — app shell
- sidebar + top bar + inspector skeleton
- commit to `main`

---

## Success Criteria
We are done with the first meaningful milestone when:
- shadcn is properly installed and generating components
- the app runs locally on 3003
- the shell looks visually intentional
- the dashboard feels like Mission Control, not boilerplate
- future work can proceed without refactoring the foundation again

---

## Operating Notes
- Cody should start with **Phase 0 / Ticket 1 immediately**
- Cody should use **gpt-5.3-codex** for the build work
- Jarvis remains orchestrator/product lead and pushes progress updates proactively
- Sandra stays out of the loop until explicitly requested

---

**Status:** Ready for execution
**Next action:** Cody starts shadcn foundation work now
