// 36-attack matrix #11 Phishing / #12 Spear phishing / #15 Pretexting: can an attacker make AI Tathastu's own
// emails (trusted sender) carry their markup, links or forged headers? Executed through the real templates
// and the real contact handler; only the SMTP transport is captured.
import { describe, expect, it, vi } from "vitest";

const email = vi.hoisted(() => ({
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn<(message: unknown) => Promise<undefined>>(async () => undefined),
  senderAddress: vi.fn(() => "support@aitathastu.test"),
}));
vi.mock("@/lib/email", () => email);
vi.mock("@/db", async () => ({ db: await (await import("@/test/db")).createTestDb() }));

const { resumeFailedEmail, resumeReadyEmail, welcomeEmail } = await import("./templates");
const { POST } = await import("@/app/api/contact/route");

// Attacker-controlled: an OAuth display name and an uploaded file name.
const LURE = `<a href="https://evil.example/login">Verify your account</a><img src="https://evil.example/t.gif"><script>x()</script>`;
const HEADER = "Invoice\r\nBcc: victim@example.com\r\nReply-To: attacker@evil.example";

/** No live markup an attacker supplied: no tag, no evil href, no script. Escaped text is fine. */
function assertInert(html: string) {
  expect(html).not.toMatch(/<a [^>]*href="https:\/\/evil\.example/i);
  expect(html).not.toMatch(/<img [^>]*evil\.example/i);
  expect(html).not.toContain("<script>");
  expect(html).toMatch(/&lt;a href=|&#60;a href=/); // present, but as escaped text (named or numeric entity)
}

describe("trusted-sender emails never carry attacker markup", () => {
  it("templates escape names and file names", () => {
    for (const e of [
      welcomeEmail({ firstName: LURE }),
      resumeReadyEmail({ firstName: LURE, fileName: LURE, fieldCount: 3, reviewUrl: "https://www.aitathastu.com/profile" }),
      resumeFailedEmail({ firstName: LURE, fileName: LURE, uploadUrl: "https://www.aitathastu.com/profile" }),
    ]) {
      assertInert(e.html);
      expect(e.subject).not.toMatch(/[\r\n]/);
    }
  });

  it("contact form (pretexting channel to support) is escaped and cannot inject mail headers", async () => {
    email.sendEmail.mockClear();
    const res = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify({ name: `IT Helpdesk ${LURE}`.slice(0, 100), email: "attacker@evil.example", category: "support", subject: HEADER, message: `Please reset my admin access. ${LURE}`, consent: true }),
      }),
    );
    expect(res.status).toBe(200);
    const sent = email.sendEmail.mock.calls[0][0] as unknown as { to: string; email: { subject: string; html: string } };
    expect(sent.to, "only ever to the support inbox").toBe("support@aitathastu.test");
    expect(sent.email.subject).not.toMatch(/[\r\n]/);
    expect(sent.email.subject).not.toMatch(/\r?\nBcc:/i);
    assertInert(sent.email.html);
  });
});
