/**
 * Inspector server module — parses transcripts and builds inspection data
 * from existing agent_activity and claude_sessions tables.
 */

import { getDb } from "@/src/server/db";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type {
  InspectorData,
  InspectorMessage,
  InspectorMeta,
  InspectorSource,
  ToolCallInfo,
  ToolSummary,
  CostBreakdown,
} from "@/src/types/inspector";

// ── Pricing (per 1K tokens, approximate) ──

const PRICING: Record<string, { input: number; output: number; cache: number }> = {
  "claude-opus-4-6":    { input: 0.015, output: 0.075, cache: 0.00188 },
  "claude-sonnet-4-6":  { input: 0.003, output: 0.015, cache: 0.000375 },
  "claude-haiku-4-5":   { input: 0.0008, output: 0.004, cache: 0.0001 },
};

function getPricing(model: string) {
  // Try exact match, then prefix match
  if (PRICING[model]) return PRICING[model];
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key)) return PRICING[key];
  }
  // Default to sonnet pricing
  return PRICING["claude-sonnet-4-6"];
}

function computeCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  tokensCache: number,
): number {
  const p = getPricing(model);
  return (tokensIn * p.input + tokensOut * p.output + tokensCache * p.cache) / 1000;
}

// ── DB Row Interfaces ──

interface SessionRow {
  session_id: string;
  project: string;
  cwd: string;
  started_at: string;
  ended_at: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_create: number;
  cost_usd: number;
  duration_ms: number;
  message_count: number;
  transcript: string;
  git_branch: string;
  version: string;
}

interface AgentRow {
  id: string;
  session_key: string;
  agent_type: string;
  model: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  task_desc: string;
  status: string;
  result: string;
  cost_usd: number;
}

// ── Transcript Parsing ──

interface TranscriptLine {
  type?: string;
  role?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; tool_use_id?: string; name?: string; input?: unknown; content?: string }>;
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    stop_reason?: string;
  };
  content_block?: {
    type?: string;
    text?: string;
    name?: string;
    input?: unknown;
  };
  timestamp?: string;
  duration_ms?: number;
  // For tool results
  tool_use_id?: string;
  result?: string;
  output?: string;
  error?: string;
}

const MAX_CONTENT_PREVIEW = 500;
const MAX_TOOL_RESULT_PREVIEW = 500;
const MAX_TRANSCRIPT_SIZE = 50 * 1024 * 1024; // 50MB

function parseTranscript(transcriptPath: string, maxMessages: number = 200): InspectorMessage[] {
  if (!transcriptPath || !existsSync(transcriptPath)) return [];

  // Check file size
  const stat = statSync(transcriptPath);
  if (stat.size > MAX_TRANSCRIPT_SIZE) {
    // For very large files, only read first portion
    return parseTranscriptContent(
      readFileSync(transcriptPath, "utf-8").slice(0, MAX_TRANSCRIPT_SIZE),
      maxMessages,
    );
  }

  const content = readFileSync(transcriptPath, "utf-8");
  return parseTranscriptContent(content, maxMessages);
}

function parseTranscriptContent(content: string, maxMessages: number): InspectorMessage[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const messages: InspectorMessage[] = [];
  let messageIndex = 0;

  for (const line of lines) {
    if (messageIndex >= maxMessages) break;

    let parsed: TranscriptLine;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const msg = extractMessage(parsed, messageIndex);
    if (msg) {
      messages.push(msg);
      messageIndex++;
    }
  }

  // Compute durations between messages
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].timestamp && messages[i + 1].timestamp) {
      const t1 = new Date(messages[i].timestamp).getTime();
      const t2 = new Date(messages[i + 1].timestamp).getTime();
      if (!isNaN(t1) && !isNaN(t2)) {
        messages[i].durationMs = Math.max(0, t2 - t1);
      }
    }
  }

  return messages;
}

function extractMessage(parsed: TranscriptLine, index: number): InspectorMessage | null {
  // Handle different transcript line formats
  const timestamp = parsed.timestamp ?? new Date().toISOString();

  // Format 1: { type: "message", message: { role, content, ... } }
  if (parsed.type === "message" && parsed.message) {
    const msg = parsed.message;
    const role = (msg.role ?? "assistant") as InspectorMessage["role"];
    const contentStr = extractContentString(msg.content);
    const toolCalls = extractToolCalls(msg.content);
    const usage = msg.usage ?? {};

    return {
      index,
      role,
      content: contentStr.slice(0, MAX_CONTENT_PREVIEW),
      fullContent: contentStr.length > MAX_CONTENT_PREVIEW ? contentStr : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      tokensIn: usage.input_tokens ?? 0,
      tokensOut: usage.output_tokens ?? 0,
      tokensCache: (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
      costUsd: 0, // Computed later
      timestamp,
      durationMs: parsed.duration_ms ?? 0,
    };
  }

  // Format 2: { role: "user", ... } (direct role field)
  if (parsed.role) {
    const role = parsed.role as InspectorMessage["role"];
    const contentStr = typeof parsed.message === "string"
      ? parsed.message
      : parsed.result ?? parsed.output ?? "";

    return {
      index,
      role,
      content: String(contentStr).slice(0, MAX_CONTENT_PREVIEW),
      fullContent: String(contentStr).length > MAX_CONTENT_PREVIEW ? String(contentStr) : undefined,
      tokensIn: 0,
      tokensOut: 0,
      tokensCache: 0,
      costUsd: 0,
      timestamp,
      durationMs: parsed.duration_ms ?? 0,
    };
  }

  // Format 3: tool result
  if (parsed.type === "tool_result" || parsed.tool_use_id) {
    const resultText = parsed.result ?? parsed.output ?? parsed.error ?? "";

    return {
      index,
      role: "tool",
      content: String(resultText).slice(0, MAX_CONTENT_PREVIEW),
      fullContent: String(resultText).length > MAX_CONTENT_PREVIEW ? String(resultText) : undefined,
      toolResult: String(resultText).slice(0, MAX_TOOL_RESULT_PREVIEW),
      tokensIn: 0,
      tokensOut: 0,
      tokensCache: 0,
      costUsd: 0,
      timestamp,
      durationMs: 0,
    };
  }

  return null;
}

function extractContentString(
  content: string | Array<{ type: string; text?: string }> | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function extractToolCalls(
  content: string | Array<{ type: string; name?: string; input?: unknown; text?: string }> | undefined,
): ToolCallInfo[] {
  if (!content || typeof content === "string" || !Array.isArray(content)) return [];

  return content
    .filter((b) => b.type === "tool_use" && b.name)
    .map((b) => ({
      name: b.name!,
      arguments: typeof b.input === "string" ? b.input : JSON.stringify(b.input ?? {}).slice(0, 1000),
      resultPreview: "", // Populated via tool_result messages
    }));
}

// ── Public API ──

export function getInspectorData(
  source: InspectorSource,
  id: string,
): InspectorData | null {
  if (source === "sessions") {
    return getSessionInspectorData(id);
  }
  if (source === "agents") {
    return getAgentInspectorData(id);
  }
  return null;
}

function getSessionInspectorData(sessionId: string): InspectorData | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM claude_sessions WHERE session_id = ?")
    .get(sessionId) as SessionRow | undefined;

  if (!row) return null;

  // Parse transcript
  const transcriptPath = row.transcript;
  const messages = parseTranscript(transcriptPath);
  const transcriptAvailable = messages.length > 0;

  // Compute per-message costs
  const model = row.model;
  for (const msg of messages) {
    msg.costUsd = computeCost(model, msg.tokensIn, msg.tokensOut, msg.tokensCache);
  }

  // Build tool summary from messages
  const toolSummary = buildToolSummary(messages);

  // Build cost breakdown
  const totalIn = messages.reduce((sum, m) => sum + m.tokensIn, 0);
  const totalOut = messages.reduce((sum, m) => sum + m.tokensOut, 0);
  const totalCache = messages.reduce((sum, m) => sum + m.tokensCache, 0);
  const pricing = getPricing(model);

  const costBreakdown: CostBreakdown = {
    input: (totalIn * pricing.input) / 1000,
    output: (totalOut * pricing.output) / 1000,
    cache: (totalCache * pricing.cache) / 1000,
  };

  const meta: InspectorMeta = {
    source: "sessions",
    id: row.session_id,
    model: row.model,
    status: row.ended_at ? "completed" : "in_progress",
    totalTokensIn: row.input_tokens || totalIn,
    totalTokensOut: row.output_tokens || totalOut,
    totalTokensCache: (row.cache_read + row.cache_create) || totalCache,
    totalCostUsd: row.cost_usd || costBreakdown.input + costBreakdown.output + costBreakdown.cache,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    project: row.project || undefined,
  };

  return {
    meta,
    messages,
    toolSummary,
    costBreakdown,
    transcriptAvailable,
  };
}

function getAgentInspectorData(agentId: string): InspectorData | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM agent_activity WHERE id = ?")
    .get(agentId) as AgentRow | undefined;

  if (!row) return null;

  // Agents don't have transcripts, but we show metadata
  const meta: InspectorMeta = {
    source: "agents",
    id: row.id,
    model: row.model,
    status: row.status,
    totalTokensIn: row.tokens_in,
    totalTokensOut: row.tokens_out,
    totalTokensCache: 0,
    totalCostUsd: row.cost_usd,
    startedAt: row.started_at,
    endedAt: row.completed_at,
    durationMs: row.duration_ms,
    taskDesc: row.task_desc || undefined,
  };

  // Build a synthetic message list from agent result
  const messages: InspectorMessage[] = [];
  if (row.task_desc) {
    messages.push({
      index: 0,
      role: "user",
      content: row.task_desc.slice(0, MAX_CONTENT_PREVIEW),
      fullContent: row.task_desc.length > MAX_CONTENT_PREVIEW ? row.task_desc : undefined,
      tokensIn: row.tokens_in,
      tokensOut: 0,
      tokensCache: 0,
      costUsd: computeCost(row.model, row.tokens_in, 0, 0),
      timestamp: row.started_at,
      durationMs: row.duration_ms,
    });
  }
  if (row.result) {
    messages.push({
      index: messages.length,
      role: "assistant",
      content: row.result.slice(0, MAX_CONTENT_PREVIEW),
      fullContent: row.result.length > MAX_CONTENT_PREVIEW ? row.result : undefined,
      tokensIn: 0,
      tokensOut: row.tokens_out,
      tokensCache: 0,
      costUsd: computeCost(row.model, 0, row.tokens_out, 0),
      timestamp: row.completed_at ?? row.started_at,
      durationMs: 0,
    });
  }

  const pricing = getPricing(row.model);
  const costBreakdown: CostBreakdown = {
    input: (row.tokens_in * pricing.input) / 1000,
    output: (row.tokens_out * pricing.output) / 1000,
    cache: 0,
  };

  return {
    meta,
    messages,
    toolSummary: { totalCalls: 0, toolsUsed: [], byTool: {} },
    costBreakdown,
    transcriptAvailable: false,
  };
}

function buildToolSummary(messages: InspectorMessage[]): ToolSummary {
  const byTool: Record<string, number> = {};
  let totalCalls = 0;

  for (const msg of messages) {
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        byTool[tc.name] = (byTool[tc.name] ?? 0) + 1;
        totalCalls++;
      }
    }
  }

  return {
    totalCalls,
    toolsUsed: Object.keys(byTool),
    byTool,
  };
}

export function getMessageFullContent(
  source: InspectorSource,
  id: string,
  messageIndex: number,
): { content: string } | null {
  const data = getInspectorData(source, id);
  if (!data) return null;

  const msg = data.messages.find((m) => m.index === messageIndex);
  if (!msg) return null;

  return { content: msg.fullContent ?? msg.content };
}
