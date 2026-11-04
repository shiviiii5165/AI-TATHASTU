import { NextResponse, type NextRequest } from "next/server";

import { handlers } from "@/auth";
import { allowAuthAttempt } from "@/lib/auth/abuse";

// Reachable without our login form. Session and CSRF reads pass through: every page makes them.
const LIMITED = /\/api\/auth\/(signin|callback)(\/|$)/;

const limited = (handler: (request: NextRequest) => Promise<Response>) => async (request: NextRequest) => {
  if (LIMITED.test(new URL(request.url).pathname) && !(await allowAuthAttempt(request))) {
    return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429, headers: { "Retry-After": "900" } });
  }
  return handler(request);
};

export const GET = limited(handlers.GET);
export const POST = limited(handlers.POST);
