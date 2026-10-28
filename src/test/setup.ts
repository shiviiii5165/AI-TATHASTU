import path from "node:path";
import { config } from "dotenv";

// Explicitly load .env.test with override for isolated automated testing
config({ path: path.resolve(process.cwd(), ".env.test"), override: true });

// Fail-closed safeguard: refuse any test run against a live Neon database
const dbUrl = process.env.DATABASE_URL || "";
const workerDbUrl = process.env.WORKER_DATABASE_URL || "";

if (dbUrl.includes("neon.tech") || workerDbUrl.includes("neon.tech")) {
  throw new Error(
    "FAIL-CLOSED: DATABASE_URL or WORKER_DATABASE_URL targets a remote Neon database in tests! Automated test infrastructure must target a disposable local database (127.0.0.1)."
  );
}

// Fail-closed safeguard: refuse any test run against live Cloudflare R2
const r2Endpoint = process.env.R2_ENDPOINT || "";
const r2AccountId = process.env.R2_ACCOUNT_ID || "";
if (r2Endpoint.includes("cloudflarestorage.com") || (!r2Endpoint && r2AccountId && r2AccountId !== "e2e" && r2AccountId !== "test")) {
  throw new Error(
    "FAIL-CLOSED: Storage targets live Cloudflare R2 in tests! Automated tests must target isolated local storage or mock."
  );
}

// Safeguard external AI providers: clear keys so tests never use real provider quotas
delete process.env.GROQ_KEYS;
delete process.env.GEMINI_KEYS;
delete process.env.OPENROUTER_KEYS;
delete process.env.FIRECRAWL_KEYS;
delete process.env.APIFY_TOKENS;
delete process.env.RESEND_API_KEY;

