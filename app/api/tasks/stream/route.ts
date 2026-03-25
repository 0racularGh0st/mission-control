import { getTasks } from "@/src/runtime/tasks/store";
import { subscribeToTaskEvents, type TaskEvent } from "@/src/runtime/tasks/eventsBus";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const req = request;

      // Send initial snapshot: all current tasks
      const initialPayload = {
        type: "snapshot" as const,
        tasks: getTasks(),
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(
        encoder.encode(`event: snapshot\ndata: ${JSON.stringify(initialPayload)}\n\n`),
      );

      // Subscribe to task events and forward them as SSE events
      const unsubscribe = subscribeToTaskEvents((event: TaskEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // connection may already be closed
        }
      });

      req.signal.addEventListener("abort", () => {
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
