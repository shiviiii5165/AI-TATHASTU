// fetch for the Neon HTTP driver, which sets no deadline of its own: without one,
// a stalled database holds the request open until the platform kills the function.
// Long enough to ride out a Neon compute wake-up. Logs timings only, never SQL or params.

const timeoutMs = () => Number(process.env.DB_QUERY_TIMEOUT_MS) || 20_000;
const SLOW_QUERY_MS = 1_000;

export async function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const started = Date.now();
  const timeout = AbortSignal.timeout(timeoutMs());
  try {
    const response = await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
    const ms = Date.now() - started;
    if (ms >= SLOW_QUERY_MS) console.warn("db slow query", { ms, status: response.status });
    return response;
  } catch (error) {
    console.error("db request failed", { ms: Date.now() - started, kind: error instanceof Error ? error.name : "unknown" });
    throw error;
  }
}
