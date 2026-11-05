import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.LINKEDIN_CLIENT_ID = "li-client";
process.env.LINKEDIN_CLIENT_SECRET = "li-secret";

const USER = "00000000-0000-4000-8000-00000000c0de";
const connectSource = vi.fn(async () => ({ connectionId: "conn-1" }));
const importLinkedInProfileFacts = vi.fn(async () => undefined);
const enqueueComputeIntelligence = vi.fn(async () => undefined);

vi.mock("@/lib/dal", () => ({ getApiUserAtStep: vi.fn(async () => ({ ok: true, user: { id: USER } })) }));
vi.mock("@/lib/connectors/crypto", () => ({ isConnectorCryptoConfigured: () => true }));
vi.mock("@/lib/connectors/connections", () => ({ connectSource }));
vi.mock("@/lib/connectors/linkedin", () => ({
  linkedinConfig: () => ({ clientId: "li-client", clientSecret: "li-secret" }),
  importLinkedInProfileFacts,
}));
vi.mock("@/lib/jobs-queue", () => ({ enqueueComputeIntelligence }));

const start = await import("@/app/api/connectors/linkedin/start/route");
const callback = await import("@/app/api/connectors/linkedin/callback/route");

const ORIGIN = "https://www.aitathastu.com";

async function begin(from = "") {
  const res = await start.GET(new NextRequest(`${ORIGIN}/api/connectors/linkedin/start${from}`));
  const loc = new URL(res.headers.get("location")!);
  const cookie = res.cookies.get("ait_li_oauth")!;
  return { res, loc, cookie, state: loc.searchParams.get("state")! };
}
function finish(query: string, cookieValue: string) {
  const req = new NextRequest(`${ORIGIN}/api/connectors/linkedin/callback?${query}`, { headers: { cookie: `ait_li_oauth=${cookieValue}` } });
  return callback.GET(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).startsWith("https://www.linkedin.com/oauth/v2/accessToken")) return Response.json({ access_token: "li-token" });
    if (String(url).startsWith("https://api.linkedin.com/v2/userinfo")) return Response.json({ sub: "li-sub-1", name: "Shivam K", email: "s@example.com", email_verified: true, picture: "https://media.licdn.com/p.jpg" });
    return new Response("not found", { status: 404 });
  }));
});

describe("LinkedIn connector flow (no Auth.js sign-in)", () => {
  it("start redirects to LinkedIn OIDC with a user-bound state cookie", async () => {
    const { loc, cookie, state } = await begin();
    expect(loc.origin + loc.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/connectors/linkedin/callback`);
    expect(loc.searchParams.get("scope")).toBe("openid profile email");
    expect(cookie.value).toBe(`${USER}.${state}.onboarding`);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe("/api/connectors/linkedin");
  });

  it("callback records the connection on the SIGNED-IN user and returns to the connector page", async () => {
    const { cookie, state } = await begin();
    const res = await finish(`code=abc&state=${state}`, cookie.value);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/onboarding/connect-sources?source=linkedin&connected=1`);
    expect(connectSource).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, sourceId: "linkedin", accessMethod: "oauth", syncKey: "li-sub-1" }));
    expect(importLinkedInProfileFacts).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, providerAccountId: "li-sub-1", email: "s@example.com" }));
    expect(enqueueComputeIntelligence).toHaveBeenCalled();
  });

  it("rejects a mismatched state (CSRF) and never stores anything", async () => {
    const { cookie } = await begin();
    const res = await finish("code=abc&state=forged", cookie.value);
    expect(res.headers.get("location")).toContain("source=linkedin&error=state");
    expect(connectSource).not.toHaveBeenCalled();
  });

  it("rejects a state cookie that belongs to another user", async () => {
    const { state } = await begin();
    const res = await finish(`code=abc&state=${state}`, `someone-else.${state}.onboarding`);
    expect(res.headers.get("location")).toContain("error=state");
  });

  it("maps a cancelled LinkedIn consent to error=denied", async () => {
    const { cookie, state } = await begin("?from=connections");
    const res = await finish(`error=user_cancelled_authorize&state=${state}`, cookie.value);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/connections?source=linkedin&error=denied`);
  });

  it("does not import an unverified LinkedIn email", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      String(url).includes("accessToken") ? Response.json({ access_token: "t" }) : Response.json({ sub: "li-2", name: "X", email: "x@example.com", email_verified: false }),
    ));
    const { cookie, state } = await begin();
    await finish(`code=abc&state=${state}`, cookie.value);
    expect(importLinkedInProfileFacts).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });
});
