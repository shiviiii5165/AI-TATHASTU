// The E2E stack, started by playwright.config.ts before the app:
//  - a fresh in-memory Postgres (PGlite) with every migration applied, served
//    over TCP so the Next app (node-postgres) and the tests share it;
//  - a fake R2: accepts the browser's presigned PUT and answers the server's
//    HeadObject, so the real upload code runs end to end with no bucket. It
//    also serves a stand-in callback page for the integration (OAuth) tests.
// Plain Node (type stripping): `node e2e/support/stack.mts`.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export const DB_PORT = Number(process.env.E2E_DB_PORT ?? 55433);
export const R2_PORT = Number(process.env.E2E_R2_PORT ?? 9100);
// Must match INTEGRATION_COLLABORATE_WEBHOOK_SECRET in e2e/support/env.ts.
const WEBHOOK_SECRET = "e2e-collab-webhook-secret-0123456789abcdef";
const webhookEvents: unknown[] = [];

/** What an integrated app must do: HMAC over the raw body, 5-minute window. */
function verifySignature(raw: Buffer, header: string | undefined) {
  const m = header?.match(/^t=(\d+),v1=([0-9a-f]{64})$/);
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(`${m[1]}.`).update(raw).digest();
  return timingSafeEqual(Buffer.from(m[2], "hex"), expected);
}

async function startDatabase() {
  const db = await PGlite.create();
  const dir = path.resolve(import.meta.dirname, "../../src/db/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.startsWith("._")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("CREATE EXTENSION")) continue;

      const cleaned = trimmed
        .replace(/vector\(\d+\)/g, "real[]")
        .replace(/vector/g, "real[]")
        .replace(/USING hnsw \([^)]+\)/g, "")
        .replace(/vector_cosine_ops/g, "");

      try {
        await db.exec(cleaned);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("already exists") && !msg.includes("syntax error")) {
          throw err;
        }
      }
    }
  }
  try {
    await db.exec(`
      CREATE OR REPLACE FUNCTION cosine_distance(a real[], b real[]) RETURNS float AS $$
        SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE 0.0::float END;
      $$ LANGUAGE SQL IMMUTABLE;
      DO $$ BEGIN
        CREATE OPERATOR <=> (FUNCTION = cosine_distance, LEFTARG = real[], RIGHTARG = real[]);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  } catch {}

  const server = new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1", maxConnections: 16 });
  await server.start();
}

type StoredObject = { size: number; type: string; sha256: string };

function startFakeR2() {
  const objects = new Map<string, StoredObject>();
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "PUT, HEAD, GET",
    "Access-Control-Allow-Headers": "content-type, x-amz-checksum-sha256",
    "Access-Control-Expose-Headers": "ETag",
  };

  const server = createServer((req, res) => {
    const key = new URL(req.url ?? "/", "http://r2").pathname;
    if (key === "/health") return res.writeHead(200).end("ok");
    // Stands in for an integrated app's OAuth callback page (e2e/integrations.spec.ts).
    if (req.method === "GET" && key.endsWith("/callback")) {
      return res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>Callback</title><p>Signed in.</p>");
    }
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();

    // Stand-in for Collaborate's webhook receiver.
    if (key === "/collaborate/webhook" && req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        if (!verifySignature(raw, req.headers["x-ait-signature"] as string | undefined)) return res.writeHead(401).end("bad signature");
        webhookEvents.push({ delivery: req.headers["x-ait-delivery"], ...JSON.parse(raw.toString()) });
        res.writeHead(204).end();
      });
      return;
    }
    if (key === "/collaborate/webhook/events") {
      return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(webhookEvents));
    }

    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        const sha256 = createHash("sha256").update(body).digest("base64");
        // R2 rejects a body that doesn't match the signed checksum; so do we.
        if (req.headers["x-amz-checksum-sha256"] !== sha256) {
          return res.writeHead(400, cors).end("BadDigest");
        }
        objects.set(key, { size: body.length, type: String(req.headers["content-type"] ?? ""), sha256 });
        res.writeHead(200, { ...cors, ETag: `"${sha256}"` }).end();
      });
      return;
    }

    if (req.method === "HEAD") {
      const obj = objects.get(key);
      if (!obj) return res.writeHead(404).end();
      return res
        .writeHead(200, { "Content-Length": obj.size, "Content-Type": obj.type, "x-amz-checksum-sha256": obj.sha256 })
        .end();
    }
    res.writeHead(405, cors).end();
  });
  return new Promise<void>((resolve) => server.listen(R2_PORT, "127.0.0.1", resolve));
}

await startDatabase();
await startFakeR2();
console.log(`e2e stack: postgres on 127.0.0.1:${DB_PORT}, fake R2 on 127.0.0.1:${R2_PORT}`);
