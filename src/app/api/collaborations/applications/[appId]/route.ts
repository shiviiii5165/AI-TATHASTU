import { connection } from "next/server";

import { guarded } from "@/lib/api-guard";
import { apiUser, json, readJson, respond } from "@/lib/collaborations/http";
import { blockFrom, decide, withdraw } from "@/lib/collaborations/service";

type Ctx = { params: Promise<{ appId: string }> };

/** accept / reject / block: the post's owner. withdraw: the applicant. Everyone else gets 404. */
export const POST = guarded(async (request: Request, { params }: Ctx) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const { appId } = await params;
  const { action } = ((await readJson(request)) ?? {}) as { action?: string };
  if (action === "accept" || action === "reject") return respond(await decide(a.user, appId, action === "accept"));
  if (action === "withdraw") return respond(await withdraw(a.user, appId));
  if (action === "block") return respond(await blockFrom(a.user, { applicationId: appId }));
  return json({ error: "Unknown action." }, { status: 400 });
});
