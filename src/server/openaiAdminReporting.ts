import type { OpenAIAdminReportingDto } from "@/src/runtime/openaiReporting/types";

type AdminFetchResult = {
  ok: boolean;
  status: number;
  body: unknown;
  endpoint: string;
  error?: string;
};

const OPENAI_ADMIN_BASE_URL = "https://api.openai.com/v1/organization";
const DEFAULT_LOOKBACK_DAYS = 30;

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

function summarizeCosts(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return 0;
  }

  return data.reduce((sum, row) => {
    if (!row || typeof row !== "object") {
      return sum;
    }

    const entry = row as {
      amount?: { value?: unknown };
      cost_usd?: unknown;
      total_cost_usd?: unknown;
      value?: unknown;
    };

    return sum + toNumber(entry.amount?.value ?? entry.cost_usd ?? entry.total_cost_usd ?? entry.value);
  }, 0);
}

function summarizeUsage(payload: unknown) {
  const zero = { inputTokens: 0, outputTokens: 0, requests: 0 };

  if (!payload || typeof payload !== "object") {
    return zero;
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return zero;
  }

  return data.reduce(
    (acc, row) => {
      if (!row || typeof row !== "object") {
        return acc;
      }

      const entry = row as {
        input_tokens?: unknown;
        output_tokens?: unknown;
        num_model_requests?: unknown;
        requests?: unknown;
      };

      acc.inputTokens += toNumber(entry.input_tokens);
      acc.outputTokens += toNumber(entry.output_tokens);
      acc.requests += toNumber(entry.num_model_requests ?? entry.requests);
      return acc;
    },
    { ...zero },
  );
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
      notes: ["Configured fallback response because OPENAI_ADMIN_API_KEY is not set."],
    };
  }

  const startTime = getStartUnixTime(DEFAULT_LOOKBACK_DAYS);
  const query = `?start_time=${startTime}&bucket_width=1d&limit=${DEFAULT_LOOKBACK_DAYS}`;

  const [costsResult, usageResult] = await Promise.all([
    fetchAdminPath(apiKey, `/costs${query}`),
    fetchAdminPath(apiKey, `/usage/completions${query}`),
  ]);

  const spendUsd = costsResult.ok ? summarizeCosts(costsResult.body) : 0;
  const usageSummary = usageResult.ok ? summarizeUsage(usageResult.body) : summarizeUsage(null);

  const notes: string[] = [];
  if (!costsResult.ok) {
    notes.push("Costs endpoint unavailable (permission or API variance). Returning zero spend fallback.");
  }
  if (!usageResult.ok) {
    notes.push("Usage endpoint unavailable (permission or API variance). Returning zero token/request fallback.");
  }

  return {
    source: costsResult.ok || usageResult.ok ? "live" : "mock",
    generatedAt,
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    totals: {
      spendUsd,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      requests: usageSummary.requests,
    },
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
