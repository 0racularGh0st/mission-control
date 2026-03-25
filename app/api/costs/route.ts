import { NextResponse } from "next/server";
import { getMiniMaxReporting } from "@/src/server/minimaxReporting";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getMiniMaxReporting();
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        source: "mock" as const,
        generatedAt: new Date().toISOString(),
        balanceUsd: 0,
        todayUsageUsd: 0,
        todayInputTokens: 0,
        todayOutputTokens: 0,
        trends7d: [],
        costPerModel: [],
        notes: [`Failed to fetch MiniMax reporting: ${String(error)}`],
      },
      { status: 200 },
    );
  }
}
