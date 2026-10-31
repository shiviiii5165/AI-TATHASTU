import { NextResponse } from "next/server";

import { guarded } from "@/lib/api-guard";
import { getApiUserAtStep } from "@/lib/dal";
import { isR2Configured, presignResumeUpload } from "@/lib/r2";
import { hitRateLimit } from "@/lib/rate-limit";
import { findExistingResume, registerResume, resumeUploadSchema } from "@/lib/uploads/register";
import { hexToBase64, resumeStorageKey } from "@/lib/uploads/resume";

/**
 * Step 1 of the upload: returns a presigned R2 PUT URL bound to the file's
 * exact type, size and SHA-256. The bytes go browser → R2 directly and never
 * pass through this function. If the user already uploaded these bytes, skip
 * the upload and hand back the existing job.
 */
export const POST = guarded(async (request: Request) => {
  const authz = await getApiUserAtStep("resume");
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const parsed = resumeUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Use a PDF, DOCX, JPG, PNG, WebP or TXT file up to 10 MB." }, { status: 422 });
  }
  const upload = parsed.data;
  const userId = authz.user.id;

  // Each call can mint a storage write URL; cap it per user across all instances.
  const limited = await hitRateLimit(`resume_presign:${userId}`, { limit: 30, windowSeconds: 3600 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many upload attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  if (await findExistingResume(userId, upload.sha256)) {
    const { jobId } = await registerResume(userId, upload);
    return NextResponse.json({ duplicate: true, jobId });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "Resume uploads aren't switched on yet. Skip this step for now." }, { status: 503 });
  }

  const { url, headers } = await presignResumeUpload({
    key: resumeStorageKey(userId, upload.sha256, upload.mime),
    mime: upload.mime,
    sizeBytes: upload.sizeBytes,
    sha256Base64: hexToBase64(upload.sha256),
  });
  return NextResponse.json({ duplicate: false, upload: { url, method: "PUT", headers } });
});
