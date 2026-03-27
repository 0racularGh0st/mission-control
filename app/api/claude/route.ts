import { NextResponse } from "next/server";
import { scanAndIngestSessions, getClaudeUsageSummary } from "@/src/server/claudeSessionScanner";

export const dynamic = "force-dynamic";

/**
 * GET /api/claude — usage summary + trigger scan
 */
export async function GET() {
  try {
    const scanResult = scanAndIngestSessions();
    const usage = getClaudeUsageSummary();

    return NextResponse.json({
      usage,
      scan: scanResult,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
