# AI quality and provider reliability

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

| Workflow | Provider path | Validation | Status |
|---|---|---|---|
| Resume, portfolio extraction | Groq → Gemini → OpenRouter | JSON schema; evidence quote checked | Unit only |
| Roadmap, repo scoring | Router, 15 s+ timeouts | Parsed output | Unit only |
| Embeddings | 8 s timeout (`collaboration.py`) | Stored vector | Not tested live |
| Yora | **No LLM**: rule-based | Answers from stored data (fixed §65) | Verified locally |

- Router has key rotation, breakers, and 429/503/401/404 handling (source). Consent is enforced before external calls (§16, tests).
- **Prompt injection:** evidence checks limit fabricated values, but a resume can still bias LLM output. Not red-teamed.
- **Latency, tokens, cost:** Not measured. `ai_provider_telemetry` has no writer, so the admin AI-ops page can't show real figures. Open P2.
- **Failure injection on a live worker:** Not tested; unit tests only.
