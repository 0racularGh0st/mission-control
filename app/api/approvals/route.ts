import { type NextRequest, NextResponse } from "next/server";
import {
  createApproval,
  getApprovals,
  resolveApproval,
} from "@/src/server/approvals";
import { APPROVAL_RISK_LEVELS, type ApprovalRiskLevel, type ApprovalStatus, APPROVAL_STATUSES } from "@/src/types/approvals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const statusParam = searchParams.get("status") ?? undefined;
  if (statusParam && !APPROVAL_STATUSES.includes(statusParam as ApprovalStatus)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${APPROVAL_STATUSES.join(", ")}` }, { status: 400 });
  }

  const result = getApprovals({
    status: statusParam as ApprovalStatus | undefined,
    agent: searchParams.get("agent") ?? undefined,
    before: searchParams.get("before") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });

  return NextResponse.json({
    approvals: result.approvals,
    pending_count: result.pendingCount,
    next_cursor: result.nextCursor,
    has_more: result.hasMore,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent, action, reason, risk_level, context, ref_id, ttl_minutes } = body;

    if (!agent || !action) {
      return NextResponse.json({ error: "Missing required fields: agent, action" }, { status: 400 });
    }

    if (risk_level && !APPROVAL_RISK_LEVELS.includes(risk_level as ApprovalRiskLevel)) {
      return NextResponse.json(
        { error: `Invalid risk_level. Must be one of: ${APPROVAL_RISK_LEVELS.join(", ")}` },
        { status: 400 },
      );
    }

    const approval = createApproval({
      agent,
      action,
      reason: reason ?? "",
      riskLevel: (risk_level as ApprovalRiskLevel) ?? "medium",
      context: context ?? "",
      refId: ref_id ?? "",
      ttlMinutes: ttl_minutes ? Number(ttl_minutes) : undefined,
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, comment } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing approval id" }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: 'Action must be "approve" or "reject"' }, { status: 400 });
    }

    const approval = resolveApproval(id, action, comment);

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found or already resolved" },
        { status: 409 },
      );
    }

    return NextResponse.json({ approval });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
