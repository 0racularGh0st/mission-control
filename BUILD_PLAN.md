Mission Control — BUILD_PLAN (start-over)

Goal
- Rebuild a production-quality "AI Mission Control OS" dashboard (Next.js + TypeScript + Tailwind + shadcn/ui). Dark-only Jarvis theme, glassmorphism, cyan/blue accent, rounded-xl/2xl, spacing scale: 4,8,12,16,24,32.

Phase 0 — Repo reset (this commit)
- Keep repository minimal and authoritative: only BUILD_PLAN.md in the repo root. No workspace or Jarvis-specific files in the repo.
- Future code will be committed directly to main only, per Nigel's instruction.

Phase 1 — Design system & foundation (2–4 days)
- Add tokens: app/styles/tokens.css (dark-first tokens). Map to Tailwind in tailwind.config.js.
- Install shadcn presets and required libs (lucide-react, class-variance-authority, tailwind-merge). Use npx shadcn@latest add ... as needed.
- Create ThemeProvider (client) and global CSS import. Persist theme choices in workspace-level config (not in repo).
- Deliverables: tokens.css, tailwind.config.js, ThemeProvider.tsx, README section describing theme usage.

Phase 2 — Primitive components (2–3 days)
- Implement shadcn-based primitives under src/components/ui: Button, Card, Input, Panel, Dialog.
- Each primitive must have TypeScript types, tests, and a small demo in app/page.tsx.
- Deliverables: components, demo page, small visual tests.

Phase 3 — Layout & shell (2–3 days)
- Implement Dashboard shell: Left Sidebar, Top Bar (with Cmd+K palette), Main grid, Right Inspector.
- Add Header toggle and command-palette skeleton. Ensure keyboard-first navigation.
- Deliverables: layout components, command-palette placeholder.

Phase 4 — Routing engine & visualization (3–5 days)
- Integrate RouteManager (use local routing config from workspace, not committed to repo).
- Build visualization panel showing user → router → model decisions, cost estimates, and fallback paths.
- Deliverables: RouteManager UI, sample route flows, mock data integration.

Phase 5 — Agents, Tasks & Logs (4–6 days)
- Implement Agent widgets, Task queue UI, Logs panel (WebSocket/SSE-ready interfaces). Task persistence to obsidian-vault/tasks.json is out-of-repo and optional.
- Deliverables: Agents board, Task queue UI, streaming logs viewer.

Phase 6 — Memory & Cost Inspector (2–3 days)
- Memory inspector (read-only view), token usage / cost widgets, daily/weekly costing charts.
- Deliverables: Memory panel, cost calculator UI.

Phase 7 — QA, tests & automation (3–5 days)
- Add Sandra Playwright visual snapshots and smoke tests. Local QA runner script to run tests and collect results.
- Deliverables: test suite, sample run artifacts, CI optional.

Phase 8 — Polish & handoff (2–4 days)
- Accessibility pass, performance tweaks, docs (README, contributing), and handoff notes.

Rules & Constraints
- Commits go to main only unless Nigel explicitly says otherwise. No feature branches by default.
- Use shadcn/ui for interface primitives; import from "@/components/ui/<component>".
- Jarvis/workspace-level configs (model routing, memory, agent policies) remain outside the repo at workspace-level files.
- Jarvis will post major progress updates and SMS-style short alerts at milestone completion.
- Dev server default port: 3003.

Immediate next step
- This repo will now contain only BUILD_PLAN.md (this file). Tell me when you want me to begin Phase 1 and I will: install shadcn, add tokens, create ThemeProvider, and commit directly to main with short SMS updates at each milestone.

— Nigel & Jarvis, 2026-03-24
