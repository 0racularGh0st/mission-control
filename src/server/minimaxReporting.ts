// MiniMax usage reporting adapter
// Attempts to read real MiniMax usage data, falls back to task-based estimates

import { getTasks } from "@/src/runtime/tasks/store";

export interface MiniMaxCostTrend {
  date: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface MiniMaxReportingDto {
  source: "live" | "mock";
  generatedAt: string;
  balanceUsd: number;
  todayUsageUsd: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  trends7d: MiniMaxCostTrend[];
  costPerModel: { model: string; costUsd: number; sharePct: number }[];
  notes: string[];
}

// MiniMax API base (Anthropic-compatible)
const MINIMAX_API_BASE = "https://api.minimax.io/anthropic";

function getMiniMaxApiKey(): string | null {
  // MINIMAX_API_KEY should be set in server environment
  const envKey = process.env.MINIMAX_API_KEY;
  if (envKey) return envKey;

  // Try auth-profiles.json
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as typeof import("fs");
    const raw = readFileSync("/Users/nigel/.openclaw/auth-profiles.json", "utf-8");
    const profiles = JSON.parse(raw) as Record<string, { apiKey?: string }>;
    const minimax = profiles["minimax:global"];
    return minimax?.apiKey ?? null;
  } catch {
    return null;
  }
}

async function fetchMiniMaxUsage(apiKey: string): Promise<MiniMaxReportingDto> {
  const generatedAt = new Date().toISOString();

  // Try MiniMax usage endpoint (Anthropic-compatible)
  const endpoints = [
    `${MINIMAX_API_BASE}/v1/usage`,
    `${MINIMAX_API_BASE}/v1/text/usage`,
  ];

  let usageData: unknown = null;
  let usedEndpoint = "";

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (res.ok) {
        usageData = await res.json();
        usedEndpoint = endpoint;
        break;
      }
    } catch {
      // try next endpoint
    }
  }

  const notes: string[] = [];

  if (!usageData) {
    // Fallback: generate mock trend data from task volume
    notes.push("MiniMax usage endpoint unavailable. Showing estimated trend from task volume.");
    return buildMockReporting(generatedAt, notes);
  }

  // Try to parse MiniMax response
  try {
    const parsed = usageData as Record<string, unknown>;
    notes.push(`Live data from MiniMax API: ${usedEndpoint}`);

    // Parse MiniMax usage response
    const data = parsed.data as unknown[] | undefined;
    const todayUsage = Array.isArray(data) && data.length > 0
      ? (data[data.length - 1] as Record<string, unknown>)
      : null;

    const todayInputTokens = todayUsage ? Number(todayUsage.input_tokens ?? 0) : 0;
    const todayOutputTokens = todayUsage ? Number(todayUsage.output_tokens ?? 0) : 0;
    const todayCost = todayUsage ? Number(todayUsage.cost ?? 0) : 0;

    // Build 7-day trend
    const trends7d: MiniMaxCostTrend[] = Array.isArray(data)
      ? data.slice(-7).map((entry) => {
          const e = entry as Record<string, unknown>;
          return {
            date: String(e.date ?? e.timestamp ?? ""),
            inputTokens: Number(e.input_tokens ?? 0),
            outputTokens: Number(e.output_tokens ?? 0),
            costUsd: Number(e.cost ?? 0),
          };
        })
      : [];

    return {
      source: "live",
      generatedAt,
      balanceUsd: Number(parsed.balance ?? parsed.credits ?? 0),
      todayUsageUsd: todayCost,
      todayInputTokens,
      todayOutputTokens,
      trends7d,
      costPerModel: [
        { model: "MiniMax-M2.7", costUsd: todayCost, sharePct: 100 },
      ],
      notes,
    };
  } catch (error) {
    notes.push(`Failed to parse MiniMax response: ${String(error)}`);
    return buildMockReporting(generatedAt, notes);
  }
}

function buildMockReporting(generatedAt: string, notes: string[]): MiniMaxReportingDto {
  const tasks = getTasks();
  // Estimate usage based on task volume
  const todayInputTokens = tasks.length * 1200;
  const todayOutputTokens = tasks.length * 800;
  const inputCostPer1k = 0.3;
  const outputCostPer1k = 1.2;
  const todayCost = (todayInputTokens / 1000) * inputCostPer1k + (todayOutputTokens / 1000) * outputCostPer1k;

  // Build 7-day trend (mock)
  const trends7d: MiniMaxCostTrend[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const multiplier = i === 0 ? 1 : Math.random() * 0.5 + 0.5;
    trends7d.push({
      date: dateStr,
      inputTokens: Math.round(todayInputTokens * multiplier),
      outputTokens: Math.round(todayOutputTokens * multiplier),
      costUsd: Math.round(todayCost * multiplier * 100) / 100,
    });
  }

  return {
    source: "mock",
    generatedAt,
    balanceUsd: 0,
    todayUsageUsd: Math.round(todayCost * 100) / 100,
    todayInputTokens,
    todayOutputTokens,
    trends7d,
    costPerModel: [
      { model: "MiniMax-M2.7", costUsd: Math.round(todayCost * 100) / 100, sharePct: 100 },
    ],
    notes,
  };
}

export async function getMiniMaxReporting(): Promise<MiniMaxReportingDto> {
  const apiKey = getMiniMaxApiKey();

  if (!apiKey) {
    const generatedAt = new Date().toISOString();
    return buildMockReporting(generatedAt, ["No MiniMax API key found. Using task-based estimates."]);
  }

  try {
    return await fetchMiniMaxUsage(apiKey);
  } catch (error) {
    const generatedAt = new Date().toISOString();
    return buildMockReporting(generatedAt, [`MiniMax API error: ${String(error)}`]);
  }
}
