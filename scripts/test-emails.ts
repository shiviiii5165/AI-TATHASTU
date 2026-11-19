// Sends a preview of every email template, from its real sender profile.
//
//   npx tsx scripts/test-emails.ts [to]      (default 720anant@gmail.com)
//   npm run email:test -- [to]
//
// Uses the SMTP_* credentials in .env.local (or the environment). Exits 1 if
// any send fails. Links point at the real app but use sample data.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  // Imported after dotenv so the templates see AUTH_URL and the sender sees SMTP_*.
  const { sendEmail, isEmailConfigured, senderAddress } = await import("../src/lib/email");
  const t = await import("../src/lib/email/templates");

  const to = process.argv[2] ?? "720anant@gmail.com";
  const previews = [
    { profile: "system", email: t.welcomeEmail({ firstName: "Anant" }) },
    {
      profile: "system",
      email: t.resumeReadyEmail({ firstName: "Anant", fileName: "anant-kumar-resume.pdf", fieldCount: 42, reviewUrl: t.appUrl("/onboarding/resume/review") }),
    },
    { profile: "system", email: t.resumeFailedEmail({ firstName: "Anant", fileName: "scan-0042.pdf", uploadUrl: t.appUrl("/onboarding/resume") }) },
    {
      profile: "support",
      email: t.connectorAttentionEmail({
        firstName: "Anant",
        sourceName: "GitHub",
        reason: "GitHub access was revoked or has expired.",
        manageUrl: t.appUrl("/connections"),
      }),
    },
  ] as const;

  let failed = 0;
  for (const { profile, email } of previews) {
    const label = `${email.subject} (${profile})`.padEnd(58);
    if (!isEmailConfigured(profile)) {
      console.log(`SKIP  ${label} profile not configured`);
      failed++;
      continue;
    }
    try {
      const { messageId } = await sendEmail({ profile, to, email: { ...email, subject: `[Preview] ${email.subject}` } });
      console.log(`SENT  ${label} from ${senderAddress(profile)}  ${messageId}`);
    } catch (error) {
      console.log(`FAIL  ${label} ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }
  console.log(failed ? `${failed} of ${previews.length} failed.` : `All ${previews.length} previews sent to ${to}.`);
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code));
