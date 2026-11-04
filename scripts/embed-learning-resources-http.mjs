import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

import { assertWriteAllowed } from "./lib/db-target.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (.env.local)");

const sql = neon(assertWriteAllowed(process.env.DATABASE_URL));
const geminiKeys = (process.env.GEMINI_KEYS || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  if (norm < 1e-9) return new Array(vec.length).fill(0);
  return vec.map((x) => Number((x / norm).toFixed(6)));
}

async function fetchGeminiEmbedding(text) {
  for (const key of geminiKeys) {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            content: { parts: [{ text: text.slice(0, 2000) }] },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const vals = data.embedding?.values;
        if (Array.isArray(vals) && vals.length === 768) {
          return normalize(vals);
        }
      }
    } catch {
      // try next key
    }
  }
  return null;
}

function computeDeterministicVector(title, provider, description, dim = 768) {
  const vec = new Array(dim).fill(0);
  const domainWeights = {
    ml: ["python", "pytorch", "tensorflow", "deep learning", "machine learning", "nlp", "llm", "cv", "transformers", "generative ai", "diffusion"],
    systems: ["c++", "rust", "cuda", "linux", "distributed systems", "concurrency", "operating systems", "gpu", "kernel"],
    data: ["sql", "pandas", "spark", "kafka", "analytics", "data science", "statistics", "data engineering"],
    cloud: ["docker", "kubernetes", "aws", "gcp", "devops", "ci/cd", "infrastructure", "mlops"],
    web: ["react", "typescript", "javascript", "node", "next.js", "frontend", "full stack"],
    research: ["scopus", "ieee", "arxiv", "paper", "grant", "evaluation", "benchmark", "alignment", "safety"],
  };

  const tokens = `${title} ${provider} ${description}`.toLowerCase().split(/\W+/).filter(Boolean);
  for (const token of tokens) {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const h = parseInt(hash.slice(0, 8), 16);
    const idx = h % dim;
    const sign = (h >> 4) % 2 === 0 ? 1.0 : -1.0;
    vec[idx] += sign * 1.0;

    let dIdx = 0;
    for (const keywords of Object.values(domainWeights)) {
      if (keywords.some((k) => token.includes(k) || k.includes(token))) {
        const targetSlot = (dIdx * 127 + (h % 31)) % dim;
        vec[targetSlot] += 2.0;
      }
      dIdx++;
    }
  }

  return normalize(vec);
}

async function main() {
  const rows = await sql`SELECT id, title, provider, description FROM learning_resources WHERE embedding IS NULL;`;
  console.log(`Found ${rows.length} learning resources needing embeddings.`);

  let updated = 0;
  for (const r of rows) {
    const text = `${r.title} by ${r.provider}. ${r.description || ""}`;
    let emb = await fetchGeminiEmbedding(text);
    if (!emb) {
      emb = computeDeterministicVector(r.title, r.provider, r.description || "");
    }
    const vecStr = `[${emb.join(",")}]`;
    await sql`UPDATE learning_resources SET embedding = ${vecStr}::vector WHERE id = ${r.id};`;
    updated++;
    if (updated % 10 === 0) {
      console.log(`Embedded ${updated}/${rows.length} resources...`);
    }
  }

  console.log(`Finished embedding all ${updated} learning resources in NeonDB!`);
}

main().catch(console.error);
