import { connection } from "next/server";

import { guarded } from "@/lib/api-guard";
import { apiUser, json, readJson, respond } from "@/lib/collaborations/http";
import { createPost, listPublic } from "@/lib/collaborations/service";
import { listQuery } from "@/lib/collaborations/validation";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

/** Discover: public, no sign-in. Returns only the public projection of each listing (lib/collaborations/public.ts). */
export const GET = guarded(async (request: Request) => {
  await connection();
  const ip = clientIp(request);
  const limited = await hitRateLimit(`collab:list:${ip ?? "unverified"}`, { limit: ip ? 120 : 600, windowSeconds: 60 });
  if (!limited.ok) return json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = listQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return json({ error: "Invalid filters." }, { status: 400 });
  return json(await listPublic(parsed.data));
});

/** Create a collaboration: a draft, or published at once (`publish: true`). */
export const POST = guarded(async (request: Request) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const body = (await readJson(request)) as { publish?: unknown; post?: unknown };
  return respond(await createPost(a.user, body?.post, body?.publish === true), 201);
});
