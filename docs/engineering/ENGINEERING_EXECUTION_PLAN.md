# Execution plan (in priority order)

1. **Owner:** review and commit the working tree. Apply the 0017 fix before any migration.
2. **Owner:** create a staging Neon branch, in or near the intended production region. Provide its URL and test keys.
3. Run on staging: migration chain, 0018, query plans, `load/journeys.js` from a separate machine at 100 → 250 → 500 → 1,000. Stop at the first level missing SLOs and fix that limit.
4. Measure India → Vercel → Neon latency. Decide regions from the data.
5. Verify live integrations one at a time using test accounts.
6. Evaluate AI and resume quality on a consented, labelled set of real resumes.
7. Write AI provider telemetry; add a unique index for hand-added facts; add an R2 lifecycle rule.
8. Product/legal decisions: age policy, role verification, retention, demo labelling, whether to build classroom.
9. Scale tests above 1,000 sessions with distributed generators, with cost approval.
