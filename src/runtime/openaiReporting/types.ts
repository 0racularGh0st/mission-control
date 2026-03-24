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
