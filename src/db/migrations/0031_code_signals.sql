-- Career Intelligence Engine v4: what a repository's own files show (dependency files, structure, README skills).
--
-- Written by worker/connectors/github.py (collect_signals) during a GitHub sync; read by
-- worker/intelligence/career_engine.py through intelligence/code_signals.py. Shape (version 1):
--   { "version": 1, "pushedAt": "...", "fetchedAt": "...", "private": false,
--     "manifests": { "requirements.txt": ["torch", "scikit-learn"] },
--     "structure": { "tests": true, "ci": true, "dockerfile": false, "kubernetes": false, "terraform": false, "notebooks": 2 },
--     "readme": { "present": true, "chars": 4210, "skills": ["Model Evaluation", "PyTorch"] },
--     "unavailable": "empty repository" (only when the files couldn't be read) }
-- Only parsed results are stored: package names, flags and the skill names a README mentions. README text is not.
--
-- Backward compatible: nullable, no default, no backfill. Code that predates it never reads it; the worker checks
-- for the column (information_schema) and behaves exactly as before while it's absent. Rows fill in on each user's
-- next GitHub sync. Rollback: ALTER TABLE code_repositories DROP COLUMN code_signals;
--
-- Registered in meta/_journal.json (idx 31) so the migration chain stays complete. NOT YET APPLIED anywhere: run it
-- with the normal migration process once approved.

ALTER TABLE "code_repositories" ADD COLUMN IF NOT EXISTS "code_signals" jsonb;
