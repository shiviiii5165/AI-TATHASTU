"use client";

import { useEffect, useState } from "react";

import type { JobView } from "@/lib/jobs";

const DELAYS_MS = [2_000, 4_000, 8_000, 10_000];
const TERMINAL = new Set<JobView["status"]>(["done", "failed", "needs_review"]);

export function isTerminal(status: JobView["status"]) {
  return TERMINAL.has(status);
}

/**
 * Polls /api/jobs/:id with exponential backoff (2 s → 4 → 8 → 10 s cap),
 * sending If-None-Match so unchanged responses come back as 304s. Paused while
 * the tab is hidden (checks at once when it's shown again). Stops at a
 * terminal status. Mount with key={jobId}: state is seeded once from `initial`.
 */
export function useJobPoll(jobId: string, initial: JobView) {
  const [job, setJob] = useState(initial);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (isTerminal(initial.status)) return;
    let attempt = 0;
    let etag: string | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let stopped = false; // terminal status or unrecoverable response

    const schedule = (ms = DELAYS_MS[Math.min(attempt++, DELAYS_MS.length - 1)]) => {
      clearTimeout(timer);
      if (!cancelled && !stopped && !document.hidden) timer = setTimeout(tick, ms);
    };

    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          cache: "no-store",
          headers: etag ? { "If-None-Match": etag } : {},
        });
        if (cancelled) return;
        if (res.status === 200) {
          etag = res.headers.get("ETag");
          const next = (await res.json()) as JobView;
          setJob(next);
          setOffline(false);
          if (isTerminal(next.status)) return void (stopped = true);
        } else if (res.status === 304) {
          setOffline(false);
        } else if (res.status === 401 || res.status === 404) {
          setOffline(true);
          return void (stopped = true); // Not recoverable by polling.
        } else {
          setOffline(true);
        }
      } catch {
        if (!cancelled) setOffline(true);
      }
      schedule();
    }

    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else schedule(0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [jobId, initial.status]);

  return { job, offline };
}
