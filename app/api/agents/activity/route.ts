import { NextResponse } from "next/server";

import { readActivitiesFromFile } from "@/src/server/agentActivityLog";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
