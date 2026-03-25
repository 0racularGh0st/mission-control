import { NextRequest, NextResponse } from "next/server";

import { logActivity, readActivitiesFromFile } from "@/src/server/agentActivityLog";
import { ensureJarvisLogged, pollAndLogActiveSessions } from "@/src/server/sessionMonitor";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Poll OpenClaw sessions and log any new active agents
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
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 200 },
    );
  }
}
