// Environment for the app under test. These override .env.local (Next never
// replaces a variable that is already set), so the E2E app can't reach Neon,
// R2, the worker, SMTP or any OAuth provider even on a machine with real keys.

export const E2E_PORTS = {
  app: Number(process.env.E2E_APP_PORT ?? 3100),
  db: Number(process.env.E2E_DB_PORT ?? 55433),
  r2: Number(process.env.E2E_R2_PORT ?? 9100),
};

export const E2E_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${E2E_PORTS.db}/postgres`,
  AUTH_URL: `http://localhost:${E2E_PORTS.app}`,
  AUTH_TRUST_HOST: "true",
  AUTH_SECRET: "e2e-auth-secret-not-used-anywhere-else-0123456789",
  CONNECTOR_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
  EMBED_JWT_SECRET: "e2e-embed-secret-not-used-anywhere-else-012345",
  EMBED_ALLOWED_ORIGINS: "",
  R2_ENDPOINT: `http://127.0.0.1:${E2E_PORTS.r2}`,
  R2_ACCOUNT_ID: "e2e",
  R2_ACCESS_KEY_ID: "e2e",
  R2_SECRET_ACCESS_KEY: "e2e",
  R2_BUCKET: "resumes",
  WORKER_WAKE_URL: "",
  INTERNAL_API_SECRET: "e2e-internal-secret-not-used-anywhere-else-0123",
  // Test-only ES256 key (never used outside this throwaway stack).
  INTEGRATION_JWT_PRIVATE_KEY: '{"kty":"EC","x":"P2lczEssVeDagV8T9V4wQo2KCAMpU9xypCWaJq_epTc","y":"MNOW-K-brTxCiQUODyKajTkFIj1hUe_sUiaW2TFM98E","crv":"P-256","d":"deqDUeCdamrGPE6YHzYG_-JJPCyg8D-Ta5CE7TL0Uvw","kid":"e2e-test-key","alg":"ES256"}',
  INTEGRATION_COLLABORATE_CLIENT_SECRET: "e2e-collab-client-secret-0123456789",
  INTEGRATION_COLLABORATE_REDIRECT_URIS: `http://127.0.0.1:${E2E_PORTS.r2}/collaborate/callback`,
  // Received and signature-checked by e2e/support/stack.mts.
  INTEGRATION_COLLABORATE_WEBHOOK_URL: `http://127.0.0.1:${E2E_PORTS.r2}/collaborate/webhook`,
  INTEGRATION_COLLABORATE_WEBHOOK_SECRET: "e2e-collab-webhook-secret-0123456789abcdef",
  INTEGRATION_MEET_CLIENT_SECRET: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  LINKEDIN_CLIENT_ID: "",
  LINKEDIN_CLIENT_SECRET: "",
  // Admin access in the E2E stack (never the real admin address).
  ADMIN_EMAILS: "admin@e2e.test",
  // Throwaway key so admin MFA (enrollment, replay, brute-force limit) runs for real in E2E.
  // ADMIN_MFA_REQUIRED stays unset, so other admin tests are unaffected.
  ADMIN_MFA_SECRET: "e2e-admin-mfa-secret-not-used-anywhere-else-0123",
  ORCID_CLIENT_ID: "",
  ORCID_CLIENT_SECRET: "",
  GITHUB_CLIENT_ID: "",
  GITHUB_CLIENT_SECRET: "",
  RESEND_API_KEY: "",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
};
