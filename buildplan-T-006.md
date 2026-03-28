# T-006 — Agent Memory Graph

**Type:** Feature
**Status:** Planning
**Created:** 2026-03-28

---

## Goal

Build an Agent Memory Graph that visualizes the knowledge, context, and relationships stored in agent memory systems — showing what each agent knows, how memories connect across topics, and how memory evolves over time — giving operators a window into agent cognition.

---

## User Value

Agents accumulate memory (CLAUDE.md files, project context, user preferences, feedback) but this knowledge is opaque. Operators need to answer: _"What does Jarvis know about this project? Are agents building on stale context? What connections exist between memories?"_ The Memory Graph makes the invisible visible — surfacing what agents remember so operators can audit, prune, and trust.

---

## Scope

- Dedicated page at `/memory` (enhance existing placeholder) with two views: Graph and List
- **Graph view:** Force-directed node graph showing memory entries as nodes, with edges for relationships (shared topics, references, temporal proximity)
- **List view:** Searchable, filterable table of all memory entries
- Memory sources: CLAUDE.md files, project memory files, agent-specific memory stores
- Each memory node shows: title, type, source agent, created/updated date, content preview
- Click-to-inspect: full content in right sidebar Inspector panel
- Memory operations: mark as stale, archive, delete (with confirmation)
- Filterable by: agent, memory type, date range, topic/tag
- Keyboard-navigable: arrow keys in list view, `Tab` to switch views, `/` to search

---

## Non-Goals

- Writing or editing memory content (read + manage only; agents write their own memory)
- Embedding-based semantic similarity (v1 uses keyword/reference-based edges)
- Memory diffing or version history
- Cross-machine memory aggregation
- Memory performance benchmarking (recall accuracy, etc.)
- Memory sharing or transfer between agents

---

## Data Sources

| Source | Location / Origin | Content |
|---|---|---|
| CLAUDE.md files | Project root + `~/.claude/CLAUDE.md` | Project instructions, conventions, known issues |
| Project memory | `~/.claude/projects/*/memory/` | User preferences, feedback, project context, references |
| Agent context files | Agent-specific config/context directories | Agent personality, capabilities, constraints |
| Memory metadata | Frontmatter in memory `.md` files | Name, description, type (user/feedback/project/reference) |

---

## Schema / Storage Implications

### New table: `memory_entries` (v7 migration)

Indexes the discovered memory files for fast querying and graph construction:

```sql
CREATE TABLE memory_entries (
  id          TEXT PRIMARY KEY,              -- nanoid
  source_path TEXT NOT NULL UNIQUE,          -- Absolute path to memory file
  agent       TEXT NOT NULL DEFAULT 'system',-- Which agent owns this memory
  name        TEXT NOT NULL,                 -- From frontmatter 'name' field
  description TEXT NOT NULL DEFAULT '',      -- From frontmatter 'description' field
  mem_type    TEXT NOT NULL DEFAULT 'project'-- From frontmatter 'type' field
              CHECK(mem_type IN ('user','feedback','project','reference')),
  content     TEXT NOT NULL,                 -- Full markdown content (sans frontmatter)
  topics      TEXT NOT NULL DEFAULT '[]',    -- JSON array of extracted topic strings
  file_hash   TEXT NOT NULL,                 -- SHA-256 of file content for change detection
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory_entries(agent);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(mem_type);
CREATE INDEX IF NOT EXISTS idx_memory_updated ON memory_entries(updated_at DESC);
```

### New table: `memory_edges` (v7 migration)

Stores computed relationships between memory entries:

```sql
CREATE TABLE memory_edges (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES memory_entries(id),
  target_id   TEXT NOT NULL REFERENCES memory_entries(id),
  edge_type   TEXT NOT NULL                  -- 'shared_topic' | 'reference' | 'same_agent' | 'temporal'
              CHECK(edge_type IN ('shared_topic','reference','same_agent','temporal')),
  weight      REAL NOT NULL DEFAULT 1.0,     -- Edge strength (0-1)
  label       TEXT NOT NULL DEFAULT '',      -- e.g. the shared topic name
  UNIQUE(source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON memory_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON memory_edges(target_id);
```

### Scanning and indexing

`src/server/memoryScanner.ts` handles:
- Scanning known memory directories for `.md` files with frontmatter
- Parsing frontmatter metadata (name, description, type)
- Extracting topics from content (WikiLinks, headings, keywords)
- Hashing content for change detection (skip unchanged files)
- Computing edges between entries (shared topics, cross-references)
- Runs on page load (lazy) or via API trigger; not background polling

---

## API / Routes

### `GET /api/memory`

Query params:
- `agent` — filter by agent
- `type` — filter by memory type
- `search` — full-text search in name + content
- `format` — `list` (default) | `graph`

List response:
```json
{
  "entries": [
    {
      "id": "mem-abc",
      "agent": "system",
      "name": "User role",
      "description": "User is a senior engineer focused on agent orchestration",
      "mem_type": "user",
      "topics": ["agents", "orchestration"],
      "source_path": "/Users/.../.claude/projects/.../memory/user_role.md",
      "updated_at": "2026-03-28T10:00:00Z"
    }
  ],
  "total": 24
}
```

Graph response:
```json
{
  "nodes": [
    { "id": "mem-abc", "name": "User role", "agent": "system", "mem_type": "user", "topics": ["agents"] }
  ],
  "edges": [
    { "source": "mem-abc", "target": "mem-def", "edge_type": "shared_topic", "label": "agents", "weight": 0.8 }
  ]
}
```

### `POST /api/memory/scan`

Trigger a re-scan of memory directories. Returns scan results (new/updated/unchanged counts).

### `GET /api/memory/:id`

Get full content of a single memory entry.

### `DELETE /api/memory/:id`

Delete a memory entry (removes the underlying file after confirmation).

### `PATCH /api/memory/:id`

Update metadata (e.g., mark as stale). Does not edit content.

---

## UI Sections / Components

### Page: `app/memory/page.tsx` (enhance existing)

Replace existing placeholder with full Memory Graph implementation.

### `src/components/MemoryClient.tsx`

Client wrapper. Owns view state, filters, and scan trigger.

Layout — Graph View:
```
┌──────────────────────────────────────────────────────┐
│ Memory Graph          [Graph | List]  [Scan] [Filter] │
├──────────────────────────────────────────────────────┤
│                                                       │
│        ┌──────┐                                       │
│       ╱ user  ╲───── shared_topic ────┐               │
│      │ role    │                ┌─────┴────┐          │
│       ╲       ╱                │ feedback  │          │
│        └──┬───┘                │ testing   │          │
│           │ same_agent         └──────────┘          │
│        ┌──┴───┐                                       │
│       │project │                                      │
│       │ auth   │───── reference ─── ┌────────┐       │
│       └───────┘                     │ ref:   │       │
│                                     │ Linear │       │
│                                     └────────┘       │
│                                                       │
│ Selected: "User role"  [View Full →]  [Delete]       │
└──────────────────────────────────────────────────────┘
```

Layout — List View:
```
┌──────────────────────────────────────────────────────┐
│ Memory Graph          [Graph | List]  [Scan] [Filter] │
├──────────────────────────────────────────────────────┤
│ [Search memories...]                                  │
├──────────────────────────────────────────────────────┤
│ Name            Type      Agent    Topics    Updated  │
│ User role       user      system   agents    2h ago   │
│ Testing pref    feedback  system   testing   1d ago   │
│ Auth project    project   system   auth      3d ago   │
│ Linear ref      reference system   linear    5d ago   │
│ ...                                                   │
└──────────────────────────────────────────────────────┘
```

### Sub-components

| Component | Location | Purpose |
|---|---|---|
| `MemoryGraph` | `src/components/memory/MemoryGraph.tsx` | Force-directed graph using Canvas or SVG; nodes are memories, edges are relationships |
| `MemoryList` | `src/components/memory/MemoryList.tsx` | Searchable, sortable table of memory entries |
| `MemoryNode` | `src/components/memory/MemoryNode.tsx` | Graph node rendering — color by type, size by connection count |
| `MemoryEdge` | `src/components/memory/MemoryEdge.tsx` | Graph edge rendering — line style by edge type, opacity by weight |
| `MemoryDetail` | `src/components/memory/MemoryDetail.tsx` | Full content view in sidebar or modal — markdown rendered |
| `MemoryFilterBar` | `src/components/memory/MemoryFilterBar.tsx` | Agent filter, type filter, date range, search |
| `MemoryScanButton` | `src/components/memory/MemoryScanButton.tsx` | Trigger re-scan with progress indicator |
| `MemoryWidget` | `src/components/MemoryWidget.tsx` | Dashboard widget: total memories, types breakdown, last scan time |

### ViewModel: `src/viewmodels/useMemoryViewModel.ts`

- Fetches graph or list data based on active view
- Holds `entries[]`, `edges[]`, `selectedEntry`, `view`, `filters`
- Exposes `selectEntry(id)`, `setView(graph|list)`, `setFilter(...)`, `triggerScan()`, `deleteEntry(id)`
- Graph layout computed client-side (force simulation)

---

## Phased Milestones

### Phase 1 — Memory scanner + schema
- [ ] Add `memory_entries` and `memory_edges` tables via v7 migration in `src/server/db.ts`
- [ ] Add `src/server/memoryScanner.ts` — scan directories, parse frontmatter, extract topics
- [ ] Content hashing for change detection (skip unchanged files on re-scan)
- [ ] Edge computation: shared topics, cross-references, same-agent grouping

### Phase 2 — Memory API
- [ ] `GET /api/memory` with agent/type/search filters and graph/list formats
- [ ] `GET /api/memory/:id` for full entry content
- [ ] `POST /api/memory/scan` to trigger re-scan
- [ ] `DELETE /api/memory/:id` with file removal
- [ ] TypeScript types in `src/types/memory.ts`

### Phase 3 — List view
- [ ] Replace existing `/memory` placeholder with `MemoryClient`
- [ ] `MemoryList` with search, sort, and filter
- [ ] `MemoryDetail` in right sidebar Inspector panel
- [ ] `MemoryFilterBar` with agent, type, and date filters
- [ ] `useMemoryViewModel.ts`

### Phase 4 — Graph view
- [ ] `MemoryGraph` with force-directed layout (Canvas-based for performance)
- [ ] `MemoryNode` rendering — color-coded by type, sized by connections
- [ ] `MemoryEdge` rendering — styled by edge type
- [ ] Click node to select; double-click to open detail
- [ ] Zoom/pan controls; fit-to-screen button
- [ ] View toggle: Graph / List with `Tab` keyboard shortcut

### Phase 5 — Dashboard widget + polish
- [ ] `MemoryWidget` on dashboard (total count, type breakdown, staleness indicator)
- [ ] `MemoryScanButton` with progress and scan results summary
- [ ] Add "Go to Memory" command to CommandPalette (may already exist)
- [ ] Keyboard: `/` to search, arrow keys in list, `Tab` to switch views
- [ ] Wire memory changes to timeline via `recordEvent()`

---

## Edge Cases

| Case | Handling |
|---|---|
| No memory files found | Empty state: "No agent memories discovered. Memories appear as agents accumulate context." |
| Memory file has no frontmatter | Skip file during scan; log warning; don't crash |
| Memory file deleted externally | Remove from `memory_entries` on next scan; show "Removed" in list if currently displayed |
| Very large memory file (>100KB) | Store full content in DB but truncate preview to 500 chars; full content in detail view |
| Hundreds of memory entries | Graph view caps at 100 nodes (filter to show most connected); list view paginates |
| Circular references between memories | Graph handles cycles naturally (force layout); edges are undirected for display |
| Memory directories don't exist | Graceful skip; show which directories were scanned in scan results |
| File permissions prevent reading | Skip unreadable files; report count of skipped files in scan results |
| Concurrent scan requests | Ignore subsequent scan if one is in progress; return "Scan already running" |
| Content changes between scans | Hash comparison detects changes; update DB entry; mark edges for recomputation |
| Graph layout is too dense | Zoom/pan controls; filter to specific agent or type to reduce density |

---

## Acceptance Criteria

- [ ] Memory scanner discovers `.md` files with frontmatter from configured directories
- [ ] Scan correctly parses name, description, type from frontmatter metadata
- [ ] Topics are extracted from content (WikiLinks, headings)
- [ ] Edges are computed between entries sharing topics or references
- [ ] List view displays all entries with search, sort, and filter
- [ ] Graph view renders force-directed graph with nodes and edges
- [ ] Clicking a node/row opens full content in detail view
- [ ] Re-scan detects new, changed, and removed files correctly
- [ ] Delete operation removes both DB entry and underlying file (with confirmation)
- [ ] Graph view handles 100+ nodes without performance issues
- [ ] Filter by agent, type, and search works in both views
- [ ] Dashboard widget shows memory count and type breakdown
- [ ] Empty state renders for installations with no memory files
- [ ] TypeScript strict mode: no `any` in new files
- [ ] `npm run build` passes with no errors after implementation
