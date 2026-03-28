import { getMemoryEntries } from "@/src/server/memoryScanner";
import { subscribeToMemoryEvents } from "@/src/runtime/memory/eventsBus";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send initial snapshot
      const initial = getMemoryEntries({});
      controller.enqueue(
        encoder.encode(
          `event: snapshot\ndata: ${JSON.stringify({ entries: initial.entries, total: initial.total })}\n\n`,
        ),
      );

      // Subscribe to events
      const unsubscribe = subscribeToMemoryEvents((event) => {
        try {
          controller.enqueue(
            encoder.encode(`event: memory\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // client disconnected
        }
      });

      // Handle abort
      request.signal.addEventListener("abort", () => {
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
