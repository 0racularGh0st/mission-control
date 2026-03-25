import { NextRequest, NextResponse } from "next/server";
import { logActivity, updateActivityStatus, readActivitiesFromFile } from "@/src/server/agentActivityLog";
import { ensureJarvisLogged, pollAndLogActiveSessions } from "@/src/server/sessionMonitor";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Poll OpenClaw sessions immediately on every request — client polling drives the monitor
    await ensureJarvisLogged();
    await pollAndLogActiveSessions();

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
    return NextResponse.json({ success: false, error: String(error) }, { status: 200 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionKey, status, completedAt, durationMs, tokensIn, tokensOut, resultSummary, estimatedCostUsd } = body;

    if (!sessionKey) {
      return NextResponse.json({ success: false, error: "Missing sessionKey" }, { status: 400 });
    }

    updateActivityStatus(sessionKey, {
      status: status ?? "completed",
      completedAt: completedAt ?? new Date().toISOString(),
      durationMs: durationMs ?? 0,
      tokensIn: tokensIn ?? 0,
      tokensOut: tokensOut ?? 0,
      resultSummary: resultSummary ?? "Completed",
      estimatedCostUsd: estimatedCostUsd ?? 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 200 });
  }
}
