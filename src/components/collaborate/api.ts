import { useCallback, useEffect, useState } from "react";

// Client calls to /api/collaborations. Same-origin fetch, so the CSRF check (Sec-Fetch-Site) passes; every answer
// is normalised to { ok, data } or { ok: false, error, fields }.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; fields?: Record<string, string> };

export async function call<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, status: res.status, error: String(data.error ?? "Something went wrong. Try again."), fields: data.fields as Record<string, string> | undefined };
    return { ok: true, data: data as T };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return { ok: false, status: 0, error: "aborted" };
    return { ok: false, status: 0, error: "You seem to be offline. Check your connection and try again." };
  }
}

export const API = "/api/collaborations";

/**
 * GET `url` whenever it, `refreshKey` or reload() changes. State is only set in the response callback, and a
 * superseded request is aborted. A failed refresh keeps the last good data and reports the error alongside it.
 */
export function useApi<T>(url: string | null, refreshKey = 0) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    const ctl = new AbortController();
    void call<T>(url, { signal: ctl.signal }).then((r) => {
      if (ctl.signal.aborted) return;
      setState((prev) => (r.ok ? { data: r.data, error: null } : { data: prev.data, error: r.error }));
    });
    return () => ctl.abort();
  }, [url, refreshKey, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
