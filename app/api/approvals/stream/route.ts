import { getApprovals } from "@/src/server/approvals";
import { subscribeToApprovalEvents } from "@/src/runtime/approvals/eventsBus";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      // Send initial snapshot: pending approvals + count
      const initial = getApprovals({ status: "pending" });
      const snapshot = {
        type: "snapshot" as const,
        approvals: initial.approvals,
        pendingCount: initial.pendingCount,
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(
        encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`),
      );

      const unsubscribe = subscribeToApprovalEvents((event) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: approval\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // connection may already be closed
        }
      });

      request.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
