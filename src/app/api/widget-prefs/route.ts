import { NextResponse } from "next/server";

import { guarded } from "@/lib/api-guard";
import { getApiOnboardedUser } from "@/lib/dal";
import { getWidgetPrefs, setWidgetPref, widgetPrefSchema } from "@/lib/dashboard/prefs";

/**
 * Same operation as the updateWidgetPref Server Action, for non-React callers
 * (module pages in other apps, tests). Body: { widgetId, dismissed?, pinned? }.
 */
export const POST = guarded(async (request: Request) => {
  const authz = await getApiOnboardedUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const parsed = widgetPrefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid widget preference." }, { status: 422 });

  await setWidgetPref(authz.user.id, parsed.data);
  return NextResponse.json({ ok: true });
});

export const GET = guarded(async () => {
  const authz = await getApiOnboardedUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const prefs = await getWidgetPrefs(authz.user.id);
  return NextResponse.json(
    { prefs: prefs.map(({ widgetId, dismissed, pinned, orderOverride }) => ({ widgetId, dismissed, pinned, orderOverride })) },
    { headers: { "Cache-Control": "private, no-cache" } },
  );
});
