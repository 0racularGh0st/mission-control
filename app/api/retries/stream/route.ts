import { getRetries } from "@/src/server/retries";
import { subscribeToRetryEvents } from "@/src/runtime/retries/eventsBus";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      // Send initial snapshot: failed retries + count
      const initial = getRetries({ status: "failed" });
      const snapshot = {
        type: "snapshot" as const,
        retries: initial.retries,
        failedCount: initial.failedCount,
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(
        encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`),
      );

      const unsubscribe = subscribeToRetryEvents((event) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: retry\ndata: ${JSON.stringify(event)}\n\n`),
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
