import { type NextRequest, NextResponse } from "next/server";
import { getTimelineEvents } from "@/src/server/timeline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") ?? undefined;
  const before = searchParams.get("before") ?? undefined;
  const limitStr = searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const result = getTimelineEvents({ source, before, limit });

  return NextResponse.json({
    events: result.events,
    next_cursor: result.nextCursor,
    has_more: result.hasMore,
  });
}
