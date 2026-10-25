import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next_*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "test-screenshots/**",
    "playwright-report/**",
    // AppleDouble resource fork files:
    "**/._*",
    "._*",
    // Vendored agent skills and non-app tooling.
    ".claude/**",
    ".agents/**",
    ".taste-skill/**",
    "worker/**",
    "landing page*/**",
    "logo and app icon*/**",
    "public/**",
  ]),
]);

export default eslintConfig;
