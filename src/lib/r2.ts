import "server-only";

import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const UPLOAD_URL_TTL_SECONDS = 5 * 60;

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2Configured() {
  return config() !== null;
}

let client: { s3: S3Client; bucket: string } | null = null;

function r2() {
  if (client) return client;
  const c = config();
  if (!c) throw new Error("R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  client = {
    bucket: c.bucket,
    s3: new S3Client({
      region: "auto",
      // R2_ENDPOINT points at an S3-compatible stand-in (the E2E fake, MinIO).
      endpoint: process.env.R2_ENDPOINT || `https://${c.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: Boolean(process.env.R2_ENDPOINT),
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      // The SDK's default flexible checksums add CRC32 headers that a browser
      // PUT can't reproduce; we sign an explicit SHA-256 instead.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  return client;
}

/**
 * Presigned PUT that only accepts these exact bytes: content-type, length and
 * SHA-256 are signed headers, so R2 rejects anything else.
 */
export async function presignResumeUpload(input: {
  key: string;
  mime: string;
  sizeBytes: number;
  sha256Base64: string;
}) {
  const { s3, bucket } = r2();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.mime,
    ContentLength: input.sizeBytes,
    ChecksumSHA256: input.sha256Base64,
  });
  const url = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    // Keep these as headers (not query params) so the browser must send them.
    unhoistableHeaders: new Set(["x-amz-checksum-sha256"]),
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  return {
    url,
    headers: { "Content-Type": input.mime, "x-amz-checksum-sha256": input.sha256Base64 },
  };
}

/** Succeeds whether or not the object still exists, so a deletion can be retried. */
export async function deleteObject(key: string) {
  const { s3, bucket } = r2();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Every key under a prefix, including uploads that were never registered in `files`. */
export async function listObjectKeys(prefix: string) {
  const { s3, bucket } = r2();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Returns null when the object doesn't exist. */
export async function headObject(key: string) {
  const { s3, bucket } = r2();
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key, ChecksumMode: "ENABLED" }));
    return { sizeBytes: res.ContentLength ?? 0, mime: res.ContentType ?? "", sha256Base64: res.ChecksumSHA256 ?? null };
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return null;
    throw error;
  }
}
