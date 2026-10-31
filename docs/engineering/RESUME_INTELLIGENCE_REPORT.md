# Resume intelligence

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

**No field-level accuracy figure is reported, because none has been measured on labelled real resumes.** Inventing one would be worse than having none.

| Check | Status |
|---|---|
| `pytest worker/tests` covers fixtures, Unicode names, zip bombs, page and image limits | Verified locally (119 passed) |
| Failed job retried by re-uploading the same file | **Fixed**, Verified locally |
| Duplicate upload converges on one file and job | Verified locally |
| Evidence quote required for LLM fields | Unit tested |
| Scanned PDF, image OCR | Not tested (Tesseract not installed) |
| Live LLM extraction quality | Not tested (no provider calls) |
| Real R2 upload, large file, aborted upload | Not tested (fake R2 in E2E) |
| R2 unavailable at the API | Returns 503 by route guard; not fault-injected |

**To measure accuracy:** 30–50 consented resumes across layouts, hand-labelled per field, scored for precision and recall by field. Needs real documents and the owner's consent process.
