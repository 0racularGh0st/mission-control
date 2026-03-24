import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DashboardIncrementalPatchDto,
  DashboardSnapshotDto,
  RuntimeAlertDto,
  RuntimeLogEntryDto,
  TaskQueueLaneDto,
} from "./types";

interface PersistedCursorState {
  lastCursor?: string;
  lastGeneratedAtIso?: string;
}

type JournalEventType = "log.append" | "alert.upsert" | "queue.lane";

interface DashboardJournalEvent {
  cursor: string;
  emittedAtIso: string;
  type: JournalEventType;
  log?: RuntimeLogEntryDto;
  alert?: RuntimeAlertDto;
  queueLane?: TaskQueueLaneDto;
}

export interface DashboardLocalTransport {
  readSnapshot(): Promise<DashboardSnapshotDto>;
  issueCursor(snapshot: DashboardSnapshotDto): Promise<string>;
  readUpdates(cursor?: string): Promise<DashboardIncrementalPatchDto[]>;
}

const RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const CURSOR_FILE = path.join(RUNTIME_DIR, "dashboard-cursors.json");
const JOURNAL_FILE = path.join(RUNTIME_DIR, "dashboard-events.ndjson");
const MAX_UPDATES_PER_READ = 50;

function createCursor(date = new Date()) {
  return `ts_${date.toISOString()}_${Math.random().toString(36).slice(2, 8)}`;
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

async function appendJournalEvent(event: DashboardJournalEvent) {
  await ensureRuntimeDir();
  await appendFile(JOURNAL_FILE, `${JSON.stringify(event)}\n`, "utf8");
}

async function readJournalEvents(): Promise<DashboardJournalEvent[]> {
  try {
    const raw = await readFile(JOURNAL_FILE, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as DashboardJournalEvent;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is DashboardJournalEvent => Boolean(entry));
  } catch {
    return [];
  }
}

function maybeGenerateSyntheticEvent(snapshot: DashboardSnapshotDto, cursor: string): DashboardJournalEvent | null {
  const now = new Date();
  const minute = now.getUTCMinutes();
  const emittedAtIso = now.toISOString();

  if (minute % 3 === 0) {
    return {
      cursor,
      emittedAtIso,
      type: "log.append",
      log: {
        id: `log-update-${Date.now()}`,
        message: `${now.toISOString().slice(11, 19)} Runtime pulse: local transport produced incremental log event.`,
        createdAtIso: emittedAtIso,
      },
    };
  }

  if (minute % 5 === 0) {
    const lane = snapshot.queueSnapshot[0];
    return {
      cursor,
      emittedAtIso,
      type: "queue.lane",
      queueLane: {
        ...lane,
        count: Math.max(0, lane.count + (now.getUTCSeconds() % 2 === 0 ? 1 : -1)),
      },
    };
  }

  if (minute % 7 === 0 && snapshot.alerts.length > 0) {
    const alert = snapshot.alerts[0];
    return {
      cursor,
      emittedAtIso,
      type: "alert.upsert",
      alert: {
        ...alert,
        detail: `${alert.detail} · refreshed ${emittedAtIso.slice(11, 19)}Z`,
      },
    };
  }

  return null;
}

function mapEventToPatch(event: DashboardJournalEvent): DashboardIncrementalPatchDto {
  if (event.type === "log.append" && event.log) {
    return {
      cursor: event.cursor,
      type: "log.append",
      emittedAtIso: event.emittedAtIso,
      logs: [event.log],
    };
  }

  if (event.type === "alert.upsert" && event.alert) {
    return {
      cursor: event.cursor,
      type: "alert.upsert",
      emittedAtIso: event.emittedAtIso,
      alert: event.alert,
    };
  }

  if (event.type === "queue.lane" && event.queueLane) {
    return {
      cursor: event.cursor,
      type: "queue.lane",
      emittedAtIso: event.emittedAtIso,
      queueLane: event.queueLane,
    };
  }

  return {
    cursor: event.cursor,
    type: "log.append",
    emittedAtIso: event.emittedAtIso,
    logs: [],
  };
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

    const syntheticEvent = maybeGenerateSyntheticEvent(snapshot, cursor);
    if (syntheticEvent) {
      await appendJournalEvent(syntheticEvent);
    }

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

    const events = await readJournalEvents();
    const cursorIndex = events.findIndex((event) => event.cursor === cursor);
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : Math.max(0, events.length - MAX_UPDATES_PER_READ);
    const nextEvents = events.slice(startIndex).slice(0, MAX_UPDATES_PER_READ);

    if (nextEvents.length === 0) {
      return [];
    }

    return nextEvents.map(mapEventToPatch);
  }
}
