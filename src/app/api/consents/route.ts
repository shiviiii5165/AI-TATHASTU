import { NextResponse } from "next/server";

import { guarded } from "@/lib/api-guard";
import { appendConsents, consentChoicesSchema } from "@/lib/consent/store";
import { getApiUserAtStep } from "@/lib/dal";
import { hitRateLimit } from "@/lib/rate-limit";

/** Saves the user's consent choices (append-only; unchanged answers add no rows). */
export const POST = guarded(async (request: Request) => {
  const authz = await getApiUserAtStep("review");
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  // Append-only rows: each changed answer is permanent storage.
  const limited = await hitRateLimit(`consents:${authz.user.id}`, { limit: 60, windowSeconds: 60 });
  if (!limited.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = consentChoicesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent choices." }, { status: 422 });

  const { appended, refused } = await appendConsents(authz.user.id, parsed.data);
  if (refused.length) return NextResponse.json({ error: "Too many requests.", appended, refused }, { status: 429 });
  return NextResponse.json({ ok: true, appended });
});
