import "server-only";

import { randomUUID } from "node:crypto";

import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";

const SLOW_ROUTE_MS = 1_000;

/**
 * Wraps a route handler so an outage (usually the database) answers 503 with
 * Retry-After and a JSON body, which clients can act on, rather than Next's
 * empty 500. Nothing is reported as success. Every response carries X-Request-Id
 * (Vercel's id when present), and slow or failed requests log it with the route
 * and timing, so a user's report can be matched to a log line. Query strings are
 * left out: they can hold what people typed.
 */
export function guarded<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    const started = Date.now();
    const request = args[0] instanceof Request ? args[0] : null;
    const requestId = request?.headers.get("x-vercel-id") ?? randomUUID();
    const route = request ? `${request.method} ${new URL(request.url).pathname}` : "unknown";
    try {
      const response = await handler(...args);
      response.headers.set("X-Request-Id", requestId);
      const ms = Date.now() - started;
      if (ms >= SLOW_ROUTE_MS) console.warn(JSON.stringify({ event: "route_slow", route, ms, status: response.status, requestId }));
      return response;
    } catch (error) {
      unstable_rethrow(error); // Next's own control flow (dynamic rendering, redirects).
      console.error(JSON.stringify({ event: "route_failed", route, ms: Date.now() - started, kind: error instanceof Error ? error.name : "unknown", requestId }));
      return NextResponse.json(
        { error: "This is temporarily unavailable. Try again shortly.", requestId },
        { status: 503, headers: { "Retry-After": "30", "X-Request-Id": requestId } },
      );
    }
  };
}
