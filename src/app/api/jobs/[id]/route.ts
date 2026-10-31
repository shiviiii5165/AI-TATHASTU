import { createHash } from "node:crypto";

import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { guarded } from "@/lib/api-guard";
import { getJobForUser } from "@/lib/dal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Job status for the polling client. ETag-gated: an unchanged status answers
 * 304 with no body, so a long poll costs one small query and no payload.
 */
export const GET = guarded(async (request: Request, { params }: RouteContext<"/api/jobs/[id]">) => {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const { id } = await params;
  const job = UUID.test(id) ? await getJobForUser(session.user.id, id) : null;
  if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = JSON.stringify(job);
  const etag = `W/"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };

  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(body, { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
});
