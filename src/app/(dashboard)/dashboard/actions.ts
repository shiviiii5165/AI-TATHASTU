"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";

import type { SaveResult } from "@/app/onboarding/actions";
import { db } from "@/db";
import { connections } from "@/db/schema";
import { queueConnectorSync } from "@/lib/connectors/connections";
import { requireOnboardedUser } from "@/lib/dal";
import { setWidgetPref, widgetPrefSchema, type WidgetPrefInput } from "@/lib/dashboard/prefs";
import { wakeWorker } from "@/lib/worker-ping";

/** Dismiss / restore / pin / unpin a widget, then re-render the dashboard. */
export async function updateWidgetPref(input: WidgetPrefInput): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const parsed = widgetPrefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown widget." };
  await setWidgetPref(user.id, parsed.data);
  refresh();
  return { ok: true };
}

/** "Refresh" on a stale GitHub widget: queues a new sync for the user's connection. */
export async function refreshGithub(): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const [connection] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.userId, user.id), eq(connections.sourceId, "github")));
  if (!connection) return { ok: false, error: "GitHub isn't connected." };
  await queueConnectorSync(user.id, connection.id, "github", `manual:${randomUUID()}`);
  wakeWorker("connector_sync:github:manual");
  refresh();
  return { ok: true };
}
