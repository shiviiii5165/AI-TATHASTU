import { connection } from "next/server";

import { guarded } from "@/lib/api-guard";
import { apiUser, readJson, respond } from "@/lib/collaborations/http";
import { report } from "@/lib/collaborations/service";

/** Report a listing, message or conversation the reporter can see. Goes to the Admin OS moderation queue. */
export const POST = guarded(async (request: Request) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  return respond(await report(a.user, await readJson(request)), 201);
});
