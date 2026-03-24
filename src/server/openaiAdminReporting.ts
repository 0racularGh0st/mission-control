import type { OpenAIAdminReportingDto } from "@/src/runtime/openaiReporting/types";

type AdminFetchResult = {
  ok: boolean;
  status: number;
  body: unknown;
  endpoint: string;
  error?: string;
};

type UsageSummary = {
  inputTokens: number;
  outputTokens: number;
  requests: number;
};

const OPENAI_ADMIN_BASE_URL = "https://api.openai.com/v1/organization";
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_BUDGET_PLACEHOLDER = "Set OPENAI_MONTHLY_BUDGET_USD in server env to enable editing.";

function getStartUnixTime(days: number) {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function collectObjects(payload: unknown): Record<string, unknown>[] {
  const collected: Record<string, unknown>[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const objectNode = node as Record<string, unknown>;
    collected.push(objectNode);

    Object.values(objectNode).forEach(visit);
  };

  visit(payload);
  return collected;
}

function summarizeCosts(payload: unknown) {
  let sum = 0;
  let matchedRows = 0;

  for (const entry of collectObjects(payload)) {
    const amount = entry.amount;
    const amountValue = amount && typeof amount === "object" ? (amount as { value?: unknown }).value : undefined;
    const value = amountValue ?? entry.cost_usd ?? entry.total_cost_usd ?? entry.value;
    const parsed = toNumber(value);

    if (parsed > 0) {
      sum += parsed;
      matchedRows += 1;
    }
  }

  return { total: sum, matchedRows };
}

function summarizeUsage(payload: unknown) {
  const summary: UsageSummary = { inputTokens: 0, outputTokens: 0, requests: 0 };
  let matchedRows = 0;

  for (const entry of collectObjects(payload)) {
    const inputTokens = toNumber(entry.input_tokens);
    const outputTokens = toNumber(entry.output_tokens);
    const requests = toNumber(entry.num_model_requests ?? entry.requests);

    if (inputTokens > 0 || outputTokens > 0 || requests > 0) {
      summary.inputTokens += inputTokens;
      summary.outputTokens += outputTokens;
      summary.requests += requests;
      matchedRows += 1;
    }
  }

  return { ...summary, matchedRows };
}

function buildBudgetSummary(spendUsd: number) {
  const rawBudget = process.env.OPENAI_MONTHLY_BUDGET_USD;
  const budgetUsd = toNumber(rawBudget);
  const configured = budgetUsd > 0;

  const now = new Date();
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  const msRemaining = Math.max(resetAt.getTime() - Date.now(), 0);
  const resetInDays = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  const progressRatio = configured ? Math.min(spendUsd / budgetUsd, 1) : 0;
  const remainingUsd = configured ? budgetUsd - spendUsd : 0;

  return {
    configured,
    budgetUsd,
    spendUsd,
    remainingUsd,
    progressRatio,
    resetAt: resetAt.toISOString(),
    resetInDays,
    editHint: DEFAULT_BUDGET_PLACEHOLDER,
  };
}

async function fetchAdminPath(apiKey: string, pathWithQuery: string): Promise<AdminFetchResult> {
  const endpoint = `${OPENAI_ADMIN_BASE_URL}${pathWithQuery}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();
    let body: unknown = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    if (!response.ok) {
      const apiError =
        body && typeof body === "object" && "error" in body
          ? JSON.stringify((body as { error?: unknown }).error)
          : undefined;

      return {
        ok: false,
        status: response.status,
        endpoint,
        body,
        error: apiError ?? `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      endpoint,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      endpoint,
      body: null,
      error: String(error),
    };
  }
}

export async function getOpenAIAdminReporting(): Promise<OpenAIAdminReportingDto> {
  const apiKey = process.env.OPENAI_ADMIN_API_KEY;
  const generatedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      source: "mock",
      generatedAt,
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
      totals: {
        spendUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
      },
      budget: buildBudgetSummary(0),
      endpoints: {
        costs: {
          ok: false,
          status: 0,
          endpoint: `${OPENAI_ADMIN_BASE_URL}/costs`,
          error: "OPENAI_ADMIN_API_KEY missing",
        },
        usage: {
          ok: false,
          status: 0,
          endpoint: `${OPENAI_ADMIN_BASE_URL}/usage/completions`,
          error: "OPENAI_ADMIN_API_KEY missing",
        },
      },
      notes: [
        "Configured fallback response because OPENAI_ADMIN_API_KEY is not set.",
        "No live OpenAI payload could be parsed.",
      ],
    };
  }

  const startTime = getStartUnixTime(DEFAULT_LOOKBACK_DAYS);
  const query = `?start_time=${startTime}&bucket_width=1d&limit=${DEFAULT_LOOKBACK_DAYS}`;

  const [costsResult, usageResult] = await Promise.all([
    fetchAdminPath(apiKey, `/costs${query}`),
    fetchAdminPath(apiKey, `/usage/completions${query}`),
  ]);

  const costSummary = costsResult.ok ? summarizeCosts(costsResult.body) : { total: 0, matchedRows: 0 };
  const usageSummary = usageResult.ok
    ? summarizeUsage(usageResult.body)
    : { inputTokens: 0, outputTokens: 0, requests: 0, matchedRows: 0 };

  const notes: string[] = [];

  if (!costsResult.ok) {
    notes.push("Costs endpoint unavailable (permission or API variance). Returning zero spend fallback.");
  } else if (costSummary.matchedRows === 0) {
    notes.push("Costs endpoint returned no parseable amount fields. Check response shape/permissions.");
  }

  if (!usageResult.ok) {
    notes.push("Usage endpoint unavailable (permission or API variance). Returning zero token/request fallback.");
  } else if (usageSummary.matchedRows === 0) {
    notes.push("Usage endpoint returned no parseable token/request fields. Check response shape/permissions.");
  }

  notes.push(
    `Diagnostics: parsed cost rows=${costSummary.matchedRows}, usage rows=${usageSummary.matchedRows}, lookback=${DEFAULT_LOOKBACK_DAYS}d.`,
  );

  return {
    source: costsResult.ok || usageResult.ok ? "live" : "mock",
    generatedAt,
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    totals: {
      spendUsd: costSummary.total,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      requests: usageSummary.requests,
    },
    budget: buildBudgetSummary(costSummary.total),
    endpoints: {
      costs: {
        ok: costsResult.ok,
        status: costsResult.status,
        endpoint: costsResult.endpoint,
        error: costsResult.error,
      },
      usage: {
        ok: usageResult.ok,
        status: usageResult.status,
        endpoint: usageResult.endpoint,
        error: usageResult.error,
      },
    },
    notes,
  };
}
