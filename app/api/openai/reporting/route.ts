import { NextResponse } from "next/server";

import { getOpenAIAdminReporting } from "@/src/server/openaiAdminReporting";

export async function GET() {
  try {
    const report = await getOpenAIAdminReporting();
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        source: "mock",
        generatedAt: new Date().toISOString(),
        lookbackDays: 30,
        totals: {
          spendUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          requests: 0,
        },
        endpoints: {
          costs: {
            ok: false,
            status: 0,
            endpoint: "https://api.openai.com/v1/organization/costs",
            error: String(error),
          },
          usage: {
            ok: false,
            status: 0,
            endpoint: "https://api.openai.com/v1/organization/usage/completions",
            error: String(error),
          },
        },
        notes: ["Adapter failed unexpectedly. Returned safe mock payload."],
      },
      { status: 200 },
    );
  }
}
