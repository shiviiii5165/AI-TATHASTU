import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { assertWriteAllowed } from "./scripts/lib/db-target.mjs";

config({ path: [".env.local", ".env"] });

// generate works from the schema alone; migrate and push change a database.
if (process.argv.some((arg) => arg === "migrate" || arg === "push" || arg === "drop")) assertWriteAllowed(process.env.DATABASE_URL);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
