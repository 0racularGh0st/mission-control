import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Reads openclaw cron jobs from ~/.openclaw/cron/jobs.json
 * These are agent-scheduled cron jobs (market updates, daily tasks, etc.)
 */

export interface CronJob {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule: CronJobSchedule;
  agentId: string;
}

type CronJobSchedule =
  | { kind: "cron"; expr: string; tz?: string }
  | { kind: "every"; everyMs: number; anchorMs?: number };

const JOBS_FILE = path.join(os.homedir(), ".openclaw", "cron", "jobs.json");

/**
 * Parse a cron expression and return the hour/minute and day-of-week constraints.
 * Only supports standard 5-field cron: minute hour dom month dow
 */
function parseCronExpr(expr: string): {
  minute: number;
  hour: number;
  daysOfWeek: number[] | null; // 0=Sun, 1=Mon..6=Sat; null = every day
} | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  if (isNaN(minute) || isNaN(hour)) return null;

  // Parse day-of-week field
  const dowField = parts[4];
  let daysOfWeek: number[] | null = null;
  if (dowField !== "*") {
    daysOfWeek = [];
    // Handle ranges like "1-5" and lists like "1,3,5"
    for (const segment of dowField.split(",")) {
      const rangeParts = segment.split("-");
      if (rangeParts.length === 2) {
        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        if (isNaN(start) || isNaN(end)) return null;
        for (let i = start; i <= end; i++) daysOfWeek.push(i);
      } else {
        const d = parseInt(segment, 10);
        if (isNaN(d)) return null;
        daysOfWeek.push(d);
      }
    }
  }

  return { minute, hour, daysOfWeek };
}

/**
 * Check if a given date falls on an allowed day-of-week.
 * Cron dow: 0=Sun, 1=Mon..6=Sat (same as JS getDay())
 */
function isDayAllowed(date: Date, daysOfWeek: number[] | null): boolean {
  if (!daysOfWeek) return true;
  return daysOfWeek.includes(date.getDay());
}

export interface ProjectedCronRun {
  jobId: string;
  name: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (in the job's configured timezone, converted to display) */
  time: string;
  scheduleLabel: string;
  agentId: string;
}

/**
 * Project cron job runs onto days in a given month.
 */
export function projectCronRuns(
  jobs: CronJob[],
  month: number,
  year: number,
): ProjectedCronRun[] {
  const runs: ProjectedCronRun[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (const job of jobs) {
    if (!job.enabled) continue;

    if (job.schedule.kind === "cron") {
      const parsed = parseCronExpr(job.schedule.expr);
      if (!parsed) continue;

      const timeStr = `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
      const tz = job.schedule.tz;
      const scheduleLabel = tz
        ? `${job.schedule.expr} (${tz})`
        : job.schedule.expr;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        if (!isDayAllowed(date, parsed.daysOfWeek)) continue;

        const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        runs.push({
          jobId: job.id,
          name: job.name,
          description: job.description,
          date: dayStr,
          time: timeStr,
          scheduleLabel,
          agentId: job.agentId,
        });
      }
    } else if (job.schedule.kind === "every") {
      // Interval-based: one summary entry per day
      const intervalHours = Math.round(job.schedule.everyMs / 3600000);
      const scheduleLabel =
        intervalHours >= 1 ? `every ${intervalHours}h` : `every ${Math.round(job.schedule.everyMs / 60000)}m`;

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        runs.push({
          jobId: job.id,
          name: job.name,
          description: job.description,
          date: dayStr,
          time: "00:00",
          scheduleLabel,
          agentId: job.agentId,
        });
      }
    }
  }

  return runs;
}

/**
 * Read all cron jobs from ~/.openclaw/cron/jobs.json
 */
export async function readCronJobs(): Promise<CronJob[]> {
  try {
    const content = await fs.readFile(JOBS_FILE, "utf-8");
    const data = JSON.parse(content) as { jobs?: unknown[] };
    if (!Array.isArray(data.jobs)) return [];

    const jobs: CronJob[] = [];
    for (const raw of data.jobs) {
      if (typeof raw !== "object" || raw === null) continue;
      const j = raw as Record<string, unknown>;
      if (typeof j.id !== "string" || typeof j.name !== "string") continue;
      if (typeof j.schedule !== "object" || j.schedule === null) continue;

      const sched = j.schedule as Record<string, unknown>;
      let schedule: CronJobSchedule;

      if (sched.kind === "cron" && typeof sched.expr === "string") {
        schedule = {
          kind: "cron",
          expr: sched.expr,
          tz: typeof sched.tz === "string" ? sched.tz : undefined,
        };
      } else if (sched.kind === "every" && typeof sched.everyMs === "number") {
        schedule = {
          kind: "every",
          everyMs: sched.everyMs,
          anchorMs: typeof sched.anchorMs === "number" ? sched.anchorMs : undefined,
        };
      } else {
        continue;
      }

      jobs.push({
        id: j.id,
        name: j.name,
        description: typeof j.description === "string" ? j.description : j.name,
        enabled: j.enabled !== false,
        schedule,
        agentId: typeof j.agentId === "string" ? j.agentId : "unknown",
      });
    }

    return jobs;
  } catch {
    return [];
  }
}
