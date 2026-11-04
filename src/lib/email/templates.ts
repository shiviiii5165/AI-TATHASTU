// Transactional email templates. Plain functions → { subject, html, text }:
// table layout and inline styles, because email clients ignore stylesheets,
// flexbox and web fonts. Every interpolated value goes through esc().
//
// Colours are the app's editorial-minimal tokens (src/app/globals.css),
// written as hex because email clients don't understand oklch().

export type Email = { subject: string; html: string; text: string };

const APP_URL = (process.env.AUTH_URL || "https://www.aitathastu.com").replace(/\/$/, "");
const SUPPORT_ADDRESS = "support.aitathastu@gmail.com";

const C = {
  paper: "#faf8f4",
  card: "#ffffff",
  ink: "#26211d",
  muted: "#5f5850",
  line: "#e7e2d9",
  brand: "#c2410c",
  surface: "#f3efe7",
};
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const appUrl = (path: string) => `${APP_URL}${path}`;
const greeting = (firstName: string | null | undefined) => `Hi ${firstName?.trim() || "there"},`;

type Block = { html: string; text: string };

const p = (body: string): Block => ({
  html: `<p style="margin:0 0 16px;font:16px/1.6 ${SANS};color:${C.ink}">${esc(body)}</p>`,
  text: body,
});

const button = (label: string, href: string): Block => ({
  html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr>
<td style="border-radius:8px;background:${C.ink}"><a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font:600 15px/1 ${SANS};color:${C.paper};text-decoration:none;border-radius:8px">${esc(label)}</a></td>
</tr></table>`,
  text: `${label}: ${href}`,
});

/** Quiet box for a detail (file name, error) the reader may want to scan for. */
const note = (label: string, value: string): Block => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr>
<td style="background:${C.surface};border-radius:8px;padding:12px 14px;font:14px/1.5 ${SANS};color:${C.ink}"><span style="display:block;font:600 11px/1.4 ${SANS};letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">${esc(label)}</span>${esc(value)}</td>
</tr></table>`,
  text: `${label}: ${value}`,
});

const small = (body: string): Block => ({
  html: `<p style="margin:0 0 12px;font:13px/1.6 ${SANS};color:${C.muted}">${esc(body)}</p>`,
  text: body,
});

function layout({ preheader, title, blocks, footer }: { preheader: string; title: string; blocks: Block[]; footer: string }) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:10px"><img src="${APP_URL}/brand/mark.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:7px"></td>
<td style="vertical-align:middle;font:22px/1 ${SERIF};color:${C.ink}">AI Tathastu<span style="color:${C.brand}">.</span></td>
</tr></table></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:32px 28px">
<h1 style="margin:0 0 20px;font:400 28px/1.2 ${SERIF};color:${C.ink}">${esc(title)}</h1>
${blocks.map((b) => b.html).join("\n")}
</td></tr>
<tr><td style="padding:20px 4px 0;font:12px/1.6 ${SANS};color:${C.muted}">${esc(footer)}<br>
Questions? Reply to this email or write to <a href="mailto:${SUPPORT_ADDRESS}" style="color:${C.muted}">${SUPPORT_ADDRESS}</a>.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [title, "", ...blocks.map((b) => b.text).flatMap((t) => [t, ""]), "--", footer, `Questions? Write to ${SUPPORT_ADDRESS}.`].join("\n");
  return { html, text };
}

// ─── Templates ──────────────────────────────────────────────────────────────

/** Auth: the magic sign-in link (sent by Auth.js via sendVerificationRequest). */
export function magicLinkEmail({ url }: { url: string }): Email {
  return {
    subject: "Sign in to AI Tathastu",
    ...layout({
      preheader: "Your sign-in link. It works once and expires in 30 minutes.",
      title: "Sign in to AI Tathastu",
      blocks: [
        p("Use the button below to sign in. The link works once and expires in 30 minutes."),
        button("Sign in", url),
        small("If the button doesn't work, copy this link into your browser:"),
        small(url),
      ],
      footer: "You're receiving this because someone asked to sign in with this address. If it wasn't you, ignore this email; nothing happens without the link.",
    }),
  };
}

/** System: an operator's second factor changed. Also sent to the other root operators, since a stolen mailbox can hide it from its owner. */
export function adminSecurityNoticeEmail({ account, event }: { account: string; event: string }): Email {
  return {
    subject: `Admin security: ${event}`,
    ...layout({
      preheader: `${event} on an AI Tathastu operator account.`,
      title: "Admin security notice",
      blocks: [
        p(`${event} on an operator account. If this wasn't expected, treat the account as compromised: revoke its sessions and remove its authenticator.`),
        note("Account", account),
      ],
      footer: "You're receiving this because you are an AI Tathastu operator.",
    }),
  };
}

/** System: sent once, when the account is created. */
export function welcomeEmail({ firstName }: { firstName?: string | null }): Email {
  return {
    subject: "Welcome to AI Tathastu",
    ...layout({
      preheader: "Six short steps and your dashboard is built around your goal.",
      title: "Welcome to AI Tathastu",
      blocks: [
        p(greeting(firstName)),
        p(
          "Tell us where you're headed in AI, add your resume and connect the places your work lives, like GitHub or LeetCode. We turn it into a skill profile, an interview-readiness score and a dashboard of what to do next.",
        ),
        p("It takes about five minutes, and your progress is saved at every step."),
        button("Start onboarding", appUrl("/onboarding")),
      ],
      footer: "You're receiving this because you created an AI Tathastu account.",
    }),
  };
}

/** System: the worker finished reading a resume (triggered via /api/internal/notify). */
export function resumeReadyEmail({ firstName, fileName, fieldCount, reviewUrl }: {
  firstName?: string | null;
  fileName?: string | null;
  fieldCount: number;
  reviewUrl: string;
}): Email {
  return {
    subject: "Your resume is ready to review",
    ...layout({
      preheader: `We found ${fieldCount} ${fieldCount === 1 ? "field" : "fields"}. Nothing is saved until you approve it.`,
      title: "Your resume is ready to review",
      blocks: [
        p(greeting(firstName)),
        p(
          `We've read your resume and found ${fieldCount} ${fieldCount === 1 ? "field" : "fields"}: education, experience, projects, skills and more. Nothing goes into your profile until you check it.`,
        ),
        ...(fileName ? [note("File", fileName)] : []),
        button("Review what we found", reviewUrl),
        small("The least certain fields are listed first, so the review is quick."),
      ],
      footer: "You're receiving this because you uploaded a resume to AI Tathastu.",
    }),
  };
}

/** System: extraction failed for good (unreadable file, or every retry failed). */
export function resumeFailedEmail({ firstName, fileName, uploadUrl }: {
  firstName?: string | null;
  fileName?: string | null;
  uploadUrl: string;
}): Email {
  return {
    subject: "We couldn't read your resume",
    ...layout({
      preheader: "Upload a text-based PDF or DOCX and we'll try again.",
      title: "We couldn't read your resume",
      blocks: [
        p(greeting(firstName)),
        p(
          "We weren't able to read the file you uploaded. This usually happens with scanned pages, photos, password-protected PDFs or files exported as images.",
        ),
        ...(fileName ? [note("File", fileName)] : []),
        p("A text-based PDF or a DOCX works best. You can also skip this step and add details by hand."),
        button("Upload again", uploadUrl),
      ],
      footer: "You're receiving this because you uploaded a resume to AI Tathastu.",
    }),
  };
}

/** Support: a connected source stopped working and only the user can fix it. */
export function connectorAttentionEmail({ firstName, sourceName, reason, manageUrl }: {
  firstName?: string | null;
  sourceName: string;
  reason: string;
  manageUrl: string;
}): Email {
  return {
    subject: `Your ${sourceName} connection needs attention`,
    ...layout({
      preheader: `${reason} Reconnect to keep your profile up to date.`,
      title: `Your ${sourceName} connection needs attention`,
      blocks: [
        p(greeting(firstName)),
        p(`We couldn't import from ${sourceName}, so your profile isn't picking up new work from it.`),
        note("What happened", reason),
        p("Reconnecting takes a few seconds. What we imported before stays on your profile until then."),
        button(`Reconnect ${sourceName}`, manageUrl),
      ],
      footer: `You're receiving this because you connected ${sourceName} to AI Tathastu.`,
    }),
  };
}
