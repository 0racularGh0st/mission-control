import { NextRequest, NextResponse } from "next/server";
import { scanAndIngestSessions, getClaudeSessionsPaginated } from "@/src/server/claudeSessionScanner";

export const dynamic = "force-dynamic";

/**
 * GET /api/claude/sessions — paginated list of Claude Code sessions
 * Query params: cursor (ISO string), limit (number), project (string)
 */
export async function GET(req: NextRequest) {
  try {
    // Ensure DB is up to date
    scanAndIngestSessions();

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
    const project = url.searchParams.get("project") ?? undefined;

    const result = getClaudeSessionsPaginated({ cursor, limit, project });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { sessions: [], nextCursor: null, error: String(error) },
      { status: 500 },
    );
  }
}
