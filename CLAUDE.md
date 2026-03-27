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
│   │   └── dashboard/    # Dashboard adapter pattern
│   ├── server/           # Server-side data readers
│   └── types/            # Shared TypeScript types
├── components/ui/        # shadcn primitives (button, card, input, dialog, command, etc.)
├── lib/utils.ts          # cn() helper
└── styles/               # Design tokens (tokens.css — MISSING, see Issues)
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
- Glass panels: `glass-panel` class (defined in globals.css)
- Utility classes: `text-muted-foreground`, `bg-accent/35`, `bg-muted/60`

### Components
- Server components by default in `app/` directory
- Wrap with `*Client.tsx` for client-side interactivity
- ViewModels (`use*ViewModel.ts`) handle state/logic, components consume them

## Design Tokens (MISSING — needs creation)
The `styles/tokens.css` file is referenced in `globals.css` but **does not exist yet**. Must create:

```css
/* styles/tokens.css */
:root {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #0a0a0c;
  --card-foreground: #fafafa;
  --popover: #0a0a0c;
  --popover-foreground: #fafafa;
  --primary: #3b82f6;
  --primary-foreground: #ffffff;
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: #27272a;
  --muted-foreground: #71717a;
  --accent: #3b82f6;
  --accent-foreground: #ffffff;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #27272a;
  --input: #27272a;
  --ring: #3b82f6;
  --radius: 0.5rem;
}
```

## Known Issues

### 1. layout.tsx has duplicate export (BUG)
The file has two `export default` statements:
- `export default function RootLayout` (valid)
- `export default async function Home` (INVALID — follows layout)

**Fix:** Move the Home function export to `app/page.tsx` and remove from layout.tsx.

### 2. styles/tokens.css missing
globals.css imports `./styles/tokens.css` but directory doesn't exist. Must create it.

### 3. globals.css uses Tailwind v4 @theme inline syntax
But package.json shows `@tailwindcss/postcss: ^4` and `tailwindcss: ^4`. This is correct for Tailwind v4 which uses the new CSS-first configuration.

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

## Quick Commands
```bash
npm run dev          # Start dev server on port 3003
npm run build        # Production build
npm run lint         # ESLint check
npm run tsc-lint     # TypeScript check
npm run purge        # Clean .next cache
```
