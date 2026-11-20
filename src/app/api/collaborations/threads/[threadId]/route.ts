import { connection } from "next/server";

import { guarded } from "@/lib/api-guard";
import { apiUser, readJson, respond } from "@/lib/collaborations/http";
import { blockFrom, getMessages, postMessage } from "@/lib/collaborations/service";

type Ctx = { params: Promise<{ threadId: string }> };

/** Messages of one conversation; access is re-checked from current memberships on every call. Opening it marks it read. */
export const GET = guarded(async (_request: Request, { params }: Ctx) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const { threadId } = await params;
  return respond<object>(await getMessages(a.user, threadId));
});

/** { body } sends a message; { block: true } lets an owner block the person behind an enquiry. */
export const POST = guarded(async (request: Request, { params }: Ctx) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const { threadId } = await params;
  const body = (await readJson(request)) as Record<string, unknown>;
  if (body?.block === true) return respond(await blockFrom(a.user, { threadId }));
  return respond(await postMessage(a.user, threadId, body), 201);
});
