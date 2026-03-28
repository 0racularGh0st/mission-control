// Approval types — shared across client and server

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";

export const APPROVAL_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected", "expired"];
export const APPROVAL_RISK_LEVELS: ApprovalRiskLevel[] = ["low", "medium", "high", "critical"];

export interface Approval {
  id: string;
  agent: string;
  action: string;
  reason: string;
  riskLevel: ApprovalRiskLevel;
  context: string;
  status: ApprovalStatus;
  comment: string;
  refId: string;
  expiresAt: string; // ISO
  resolvedAt: string | null;
  createdAt: string; // ISO
}

export interface ApprovalsResponse {
  approvals: Approval[];
  pendingCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}
