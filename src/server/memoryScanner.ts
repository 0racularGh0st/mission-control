/**
 * Memory scanner — discovers, indexes, and links agent memory files.
 * Scans configured directories for .md files with frontmatter,
 * extracts topics, computes edges, and persists to SQLite.
 */

import { getDb } from "@/src/server/db";
import { randomBytes, createHash } from "crypto";
import { readFileSync, readdirSync, existsSync, statSync, unlinkSync } from "fs";
import { join, basename, relative } from "path";
import type {
  MemoryType,
  MemoryEdgeType,
  MemoryEntry,
  MemoryEdge,
  MemoryGraphResponse,
  MemoryListResponse,
  MemoryScanResult,
  MemoryStats,
} from "@/src/types/memory";
import { MEMORY_TYPES } from "@/src/types/memory";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MEMORY_DIRS: { dir: string; agent: string }[] = [
  { dir: join(process.env.HOME ?? "/Users/nigel", ".claude", "projects"), agent: "system" },
];

const TEMPORAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface MemoryRow {
  id: string;
  source_path: string;
  agent: string;
  name: string;
  description: string;
  mem_type: string;
  content: string;
  topics: string;
  file_hash: string;
  discovered_at: string;
  updated_at: string;
}

interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: string;
  weight: number;
  label: string;
}

// ---------------------------------------------------------------------------
// Row converters
// ---------------------------------------------------------------------------

function rowToEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    sourcePath: row.source_path,
    agent: row.agent,
    name: row.name,
    description: row.description,
    memType: row.mem_type as MemoryType,
    content: row.content,
    topics: JSON.parse(row.topics) as string[],
    fileHash: row.file_hash,
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at,
  };
}

function rowToEdge(row: EdgeRow): MemoryEdge {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    edgeType: row.edge_type as MemoryEdgeType,
    weight: row.weight,
    label: row.label,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nanoid(): string {
  return randomBytes(12).toString("base64url");
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; content: string } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { frontmatter: fm, content: match[2] };
}

function extractTopics(content: string): string[] {
  const topics = new Set<string>();

  // WikiLinks: [[Topic Name]]
  const wikiLinkRe = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiLinkRe.exec(content)) !== null) {
    topics.add(m[1].trim());
  }

  // Headings: ## Topic
  const headingRe = /^##\s+(.+)$/gm;
  while ((m = headingRe.exec(content)) !== null) {
    topics.add(m[1].trim());
  }

  return Array.from(topics);
}

/**
 * Recursively find all `memory/` subdirectories within a root directory,
 * then collect all `.md` files from those subdirs.
 */
function findMemoryFiles(rootDir: string): string[] {
  const results: string[] = [];
  if (!existsSync(rootDir)) return results;

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (entry === "memory") {
          // Collect all .md files inside this memory dir
          collectMdFiles(full, results);
        } else {
          walk(full);
        }
      }
    }
  }

  function collectMdFiles(dir: string, out: string[]): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isFile() && entry.endsWith(".md")) {
        out.push(full);
      } else if (stat.isDirectory()) {
        collectMdFiles(full, out);
      }
    }
  }

  walk(rootDir);
  return results;
}

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export interface GetMemoryOptions {
  agent?: string;
  memType?: MemoryType;
  search?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Edge computation
// ---------------------------------------------------------------------------

function computeEdges(entries: MemoryEntry[]): { sourceId: string; targetId: string; edgeType: MemoryEdgeType; weight: number; label: string }[] {
  const edges: { sourceId: string; targetId: string; edgeType: MemoryEdgeType; weight: number; label: string }[] = [];
  const seen = new Set<string>();

  function addEdge(a: string, b: string, edgeType: MemoryEdgeType, weight: number, label: string) {
    // Ensure consistent ordering to avoid duplicates
    const [src, tgt] = a < b ? [a, b] : [b, a];
    const key = `${src}|${tgt}|${edgeType}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ sourceId: src, targetId: tgt, edgeType, weight, label });
  }

  // Build topic -> entry index
  const topicIndex = new Map<string, string[]>();
  for (const entry of entries) {
    for (const topic of entry.topics) {
      const lower = topic.toLowerCase();
      if (!topicIndex.has(lower)) topicIndex.set(lower, []);
      topicIndex.get(lower)!.push(entry.id);
    }
  }

  // shared_topic edges
  for (const [topic, ids] of topicIndex) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i], ids[j], "shared_topic", 1.0, topic);
      }
    }
  }

  // reference edges — one entry's content mentions another entry's name
  for (const a of entries) {
    for (const b of entries) {
      if (a.id === b.id) continue;
      if (a.content.includes(b.name) || a.content.includes(`[[${b.name}]]`)) {
        addEdge(a.id, b.id, "reference", 1.0, `references ${b.name}`);
      }
    }
  }

  // same_agent edges
  const agentIndex = new Map<string, string[]>();
  for (const entry of entries) {
    if (!agentIndex.has(entry.agent)) agentIndex.set(entry.agent, []);
    agentIndex.get(entry.agent)!.push(entry.id);
  }
  for (const [agent, ids] of agentIndex) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i], ids[j], "same_agent", 0.5, agent);
      }
    }
  }

  // temporal edges — entries discovered within 7 days of each other
  const sorted = [...entries].sort((a, b) => new Date(a.discoveredAt).getTime() - new Date(b.discoveredAt).getTime());
  for (let i = 0; i < sorted.length; i++) {
    const tA = new Date(sorted[i].discoveredAt).getTime();
    for (let j = i + 1; j < sorted.length; j++) {
      const tB = new Date(sorted[j].discoveredAt).getTime();
      if (tB - tA > TEMPORAL_WINDOW_MS) break;
      addEdge(sorted[i].id, sorted[j].id, "temporal", 0.3, "temporal proximity");
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scanMemories(): MemoryScanResult {
  const db = getDb();
  const result: MemoryScanResult = { added: 0, updated: 0, removed: 0, unchanged: 0, skipped: 0, scannedDirs: [] };

  const allFiles: { path: string; agent: string }[] = [];

  for (const { dir, agent } of MEMORY_DIRS) {
    if (!existsSync(dir)) continue;
    result.scannedDirs.push(dir);
    const files = findMemoryFiles(dir);
    for (const f of files) {
      allFiles.push({ path: f, agent });
    }
  }

  const upsert = db.prepare(`
    INSERT INTO memory_entries (id, source_path, agent, name, description, mem_type, content, topics, file_hash, discovered_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(source_path) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      mem_type = excluded.mem_type,
      content = excluded.content,
      topics = excluded.topics,
      file_hash = excluded.file_hash,
      updated_at = datetime('now')
  `);

  const getByPath = db.prepare("SELECT id, file_hash FROM memory_entries WHERE source_path = ?");

  const processedPaths = new Set<string>();

  for (const { path, agent } of allFiles) {
    processedPaths.add(path);

    let raw: string;
    try {
      raw = readFileSync(path, "utf-8");
    } catch {
      result.skipped++;
      continue;
    }

    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      result.skipped++;
      continue;
    }

    const { frontmatter, content } = parsed;
    const name = frontmatter["name"] || basename(path, ".md");
    const description = frontmatter["description"] || "";
    const fmType = frontmatter["type"] || "project";
    const memType: MemoryType = (MEMORY_TYPES as readonly string[]).includes(fmType) ? (fmType as MemoryType) : "project";

    const hash = sha256(raw);
    const topics = extractTopics(content);

    const existing = getByPath.get(path) as { id: string; file_hash: string } | undefined;
    if (existing && existing.file_hash === hash) {
      result.unchanged++;
      continue;
    }

    const id = existing?.id ?? nanoid();
    upsert.run(id, path, agent, name, description, memType, content, JSON.stringify(topics), hash);

    if (existing) {
      result.updated++;
    } else {
      result.added++;
    }
  }

  // Remove entries for files that no longer exist
  const allRows = db.prepare("SELECT id, source_path FROM memory_entries").all() as { id: string; source_path: string }[];
  const deleteStmt = db.prepare("DELETE FROM memory_entries WHERE id = ?");
  for (const row of allRows) {
    if (!processedPaths.has(row.source_path) && !existsSync(row.source_path)) {
      deleteStmt.run(row.id);
      result.removed++;
    }
  }

  // Recompute all edges
  db.prepare("DELETE FROM memory_edges").run();
  const entries = (db.prepare("SELECT * FROM memory_entries").all() as MemoryRow[]).map(rowToEntry);
  const edges = computeEdges(entries);

  const insertEdge = db.prepare(
    "INSERT OR IGNORE INTO memory_edges (id, source_id, target_id, edge_type, weight, label) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const edge of edges) {
    insertEdge.run(nanoid(), edge.sourceId, edge.targetId, edge.edgeType, edge.weight, edge.label);
  }

  return result;
}

export function getMemoryEntries(options: GetMemoryOptions = {}): MemoryListResponse {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.agent) {
    conditions.push("agent = ?");
    params.push(options.agent);
  }
  if (options.memType) {
    conditions.push("mem_type = ?");
    params.push(options.memType);
  }
  if (options.search) {
    conditions.push("(name LIKE ? OR description LIKE ? OR content LIKE ?)");
    const term = `%${options.search}%`;
    params.push(term, term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options.limit ?? 100;

  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM memory_entries ${where}`).get(...params) as { cnt: number };
  const rows = db.prepare(`SELECT * FROM memory_entries ${where} ORDER BY updated_at DESC LIMIT ?`).all(...params, limit) as MemoryRow[];

  return {
    entries: rows.map(rowToEntry),
    total: countRow.cnt,
  };
}

export function getMemoryEntry(id: string): MemoryEntry | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM memory_entries WHERE id = ?").get(id) as MemoryRow | undefined;
  return row ? rowToEntry(row) : null;
}

export function getMemoryGraph(options?: GetMemoryOptions): MemoryGraphResponse {
  const db = getDb();

  const { entries } = getMemoryEntries({ ...options, limit: 500 });
  const ids = new Set(entries.map((e) => e.id));

  // Get edges where both source and target are in our set
  const allEdges = (db.prepare("SELECT * FROM memory_edges").all() as EdgeRow[]).map(rowToEdge);
  const filteredEdges = allEdges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));

  return { nodes: entries, edges: filteredEdges };
}

export function deleteMemoryEntry(id: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT source_path FROM memory_entries WHERE id = ?").get(id) as { source_path: string } | undefined;
  if (!row) return false;

  // Delete the file from disk if it exists
  if (existsSync(row.source_path)) {
    try {
      unlinkSync(row.source_path);
    } catch {
      // file deletion failed — still remove from DB
    }
  }

  // Cascade will handle edges
  db.prepare("DELETE FROM memory_entries WHERE id = ?").run(id);
  return true;
}

export function getMemoryStats(): MemoryStats {
  const db = getDb();

  const totalRow = db.prepare("SELECT COUNT(*) as cnt FROM memory_entries").get() as { cnt: number };
  const edgeRow = db.prepare("SELECT COUNT(*) as cnt FROM memory_edges").get() as { cnt: number };

  const byType: Record<MemoryType, number> = { user: 0, feedback: 0, project: 0, reference: 0 };
  const typeRows = db.prepare("SELECT mem_type, COUNT(*) as cnt FROM memory_entries GROUP BY mem_type").all() as { mem_type: string; cnt: number }[];
  for (const r of typeRows) {
    if (r.mem_type in byType) {
      byType[r.mem_type as MemoryType] = r.cnt;
    }
  }

  const byAgent: Record<string, number> = {};
  const agentRows = db.prepare("SELECT agent, COUNT(*) as cnt FROM memory_entries GROUP BY agent").all() as { agent: string; cnt: number }[];
  for (const r of agentRows) {
    byAgent[r.agent] = r.cnt;
  }

  const lastRow = db.prepare("SELECT MAX(updated_at) as last FROM memory_entries").get() as { last: string | null };

  return {
    total: totalRow.cnt,
    byType,
    byAgent,
    edgeCount: edgeRow.cnt,
    lastScanAt: lastRow.last,
  };
}
