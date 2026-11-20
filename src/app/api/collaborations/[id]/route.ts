import { connection } from "next/server";

import { guarded } from "@/lib/api-guard";
import { apiUser, json, optionalViewerId, readJson, respond } from "@/lib/collaborations/http";
import { deleteDraft, getOwnPostForEdit, getPostForViewer, updatePost } from "@/lib/collaborations/service";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** One collaboration. Public; signed-in viewers also get their own relationship to it. `?edit=1` returns the owner's editable copy. */
export const GET = guarded(async (request: Request, { params }: Ctx) => {
  await connection();
  const { id } = await params;
  const ip = clientIp(request);
  const limited = await hitRateLimit(`collab:read:${ip ?? "unverified"}`, { limit: ip ? 240 : 1200, windowSeconds: 60 });
  if (!limited.ok) return json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  if (new URL(request.url).searchParams.get("edit") === "1") {
    const a = await apiUser();
    if ("response" in a) return a.response;
    return respond(await getOwnPostForEdit(a.user, id));
  }
  return respond(await getPostForViewer(id, await optionalViewerId()));
});

export const PATCH = guarded(async (request: Request, { params }: Ctx) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const { id } = await params;
  const body = (await readJson(request)) as { post?: unknown };
  return respond(await updatePost(a.user, id, body?.post));
});

/** Only drafts are deleted; published collaborations are closed instead, so their history stays. */
export const DELETE = guarded(async (_request: Request, { params }: Ctx) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const { id } = await params;
  return respond(await deleteDraft(a.user, id));
});
