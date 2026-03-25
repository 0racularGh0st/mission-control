import fs from "fs/promises";
import path from "path";
import os from "os";

export interface AutomationEntry {
  label: string;
  program: string;
  args: string[];
  schedule: string; // "daily HH:MM", "hourly", "every Xs", etc.
  nextRun: string | null;
  lastRun: string | null;
  runAtLoad: boolean;
  status: "active" | "inactive";
}

const LAUNCH_AGENTS_DIR = path.join(os.homedir(), "Library", "LaunchAgents");

function parseBool(value: string | undefined | null): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function parseInteger(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function extractTag(body: string, tag: string): string | null {
  const regex = new RegExp(`<key>${tag}<\\/key>\\s*<([^>]+)>([^<]*)</\\1>`, "i");
  const match = body.match(regex);
  if (!match) return null;
  // For <true/> or <false/> the value is empty
  return match[2] || (match[1].includes("true") ? "true" : "false");
}

function extractString(body: string, tag: string): string | null {
  const regex = new RegExp(`<key>${tag}<\\/key>\\s*<string>([^<]*)</string>`, "i");
  const match = body.match(regex);
  return match ? match[1] : null;
}

function extractInteger(body: string, tag: string): number | null {
  const regex = new RegExp(`<key>${tag}<\\/key>\\s*<integer>([^<]*)</integer>`, "i");
  const match = body.match(regex);
  if (!match) return null;
  return parseInteger(match[1]);
}

function extractArray(body: string, tag: string): string[] {
  const regex = new RegExp(
    `<key>${tag}<\\/key>\\s*<array>([\\s\\S]*?)<\\/array>`,
    "i",
  );
  const match = body.match(regex);
  if (!match) return [];
  const arrayContent = match[1];
  const strings = arrayContent.match(/<string>([^<]*)<\/string>/g) ?? [];
  return strings.map((s) => s.replace(/<\/?string>/g, ""));
}

function extractNestedDict(body: string, tag: string): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  const regex = new RegExp(
    `<key>${tag}<\\/key>\\s*<dict>([\\s\\S]*?)<\\/dict>`,
    "i",
  );
  const match = body.match(regex);
  if (!match) return result;
  const dictContent = match[1];
  const keyPairs = dictContent.match(/<key>([^<]*)<\/key>[\s\S]*?(?:<string>([^<]*)<\/string>|<integer>([^<]*)<\/integer>|<true\/>|<false\/>)/g) ?? [];
  for (const pair of keyPairs) {
    const keyMatch = pair.match(/<key>([^<]*)<\/key>/);
    if (!keyMatch) continue;
    const key = keyMatch[1];
    const strMatch = pair.match(/<string>([^<]*)<\/string>/);
    const intMatch = pair.match(/<integer>([^<]*)<\/integer>/);
    const trueMatch = pair.match(/<true\/>/);
    const falseMatch = pair.match(/<false\/>/);
    if (strMatch) result[key] = strMatch[1];
    else if (intMatch) result[key] = parseInteger(intMatch[1]);
    else if (trueMatch) result[key] = "true";
    else if (falseMatch) result[key] = "false";
  }
  return result;
}

function computeSchedule(
  startInterval: number | null,
  startCalendar: Record<string, string | number | null>,
): string {
  if (startInterval !== null) {
    if (startInterval === 3600) return "hourly";
    if (startInterval === 7200) return "every 2h";
    return `every ${startInterval}s`;
  }
  if (Object.keys(startCalendar).length > 0) {
    const hour = startCalendar["Hour"] as number | null;
    const minute = startCalendar["Minute"] as number | null;
    if (hour !== null && minute !== null) {
      return `daily at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
    if (hour !== null) return `daily at ${hour}:00`;
    if (minute !== null) return `daily at 00:${String(minute).padStart(2, "0")}`;
    return "scheduled";
  }
  return "on-demand";
}

function computeNextRun(
  startInterval: number | null,
  startCalendar: Record<string, string | number | null>,
): string | null {
  const now = new Date();
  if (startInterval !== null) {
    // Can't know exact last run; show "soon" if RunAtLoad
    return "interval-based";
  }
  if (Object.keys(startCalendar).length > 0) {
    const hour = startCalendar["Hour"] as number | null;
    const minute = startCalendar["Minute"] as number | null;
    if (hour !== null && minute !== null) {
      const next = new Date();
      next.setHours(hour, minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
  }
  return null;
}

function estimateLastRun(
  startInterval: number | null,
  startCalendar: Record<string, string | number | null>,
  runAtLoad: boolean,
): string | null {
  if (!runAtLoad) return null;
  const now = new Date();
  if (startInterval !== null) {
    // Approximate: assume it ran recently if RunAtLoad and interval is short
    const approx = new Date(now.getTime() - startInterval * 500); // midway through interval
    return approx.toISOString();
  }
  if (Object.keys(startCalendar).length > 0) {
    const hour = startCalendar["Hour"] as number | null;
    const minute = startCalendar["Minute"] as number | null;
    if (hour !== null && minute !== null) {
      const last = new Date();
      last.setHours(hour, minute, 0, 0);
      if (last > now) last.setDate(last.getDate() - 1);
      return last.toISOString();
    }
  }
  return null;
}

async function readAutomationFromFile(filePath: string): Promise<AutomationEntry | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");

    const label = extractString(content, "Label");
    if (!label || !label.startsWith("ai.")) return null;

    const programArgs = extractArray(content, "ProgramArguments");
    const startInterval = extractInteger(content, "StartInterval");
    const startCalendar = extractNestedDict(content, "StartCalendarInterval");
    const runAtLoadStr = extractTag(content, "RunAtLoad");
    const runAtLoad = parseBool(runAtLoadStr);

    const program = programArgs[0] ?? "";
    const args = programArgs.slice(1);

    const schedule = computeSchedule(startInterval, startCalendar);
    const nextRun = computeNextRun(startInterval, startCalendar);
    const lastRun = estimateLastRun(startInterval, startCalendar, runAtLoad);

    return {
      label,
      program,
      args,
      schedule,
      nextRun,
      lastRun,
      runAtLoad,
      status: runAtLoad ? "active" : "inactive",
    };
  } catch {
    return null;
  }
}

export async function readAutomations(): Promise<AutomationEntry[]> {
  try {
    const files = await fs.readdir(LAUNCH_AGENTS_DIR);
    const plistFiles = files
      .filter((f) => f.endsWith(".plist") && f.startsWith("ai."))
      .map((f) => path.join(LAUNCH_AGENTS_DIR, f));

    const results = await Promise.all(
      plistFiles.map((f) => readAutomationFromFile(f)),
    );

    return results.filter((r): r is AutomationEntry => r !== null);
  } catch {
    return [];
  }
}
