import { NextRequest, NextResponse } from "next/server";

import { logActivity, readActivitiesFromFile } from "@/src/server/agentActivityLog";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

export const dynamic = "force-dynamic";

function ensureJarvisStartup() {
  const activities = readActivitiesFromFile(50);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const hasRecentJarvis = activities.some(
    (a) =>
      a.agentType === "jarvis" &&
      a.taskDescription === "Jarvis session started" &&
      new Date(a.startedAt).getTime() > oneHourAgo,
  );
  if (!hasRecentJarvis) {
    const startupEntry: AgentActivityEntry = {
      id: `jarvis-startup-${Date.now()}`,
      sessionKey: "jarvis",
      agentType: "jarvis",
      model: "MiniMax-M2.7",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      taskDescription: "Jarvis session started",
      status: "running",
      resultSummary: "Jarvis session is active.",
      estimatedCostUsd: 0,
    };
    try {
      logActivity(startupEntry);
    } catch {
      // don't fail if logging fails
    }
  }
}

export async function GET() {
  try {
    ensureJarvisStartup();
    const activities = readActivitiesFromFile(50) as AgentActivityEntry[];
    return NextResponse.json(
      { activities },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Accel-Buffering": "no",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { activities: [], error: String(error) },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    logActivity(body as AgentActivityEntry);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 200 },
    );
  }
}
