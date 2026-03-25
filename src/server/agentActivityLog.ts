import { readFileSync, appendFileSync, existsSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

const LOG_DIR = join(process.cwd(), ".runtime");
const LOG_FILE = join(LOG_DIR, "agent-activity.log");
const MAX_LOG_BYTES = 1024 * 1024; // 1MB

// In-memory ring buffer (keeps last 200 entries in memory for fast reads)
const RING_BUFFER_SIZE = 200;
let ringBuffer: AgentActivityEntry[] = [];
let initialized = false;

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    writeFileSync(LOG_DIR, "", { flag: "w" }); // touch
  }
}

function rotateLogIfNeeded() {
  try {
    const stat = statSync(LOG_FILE);
    if (stat.size > MAX_LOG_BYTES) {
      // Archive: rename current to .1
      const archiveFile = `${LOG_FILE}.1`;
      if (existsSync(archiveFile)) {
        // Simple rotation: just overwrite .1 (no multi-archive)
      }
      const content = readFileSync(LOG_FILE, "utf-8");
      writeFileSync(archiveFile, content, "utf-8");
      writeFileSync(LOG_FILE, "", "utf-8");
    }
  } catch {
    // File doesn't exist yet — nothing to rotate
  }
}

function loadLogIntoRing() {
  if (!existsSync(LOG_FILE)) return;
  try {
    const content = readFileSync(LOG_FILE, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    // Load last RING_BUFFER_SIZE entries
    const entries = lines.slice(-RING_BUFFER_SIZE);
    ringBuffer = entries.map((line) => JSON.parse(line) as AgentActivityEntry);
  } catch {
    ringBuffer = [];
  }
}

function init() {
  if (initialized) return;
  ensureLogDir();
  loadLogIntoRing();
  initialized = true;
}

/**
 * Log a new agent activity entry. Appends to NDJSON file and updates ring buffer.
 */
export function logActivity(entry: AgentActivityEntry): void {
  init();
  rotateLogIfNeeded();
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(LOG_FILE, line, "utf-8");

  // Update ring buffer (append, cap at RING_BUFFER_SIZE)
  ringBuffer.push(entry);
  if (ringBuffer.length > RING_BUFFER_SIZE) {
    ringBuffer = ringBuffer.slice(-RING_BUFFER_SIZE);
  }
}

/**
 * Get recent activities from in-memory ring buffer.
 * Returns entries in reverse chronological order (most recent first).
 */
export function getRecentActivities(limit = 50): AgentActivityEntry[] {
  init();
  return [...ringBuffer]
    .reverse()
    .slice(0, limit);
}

/**
 * Read last N entries directly from the NDJSON log file.
 * Used by API route to avoid needing the in-memory ring.
 */
export function readActivitiesFromFile(limit = 50): AgentActivityEntry[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const content = readFileSync(LOG_FILE, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line) as AgentActivityEntry);
  } catch {
    return [];
  }
}
