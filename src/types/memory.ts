// Memory types — shared across client and server

export type MemoryType = "user" | "feedback" | "project" | "reference";
export type MemoryEdgeType = "shared_topic" | "reference" | "same_agent" | "temporal";

export const MEMORY_TYPES: MemoryType[] = ["user", "feedback", "project", "reference"];
export const MEMORY_EDGE_TYPES: MemoryEdgeType[] = ["shared_topic", "reference", "same_agent", "temporal"];

export interface MemoryEntry {
  id: string;
  sourcePath: string;
  agent: string;
  name: string;
  description: string;
  memType: MemoryType;
  content: string;
  topics: string[];
  fileHash: string;
  discoveredAt: string;
  updatedAt: string;
}

export interface MemoryEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: MemoryEdgeType;
  weight: number;
  label: string;
}

export interface MemoryGraphResponse {
  nodes: MemoryEntry[];
  edges: MemoryEdge[];
}

export interface MemoryListResponse {
  entries: MemoryEntry[];
  total: number;
}

export interface MemoryScanResult {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  skipped: number;
  scannedDirs: string[];
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  byAgent: Record<string, number>;
  edgeCount: number;
  lastScanAt: string | null;
}
