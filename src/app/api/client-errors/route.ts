import { NextResponse } from "next/server";

import { guarded } from "@/lib/api-guard";
import { recordRouteOutcome } from "@/lib/admin/monitoring";
import { clientIpHash, hitRateLimit } from "@/lib/rate-limit";

/**
 * Rendering failures seen in the browser (sent by app/error.tsx and app/global-error.tsx). Accepts only a path and
 * an error class/digest, never a message or stack, and stores them as counts in route_stats. Same-origin only
 * (guarded refuses cross-site writes).
 */
const PATH = /^\/[A-Za-z0-9/_\-.[\]]{0,180}$/;
const KIND = /^[A-Za-z0-9_ ()-]{1,80}$/;

// Anonymous endpoint and each new path is a new row: cap reports per client so nobody can flood route_stats.
const REPORT_LIMIT = { limit: 10, windowSeconds: 60 };

export const POST = guarded(async (request: Request) => {
  const limited = await hitRateLimit(`client-errors:${clientIpHash(request) ?? "unidentified"}`, REPORT_LIMIT);
  if (!limited.ok) return NextResponse.json({ error: "Too many reports." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  let body: { path?: unknown; kind?: unknown; digest?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const path = typeof body.path === "string" ? body.path.split("?")[0]! : "";
  const kind = typeof body.kind === "string" && KIND.test(body.kind) ? body.kind : "Error";
  const digest = typeof body.digest === "string" && /^[A-Za-z0-9]{1,40}$/.test(body.digest) ? body.digest : null;
  if (!PATH.test(path)) return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  await recordRouteOutcome({ route: `client GET ${path}`, ok: false, ms: 0, slow: false, error: digest ? `${kind} (digest ${digest})` : kind });
  return NextResponse.json({ ok: true });
});
