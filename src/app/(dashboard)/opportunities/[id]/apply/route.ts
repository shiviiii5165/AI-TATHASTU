import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { getOpportunity, loadStudentSignals, recordInteraction } from "@/lib/opportunities/browse";
import type { OppDb } from "@/lib/opportunities/ingest";

/**
 * GET /opportunities/<id>/apply: records that the student opened the official application destination,
 * then sends them there. The destination is only ever one the source published (application link or the
 * official announcement); nothing is constructed. Email applications and listings without a verified
 * destination never redirect: the student is returned to the detail page, which explains how to apply.
 * AI Tathastu submits nothing.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(`/opportunities/${id}`)}`, request.url), 303);
  }
  const d = db as unknown as OppDb;
  const o = await getOpportunity(d, id, session.user.id, await loadStudentSignals(d, session.user.id));
  if (!o) return NextResponse.redirect(new URL("/opportunities?section=all", request.url), 303);
  const target = o.apply.kind === "portal" ? o.apply.url : o.apply.kind === "announcement" ? o.apply.url : null;
  if (!target) return NextResponse.redirect(new URL(`/opportunities/${id}#how-to-apply`, request.url), 303);
  let safe: URL;
  try {
    safe = new URL(target);
    if (safe.protocol !== "https:" && safe.protocol !== "http:") throw new Error("scheme");
  } catch {
    return NextResponse.redirect(new URL(`/opportunities/${id}#how-to-apply`, request.url), 303);
  }
  await recordInteraction(d, session.user.id, id, "opened_application").catch(() => undefined);
  return NextResponse.redirect(safe, 303);
}
