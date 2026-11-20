import { connection } from "next/server";

import { guarded } from "@/lib/api-guard";
import { apiUser, json, readJson, respond } from "@/lib/collaborations/http";
import { apply, changeStatus, endMembership, listMembers, sendEnquiry } from "@/lib/collaborations/service";

type Ctx = { params: Promise<{ id: string; action: string }> };

/**
 * Owner and participant actions on one collaboration, all signed-in:
 *  POST status   { action }       owner: publish | pause | resume | start | complete | close | reopen | renew
 *  POST apply    { role, intro, skills, motivation, links }
 *  POST enquiry  { body }          a short question before applying
 *  POST leave                      a member leaves the team
 *  POST remove   { memberId }      the owner removes a member
 *  GET  members                    roster, for members and the owner
 */
export const POST = guarded(async (request: Request, { params }: Ctx) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const { id, action } = await params;
  const body = (await readJson(request)) as Record<string, unknown>;
  switch (action) {
    case "status":
      return respond(await changeStatus(a.user, id, body?.action));
    case "apply":
      return respond(await apply(a.user, id, body), 201);
    case "enquiry":
      return respond(await sendEnquiry(a.user, id, body), 201);
    case "leave":
      return respond(await endMembership(a.user, id, null));
    case "remove":
      return typeof body?.memberId === "string" ? respond(await endMembership(a.user, id, body.memberId)) : json({ error: "Choose a member." }, { status: 400 });
    default:
      return json({ error: "Not found." }, { status: 404 });
  }
});

export const GET = guarded(async (_request: Request, { params }: Ctx) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const { id, action } = await params;
  if (action !== "members") return json({ error: "Not found." }, { status: 404 });
  return respond(await listMembers(a.user, id));
});
