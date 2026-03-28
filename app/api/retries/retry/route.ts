import { type NextRequest, NextResponse } from "next/server";
import { attemptRetry } from "@/src/server/retries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, override_params } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing retry id" }, { status: 400 });
    }

    const result = attemptRetry(id, override_params);

    if (!result) {
      return NextResponse.json(
        { error: "Retry not found, already in progress, or max attempts exceeded" },
        { status: 409 },
      );
    }

    return NextResponse.json({ retry: result.retry, attempt: result.attempt });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
