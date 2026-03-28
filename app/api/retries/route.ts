import { type NextRequest, NextResponse } from "next/server";
import {
  createRetryEntry,
  dismissRetry,
  getRetries,
} from "@/src/server/retries";
import {
  RETRY_SOURCES,
  RETRY_STATUSES,
  type RetrySource,
  type RetryStatus,
} from "@/src/types/retries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const statusParam = searchParams.get("status") ?? undefined;
  if (statusParam && !RETRY_STATUSES.includes(statusParam as RetryStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${RETRY_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const sourceParam = searchParams.get("source") ?? undefined;
  if (sourceParam && !RETRY_SOURCES.includes(sourceParam as RetrySource)) {
    return NextResponse.json(
      { error: `Invalid source. Must be one of: ${RETRY_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }

  const result = getRetries({
    status: statusParam as RetryStatus | undefined,
    source: sourceParam as RetrySource | undefined,
    before: searchParams.get("before") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });

  return NextResponse.json({
    retries: result.retries,
    failed_count: result.failedCount,
    next_cursor: result.nextCursor,
    has_more: result.hasMore,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, ref_id, error_summary, error_detail, original_params, max_attempts } = body;

    if (!source || !ref_id || !error_summary) {
      return NextResponse.json(
        { error: "Missing required fields: source, ref_id, error_summary" },
        { status: 400 },
      );
    }

    if (!RETRY_SOURCES.includes(source as RetrySource)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${RETRY_SOURCES.join(", ")}` },
        { status: 400 },
      );
    }

    const entry = createRetryEntry({
      source,
      refId: ref_id,
      errorSummary: error_summary,
      errorDetail: error_detail ?? "",
      originalParams: original_params ? JSON.stringify(original_params) : undefined,
      maxAttempts: max_attempts ? Number(max_attempts) : undefined,
    });

    return NextResponse.json({ retry: entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing retry id" }, { status: 400 });
    }

    if (action !== "dismiss") {
      return NextResponse.json(
        { error: 'Action must be "dismiss"' },
        { status: 400 },
      );
    }

    const retry = dismissRetry(id);

    if (!retry) {
      return NextResponse.json(
        { error: "Retry not found or not in failed status" },
        { status: 409 },
      );
    }

    return NextResponse.json({ retry });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
