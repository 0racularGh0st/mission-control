import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DashboardIncrementalPatchDto,
  DashboardSnapshotDto,
  RuntimeLogEntryDto,
} from "./types";

interface PersistedCursorState {
  lastCursor?: string;
  lastGeneratedAtIso?: string;
}

export interface DashboardLocalTransport {
  readSnapshot(): Promise<DashboardSnapshotDto>;
  issueCursor(snapshot: DashboardSnapshotDto): Promise<string>;
  readUpdates(cursor?: string): Promise<DashboardIncrementalPatchDto[]>;
}

const RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const CURSOR_FILE = path.join(RUNTIME_DIR, "dashboard-cursors.json");

function createCursor(date = new Date()) {
  return `ts_${date.toISOString()}`;
}

async function ensureRuntimeDir() {
  await mkdir(RUNTIME_DIR, { recursive: true });
}

async function readCursorState(): Promise<PersistedCursorState> {
  try {
    const raw = await readFile(CURSOR_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedCursorState;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCursorState(state: PersistedCursorState) {
  await ensureRuntimeDir();
  const tempPath = `${CURSOR_FILE}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempPath, CURSOR_FILE);
}

function attachTime(snapshot: DashboardSnapshotDto, source: DashboardSnapshotDto["source"]): DashboardSnapshotDto {
  const generatedAtIso = new Date().toISOString();
  const recentLogs = snapshot.recentLogs.map((entry, index): RuntimeLogEntryDto => ({
    ...entry,
    id: `${entry.id}-${index}`,
    createdAtIso: generatedAtIso,
  }));

  return {
    ...snapshot,
    source,
    generatedAtIso,
    recentLogs,
  };
}

export class FileBackedLocalDashboardTransport implements DashboardLocalTransport {
  constructor(private readonly seedSnapshot: DashboardSnapshotDto) {}

  async readSnapshot(): Promise<DashboardSnapshotDto> {
    return attachTime(this.seedSnapshot, "local-api");
  }

  async issueCursor(snapshot: DashboardSnapshotDto): Promise<string> {
    const cursor = createCursor(new Date(snapshot.generatedAtIso));
    await writeCursorState({
      lastCursor: cursor,
      lastGeneratedAtIso: snapshot.generatedAtIso,
    });
    return cursor;
  }

  async readUpdates(cursor?: string): Promise<DashboardIncrementalPatchDto[]> {
    if (!cursor) {
      return [];
    }

    const persisted = await readCursorState();
    if (!persisted.lastCursor || persisted.lastCursor === cursor) {
      return [];
    }

    return [
      {
        cursor: persisted.lastCursor,
        logs: [
          {
            id: `log-update-${persisted.lastGeneratedAtIso ?? Date.now()}`,
            message:
              "Incremental update placeholder from local transport. Hook runtime event feed here to emit real patches.",
            createdAtIso: persisted.lastGeneratedAtIso ?? new Date().toISOString(),
          },
        ],
      },
    ];
  }
}
