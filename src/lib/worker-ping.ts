import "server-only";

import { after } from "next/server";

const TIMEOUT_MS = 10_000;

/**
 * Wakes the worker after a job is queued. On Render's free tier the worker
 * sleeps after ~15 min without HTTP traffic; any request wakes it (a cold
 * start takes up to about a minute), and it then drains the queue.
 *
 * Non-blocking: runs via after(), once the response has been sent (Vercel
 * keeps the function alive for it). The job is already safe in Postgres, so a
 * failed ping only delays processing until the next one. No-op without
 * WORKER_WAKE_URL. Call only from Server Actions / Route Handlers.
 */
/**
 * The worker only leaves its deep idle (which lets the database suspend) for an explicit wake:
 * "?wake=1" on the configured URL. A plain health check must not wake it.
 */
export function wakeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.set("wake", "1");
    return u.toString();
  } catch {
    return raw;
  }
}

export function wakeWorker(reason: string) {
  const url = process.env.WORKER_WAKE_URL;
  if (!url) return;
  after(async () => {
    try {
      // We only need the request to reach Render; don't wait out a cold start.
      await fetch(wakeUrl(url), { method: "GET", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      if (!(error instanceof Error && error.name === "TimeoutError")) {
        console.warn(`worker wake-up ping failed (${reason}):`, error);
      }
    }
  });
}
