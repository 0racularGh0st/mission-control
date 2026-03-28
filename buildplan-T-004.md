# T-004 — Prompt / Run Inspector

**Type:** Feature
**Status:** Planning
**Created:** 2026-03-28

---

## Goal

Build a Prompt / Run Inspector that lets operators drill into any agent run or Claude session to see the full prompt chain, model responses, tool calls, token usage, timing, and cost breakdown — providing x-ray visibility into what agents are actually doing.

---

## User Value

When an agent produces unexpected output or a session costs more than expected, operators need to answer: _"What prompts were sent? What did the model return? Where did the tokens go?"_ The Inspector turns the existing right-sidebar skeleton into a detailed, interactive debugging surface — the DevTools of agent orchestration.

---

## Scope

- Activate the existing right-sidebar Inspector panel in AppShell for contextual detail
- Full prompt/response viewer for any agent run or Claude session
- Token usage breakdown per message (input/output/cache)
- Cost attribution per step in a run
- Tool call visualization: which tools were called, arguments, results
- Timing waterfall: how long each step took
- Accessible from: clicking any agent row, session row, timeline event, or retry card
- Keyboard shortcut: `i` to toggle inspector, `Escape` to close
- Deep-linkable: `/inspect/:source/:id` for direct access

---

## Non-Goals

- Editing or replaying prompts (read-only inspection)
- Comparing two runs side-by-side (v1 is single-run view)
- Real-time streaming of in-progress runs (v1 shows completed runs)
- Prompt template management or versioning
- LLM output evaluation or scoring

---

## Data Sources

| Source | Table / Origin | Data Available |
|---|---|---|
| Agent runs | `agent_activity` | session_key, model, tokens, cost, status, timestamps |
| Claude sessions | `claude_sessions` | session_id, model, tokens, cache, cost, transcript |
| Transcripts | `claude_sessions.transcript_path` | Full JSONL conversation files on disk |
| Run metadata | Derived from agent logs | Prompt text, tool calls, responses, timing |

---

## Schema / Storage Implications

### No new tables required

The Inspector reads from existing tables (`agent_activity`, `claude_sessions`) and on-disk transcript files. The primary new work is parsing and presenting transcript data.

### New server module: `src/server/inspector.ts`

Responsible for:
- Loading and parsing JSONL transcript files from `claude_sessions.transcript_path`
- Extracting structured message data: role, content, tool calls, token counts
- Computing per-message cost attribution
- Building a timing waterfall from message timestamps

### Transcript message shape (parsed from JSONL):

```typescript
interface InspectorMessage {
  index: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;               // Text content (may be truncated for display)
  tool_calls?: ToolCallInfo[];    // Tool invocations by assistant
  tool_result?: string;           // Result from tool execution
  tokens_in: number;
  tokens_out: number;
  tokens_cache: number;
  cost_usd: number;
  timestamp: string;
  duration_ms: number;            // Time from this message to next
}

interface ToolCallInfo {
  name: string;
  arguments: string;              // JSON string
  result_preview: string;         // First 500 chars of result
}
```

---

## API / Routes

### `GET /api/inspect/:source/:id`

Load full inspection data for an agent run or session.

Params:
- `source` — `agents` | `sessions`
- `id` — `agent_activity.id` or `claude_sessions.session_id`

Response:
```json
{
  "meta": {
    "source": "sessions",
    "id": "session-abc",
    "model": "claude-sonnet-4-6",
    "status": "completed",
    "total_tokens_in": 45200,
    "total_tokens_out": 12800,
    "total_tokens_cache": 32000,
    "total_cost_usd": 0.042,
    "started_at": "2026-03-28T14:00:00Z",
    "ended_at": "2026-03-28T14:05:23Z",
    "duration_ms": 323000
  },
  "messages": [
    {
      "index": 0,
      "role": "system",
      "content": "You are an AI assistant...",
      "tokens_in": 1200,
      "tokens_out": 0,
      "cost_usd": 0.001,
      "timestamp": "2026-03-28T14:00:00Z",
      "duration_ms": 0
    },
    {
      "index": 1,
      "role": "user",
      "content": "Fix the login bug in auth.ts",
      "tokens_in": 24,
      "tokens_out": 0,
      "cost_usd": 0.0001,
      "timestamp": "2026-03-28T14:00:01Z",
      "duration_ms": 3200
    }
  ],
  "tool_summary": {
    "total_calls": 12,
    "tools_used": ["Read", "Edit", "Bash", "Grep"],
    "by_tool": { "Read": 5, "Edit": 3, "Bash": 2, "Grep": 2 }
  },
  "cost_breakdown": {
    "input": 0.027,
    "output": 0.012,
    "cache": 0.003
  }
}
```

### `GET /api/inspect/:source/:id/message/:index`

Load full content of a single message (for large messages truncated in the list view).

---

## UI Sections / Components

### Right Sidebar: Inspector Panel (wired into AppShell)

The existing AppShell has a right sidebar placeholder labeled "Inspector". This feature wires it to show contextual detail when an item is selected anywhere in the app.

```
┌──────────────────────────┐
│ Inspector        [✕ Esc] │
├──────────────────────────┤
│ Session abc · sonnet-4-6 │
│ 5m 23s · $0.042          │
│                          │
│ ┌─ Tokens ─────────────┐ │
│ │ In: 45.2K  Out: 12.8K│ │
│ │ Cache: 32K            │ │
│ └───────────────────────┘ │
│                          │
│ ┌─ Tools Used ─────────┐ │
│ │ Read(5) Edit(3)      │ │
│ │ Bash(2) Grep(2)      │ │
│ └───────────────────────┘ │
│                          │
│ ┌─ Messages ───────────┐ │
│ │ 0 system  1.2K tok   │ │
│ │ 1 user    24 tok     │ │
│ │ 2 asst    3.4K tok ▸ │ │
│ │   └ Read auth.ts     │ │
│ │   └ Edit auth.ts     │ │
│ │ 3 tool    result     │ │
│ │ ...                  │ │
│ └───────────────────────┘ │
│                          │
│ [Open Full View →]       │
└──────────────────────────┘
```

### Full Page: `app/inspect/[source]/[id]/page.tsx`

Deep-linkable full-page view with the same data but more horizontal space for prompt/response content.

### Sub-components

| Component | Location | Purpose |
|---|---|---|
| `InspectorPanel` | `src/components/InspectorPanel.tsx` | Right sidebar inspector — compact view of run/session |
| `InspectorFullView` | `src/components/InspectorFullView.tsx` | Full-page detailed inspection view |
| `MessageList` | `src/components/inspector/MessageList.tsx` | Scrollable list of messages with role icons and token counts |
| `MessageDetail` | `src/components/inspector/MessageDetail.tsx` | Expanded single message with full content, tool calls |
| `TokenBreakdown` | `src/components/inspector/TokenBreakdown.tsx` | Visual bar chart of token usage (input/output/cache) |
| `ToolCallView` | `src/components/inspector/ToolCallView.tsx` | Tool name, arguments (collapsible JSON), result preview |
| `TimingWaterfall` | `src/components/inspector/TimingWaterfall.tsx` | Horizontal bar chart showing time per step |
| `CostAttribution` | `src/components/inspector/CostAttribution.tsx` | Per-message cost with running total |

### ViewModel: `src/viewmodels/useInspectorViewModel.ts`

- Loads inspection data on `source + id` change
- Holds `meta`, `messages[]`, `toolSummary`, `costBreakdown`
- Exposes `selectMessage(index)`, `expandToolCall(index)`, `togglePanel()`
- Manages selected message state for detail view

### Integration points

- **Agent rows** (agents page): clicking a row sets inspector context
- **Session rows** (claude page): clicking a row sets inspector context
- **Timeline events**: clicking an event with `ref_id` opens inspector for that ref
- **Retry cards**: "View Error" opens inspector for the failed run

---

## Phased Milestones

### Phase 1 — Server-side transcript parsing
- [ ] Add `src/server/inspector.ts` with transcript JSONL parser
- [ ] Extract messages, token counts, tool calls from transcript files
- [ ] Compute per-message cost attribution using model pricing
- [ ] Build timing waterfall from message timestamps

### Phase 2 — Inspect API
- [ ] `GET /api/inspect/:source/:id` endpoint
- [ ] `GET /api/inspect/:source/:id/message/:index` for full message content
- [ ] TypeScript types in `src/types/inspector.ts`
- [ ] Handle missing transcripts gracefully (show metadata only)

### Phase 3 — Right sidebar Inspector panel
- [ ] `InspectorPanel` component wired into AppShell right sidebar
- [ ] `MessageList` with collapsible messages
- [ ] `TokenBreakdown` bar chart
- [ ] `ToolCallView` with collapsible arguments
- [ ] `useInspectorViewModel.ts`
- [ ] Keyboard: `i` to toggle, `Escape` to close

### Phase 4 — Full page view
- [ ] `app/inspect/[source]/[id]/page.tsx` with dynamic route
- [ ] `InspectorFullView` with wider layout for content
- [ ] `MessageDetail` with full prompt/response rendering
- [ ] `TimingWaterfall` horizontal chart
- [ ] `CostAttribution` with running totals
- [ ] "Open Full View" link from sidebar panel

### Phase 5 — Cross-page integration
- [ ] Wire agent rows to set inspector context
- [ ] Wire session rows to set inspector context
- [ ] Wire timeline events to open inspector via `ref_id`
- [ ] Wire retry cards "View Error" to inspector
- [ ] Add "Inspect Run" command to CommandPalette
- [ ] Deep link support: `/inspect/sessions/abc123` directly openable

---

## Edge Cases

| Case | Handling |
|---|---|
| Transcript file missing on disk | Show metadata from DB only; message list shows "Transcript not available" |
| Transcript file is very large (>50MB) | Stream-parse JSONL; paginate messages (50 per page); never load full file into memory |
| Session still in progress | Show "In Progress" badge; display messages available so far; no timing waterfall |
| Tool call arguments contain sensitive data | Display as-is in v1 (local-only tool); note: future versions may add redaction |
| Message content is very long (>10K chars) | Truncate to 500 chars in list view; full content in detail view |
| Unknown tool names in transcript | Render tool name as-is with generic icon |
| Cost calculation mismatch with session total | Show per-message breakdown with note: "Estimated — may differ from session total" |
| Multiple transcripts for one session | Use most recent by file modification time |
| Inspector opened with no selection | Show empty state: "Select an agent run, session, or event to inspect" |
| Rapid clicking between items | Abort previous fetch; show loading skeleton; render only latest selection |

---

## Acceptance Criteria

- [ ] Clicking an agent run row opens the inspector panel with run details
- [ ] Clicking a Claude session row opens the inspector with full transcript parsed
- [ ] Messages display with correct role icons, token counts, and timestamps
- [ ] Tool calls are visible with collapsible arguments and result previews
- [ ] Token breakdown chart accurately shows input/output/cache split
- [ ] Cost attribution per message sums to approximate session total
- [ ] Timing waterfall shows relative duration of each step
- [ ] Full page view at `/inspect/:source/:id` renders complete inspection
- [ ] Deep links work: navigating directly to `/inspect/sessions/abc` loads correctly
- [ ] Keyboard shortcuts: `i` toggles inspector, `Escape` closes, arrow keys navigate messages
- [ ] Missing transcripts show graceful fallback with metadata only
- [ ] Large transcripts (>1000 messages) paginate without browser freeze
- [ ] TypeScript strict mode: no `any` in new files
- [ ] `npm run build` passes with no errors after implementation
