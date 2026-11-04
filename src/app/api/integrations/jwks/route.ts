import { connection, NextResponse } from "next/server";

import { publicJwks } from "@/lib/integrations/tokens";

/**
 * Public keys for verifying integration access tokens (ES256). Safe to cache for an hour.
 *
 * `connection()` keeps this dynamic: with cacheComponents on, a handler that
 * only reads process.env is prerendered at build, freezing whatever key (or
 * the 503) the build environment had instead of the runtime signing key.
 */
export async function GET() {
  await connection();
  try {
    return NextResponse.json(await publicJwks(), {
      headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    // parseKeyConfig/keys() messages never contain key material.
    console.error("[jwks] integration signing key unavailable:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json(
      { keys: [], error: "signing_key_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
    );
  }
}
