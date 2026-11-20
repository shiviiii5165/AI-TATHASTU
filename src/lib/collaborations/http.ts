import "server-only";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getApiOnboardedUser } from "@/lib/dal";

import type { Result } from "./service";

const NO_STORE = { "Cache-Control": "no-store" };

/** Signed-in, onboarded user for writes and private reads; 401/403 otherwise. */
export async function apiUser(): Promise<{ user: User } | { response: Response }> {
  const a = await getApiOnboardedUser();
  if (!a.ok) return { response: NextResponse.json({ error: a.status === 401 ? "Sign in to continue." : a.error }, { status: a.status, headers: NO_STORE }) };
  return { user: a.user };
}

/** The signed-in viewer's id for public reads, or null for visitors (never an error). */
export async function optionalViewerId(): Promise<string | null> {
  const id = (await auth())?.user?.id;
  if (!id) return null;
  const [u] = await db.select({ id: users.id, deletedAt: users.deletedAt }).from(users).where(eq(users.id, id));
  return u && !u.deletedAt ? u.id : null;
}

const MAX_BODY = 64 * 1024;

/** JSON body, capped in size. Anything unparsable is an empty object, which validation then rejects. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY) return { __tooLarge: true };
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function respond<T extends object>(result: Result<T>, okStatus = 200) {
  if (!result.ok) {
    const headers: Record<string, string> = { ...NO_STORE };
    if (result.status === 429) headers["Retry-After"] = "60";
    return NextResponse.json({ error: result.error, fields: result.fields }, { status: result.status, headers });
  }
  const rest: Record<string, unknown> = { ...result };
  delete rest.ok;
  return NextResponse.json(rest, { status: okStatus, headers: NO_STORE });
}

export const json = (body: unknown, init: ResponseInit = {}) => NextResponse.json(body, { ...init, headers: { ...NO_STORE, ...(init.headers ?? {}) } });
