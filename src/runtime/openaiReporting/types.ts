export type OpenAIAdminReportingDto = {
  source: "live" | "mock";
  generatedAt: string;
  lookbackDays: number;
  totals: {
    spendUsd: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  };
  budget: {
    configured: boolean;
    budgetUsd: number;
    spendUsd: number;
    remainingUsd: number;
    progressRatio: number;
    resetAt: string;
    resetInDays: number;
    editHint: string;
  };
  endpoints: {
    costs: {
      ok: boolean;
      status: number;
      endpoint: string;
      error?: string;
    };
    usage: {
      ok: boolean;
      status: number;
      endpoint: string;
      error?: string;
    };
  };
  notes: string[];
};
