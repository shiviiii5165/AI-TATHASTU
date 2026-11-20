import { connection } from "next/server";

import { guarded } from "@/lib/api-guard";
import { apiUser, json } from "@/lib/collaborations/http";
import { counts, listInbox, listMine, listNotifications, listRequests, markNotificationsRead } from "@/lib/collaborations/service";

/** The signed-in user's own Collaborate data: ?view=mine | requests | inbox | counts | notifications. */
export const GET = guarded(async (request: Request) => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  const view = new URL(request.url).searchParams.get("view");
  switch (view) {
    case "mine":
      return json(await listMine(a.user));
    case "requests":
      return json(await listRequests(a.user));
    case "inbox":
      return json({ threads: await listInbox(a.user) });
    case "counts":
      return json(await counts(a.user));
    case "notifications":
      return json({ notifications: await listNotifications(a.user) });
    default:
      return json({ error: "Unknown view." }, { status: 400 });
  }
});

/** Marks every notification read. */
export const POST = guarded(async () => {
  await connection();
  const a = await apiUser();
  if ("response" in a) return a.response;
  await markNotificationsRead(a.user);
  return json({ ok: true });
});
