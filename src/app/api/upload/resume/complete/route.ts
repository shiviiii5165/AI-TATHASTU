import { NextResponse } from "next/server";

import { guarded } from "@/lib/api-guard";
import { getApiUserAtStep } from "@/lib/dal";
import { headObject, isR2Configured } from "@/lib/r2";
import { hitRateLimit } from "@/lib/rate-limit";
import { registerResume, resumeUploadSchema } from "@/lib/uploads/register";
import { hexToBase64, resumeStorageKey } from "@/lib/uploads/resume";

/**
 * Step 2 of the upload: the browser reports the PUT finished. Confirm the
 * object really is in R2 with the declared size, type and checksum, then
 * record the file and enqueue `resume_extract`.
 */
export const POST = guarded(async (request: Request) => {
  const authz = await getApiUserAtStep("resume");
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  if (!isR2Configured()) return NextResponse.json({ error: "Uploads aren't configured." }, { status: 503 });

  const parsed = resumeUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload details." }, { status: 422 });
  const upload = parsed.data;

  // Throttle completion polling per user to prevent S3 headObject resource exhaustion
  const limited = await hitRateLimit(`resume_complete:${authz.user.id}`, { limit: 60, windowSeconds: 3600 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many upload completion checks. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const object = await headObject(resumeStorageKey(authz.user.id, upload.sha256, upload.mime));
  if (!object) {
    return NextResponse.json({ error: "Your file didn't finish uploading. Try again." }, { status: 409 });
  }
  // R2 already enforced these via signed headers; this catches misconfiguration.
  const checksumMismatch = object.sha256Base64 !== null && object.sha256Base64 !== hexToBase64(upload.sha256);
  if (object.sizeBytes !== upload.sizeBytes || object.mime !== upload.mime || checksumMismatch) {
    return NextResponse.json({ error: "The uploaded file didn't match what we expected. Try again." }, { status: 422 });
  }

  const { jobId } = await registerResume(authz.user.id, upload);
  return NextResponse.json({ jobId }, { status: 201 });
});
