import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
const r2 = vi.hoisted(() => ({
  deleteObject: vi.fn(async (_key: string) => {}),
  listObjectKeys: vi.fn(async (_prefix: string) => [] as string[]),
  isR2Configured: () => true,
  UPLOAD_URL_TTL_SECONDS: 300,
}));
vi.mock("@/lib/r2", () => r2);
const revokeGithubGrant = vi.hoisted(() => vi.fn(async (_token: string) => "revoked" as "revoked" | "already_invalid" | "failed"));
vi.mock("@/lib/connectors/github", () => ({ revokeGithubGrant }));

process.env.CONNECTOR_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.test/webhook";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "webhook-secret";

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { accountDeletions, adminAuditLogs, adminTeamMembers, connections, files, integrationConsents, jobs, sessions, supportTickets, users, webhookOutbox } = schema;
const { credentialAad, seal } = await import("@/lib/connectors/crypto");
const { executeStudentDeletionWorkflow } = await import("./students");
const { processAccountDeletion, processDueDeletions, ProtectedAccountError, requestAccountDeletion, retryAccountDeletionNow } = await import("@/lib/account-deletion");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fileKey = (userId: string) => `resumes/${userId}/abc.txt`;
let next = 100;

async function seedUser(extra: Partial<typeof users.$inferInsert> = {}) {
  const userId = id(next++);
  await db.insert(users).values({ id: userId, name: "Person", email: `${userId}@example.com`, ...extra });
  return userId;
}

async function seedAccount(extra: Partial<typeof users.$inferInsert> = {}) {
  const userId = await seedUser(extra);
  await db.insert(connections).values({ userId, sourceId: "kaggle", accessMethod: "api_key", tokenEnc: Buffer.from("sealed"), status: "connected" });
  await db.insert(sessions).values({ sessionToken: `s-${userId}`, userId, expires: new Date(Date.now() + 3600_000) });
  await db.insert(files).values({ userId, kind: "resume", storageKey: fileKey(userId), sha256: "abc", sizeBytes: 1, mime: "text/plain" });
  await db.insert(jobs).values({ type: "resume_extract", userId, idempotencyKey: `queued-${userId}`, payload: {} });
  return userId;
}

async function addGithub(userId: string) {
  const tokenEnc = seal({ access_token: "ghs_secret_value" }, credentialAad(userId, "github"));
  await db.insert(connections).values({ userId, sourceId: "github", accessMethod: "oauth", tokenEnc, status: "connected" });
}

const stateOf = async (userId: string) => (await db.select().from(accountDeletions).where(eq(accountDeletions.userId, userId)))[0];
const makeDue = (userId: string) => db.update(accountDeletions).set({ nextAttemptAt: new Date(Date.now() - 1000), sweepAfter: new Date(Date.now() - 1000), lockedUntil: null }).where(eq(accountDeletions.userId, userId));

beforeAll(() => {
  vi.stubEnv("ADMIN_EMAILS", "listed-operator@example.com");
});

beforeEach(() => {
  r2.deleteObject.mockReset();
  r2.deleteObject.mockImplementation(async () => {});
  r2.listObjectKeys.mockReset();
  r2.listObjectKeys.mockImplementation(async () => []);
  revokeGithubGrant.mockReset();
  revokeGithubGrant.mockImplementation(async () => "revoked");
});

afterEach(() => vi.restoreAllMocks());

describe("a storage failure", () => {
  it("leaves the account locked with processing stopped, and reports progress instead of throwing", async () => {
    const userId = await seedAccount();
    r2.deleteObject.mockRejectedValueOnce(new Error("R2 down"));

    const result = await executeStudentDeletionWorkflow(userId, "admin@example.com", "requested by the user");
    expect(result.message).toContain("will retry");

    const [tombstone] = await db.select().from(users).where(eq(users.id, userId));
    expect(tombstone.deletedAt).toBeInstanceOf(Date);
    expect(tombstone.sessionVersion).toBe(1);
    expect(await db.select().from(connections).where(eq(connections.userId, userId))).toEqual([]);
    expect(await db.select().from(files).where(eq(files.userId, userId))).toHaveLength(1);
    const [job] = await db.select().from(jobs).where(eq(jobs.userId, userId));
    expect(job).toMatchObject({ status: "failed", lastError: "Account deleted" });
    expect(await stateOf(userId)).toMatchObject({ status: "partially_failed", lastError: "Error", attempts: 1 });
    expect((await stateOf(userId)).nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("is finished by the cron without the person signing in, for that user only", async () => {
    const kept = await seedAccount();
    const userId = await seedAccount();
    await db.insert(supportTickets).values({ ticketNumber: `T-${userId}`, requesterId: userId, requesterEmail: `${userId}@EXAMPLE.com`, subject: "Help", category: "general" });
    r2.deleteObject.mockRejectedValueOnce(new Error("R2 down"));
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    await processAccountDeletion(userId);
    r2.deleteObject.mockClear();

    await makeDue(userId);
    await processDueDeletions();

    expect(r2.deleteObject.mock.calls).toEqual([[fileKey(userId)]]);
    expect(await db.select().from(users).where(eq(users.id, userId))).toEqual([]);
    expect(await db.select().from(files).where(eq(files.userId, userId))).toEqual([]);
    expect(await db.select().from(jobs).where(eq(jobs.userId, userId))).toEqual([]);
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.ticketNumber, `T-${userId}`));
    expect(ticket.requesterEmail).not.toContain(userId);
    expect(ticket.requesterId).toBeNull();
    expect(await stateOf(userId)).toMatchObject({ status: "completed", lastError: null });

    const [keptUser] = await db.select().from(users).where(eq(users.id, kept));
    expect(keptUser.deletedAt).toBeNull();
    expect(await db.select().from(connections).where(eq(connections.userId, kept))).toHaveLength(1);
    expect(await db.select().from(sessions).where(eq(sessions.userId, kept))).toHaveLength(1);
    expect(await db.select().from(files).where(eq(files.userId, kept))).toHaveLength(1);
    expect((await db.select().from(jobs).where(eq(jobs.userId, kept)))[0].status).toBe("queued");
  });
});

describe("crash recovery and concurrency", () => {
  it("resumes after a crash once the lease expires, and not before", async () => {
    const userId = await seedAccount();
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    // A process that died mid-run leaves this.
    await db.update(accountDeletions).set({ status: "processing", lockedUntil: new Date(Date.now() + 60_000) }).where(eq(accountDeletions.userId, userId));
    expect(await processAccountDeletion(userId)).toBeNull();
    await db.update(accountDeletions).set({ lockedUntil: new Date(Date.now() - 1000) }).where(eq(accountDeletions.userId, userId));
    expect((await processAccountDeletion(userId))?.dataDeleted).toBe(true);
  });

  it("lets only one of two simultaneous runs work, and audits once", async () => {
    const userId = await seedAccount();
    await Promise.all([
      requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" }),
      requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" }),
    ]);
    const runs = await Promise.all([processAccountDeletion(userId), processAccountDeletion(userId)]);
    expect(runs.filter(Boolean)).toHaveLength(1);

    const audits = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.targetId, userId));
    expect(audits.filter((a) => a.action === "account.self_delete")).toHaveLength(1);
    expect(audits.filter((a) => a.action === "account.deletion_data_removed")).toHaveLength(1);
  });

  it("records the audit entry with the request, holding no address", async () => {
    const userId = await seedAccount();
    await requestAccountDeletion(userId, { requestedBy: "admin", actorEmail: "admin@example.com", action: "student.delete_workflow", details: { reason: "asked" } });
    const [audit] = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.targetId, userId));
    expect(audit.details).toEqual({ reason: "asked" });
    expect(JSON.stringify(audit)).not.toContain(`${userId}@example.com`);
  });
});

describe("operator protection", () => {
  const request = (userId: string) => requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
  const expectUntouched = async (userId: string) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.deletedAt).toBeNull();
    expect(user.sessionVersion).toBe(0);
    expect(await stateOf(userId)).toBeUndefined();
    expect((await db.select().from(jobs).where(eq(jobs.userId, userId)))[0].status).toBe("queued");
    expect(await db.select().from(connections).where(eq(connections.userId, userId))).toHaveLength(1);
  };

  it("refuses is_admin", async () => {
    const userId = await seedAccount({ isAdmin: true });
    await expect(request(userId)).rejects.toBeInstanceOf(ProtectedAccountError);
    await expectUntouched(userId);
  });

  it("refuses an operator named only in ADMIN_EMAILS, whatever the flag says and however it's cased", async () => {
    const userId = await seedAccount({ isAdmin: false, email: "Listed-Operator@Example.com" });
    await expect(request(userId)).rejects.toBeInstanceOf(ProtectedAccountError);
    await expectUntouched(userId);
    await expect(executeStudentDeletionWorkflow(userId, "admin@example.com", "x")).rejects.toBeInstanceOf(ProtectedAccountError);
  });

  it("refuses an active team member, and allows a deactivated one", async () => {
    const active = await seedAccount();
    await db.insert(adminTeamMembers).values({ userId: active, role: "support_agent", isActive: true });
    await expect(request(active)).rejects.toBeInstanceOf(ProtectedAccountError);
    await expectUntouched(active);

    const former = await seedAccount();
    await db.insert(adminTeamMembers).values({ userId: former, role: "support_agent", isActive: false });
    await expect(request(former)).resolves.toBeUndefined();
  });

  it("reads the flag in the statement, so a promotion just before can't slip through", async () => {
    const userId = await seedAccount();
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
    await expect(request(userId)).rejects.toBeInstanceOf(ProtectedAccountError);
    await expectUntouched(userId);
  });
});

describe("jobs", () => {
  it("cancels running jobs too, clearing the lock that fences the worker's writes", async () => {
    const userId = await seedUser();
    await db.insert(jobs).values({ type: "compute_intelligence", userId, idempotencyKey: `running-${userId}`, status: "running", lockedBy: "worker-1", lockedUntil: new Date(Date.now() + 60_000) });
    await db.insert(jobs).values({ type: "compute_intelligence", userId, idempotencyKey: `done-${userId}`, status: "done" });
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });

    const rows = await db.select().from(jobs).where(eq(jobs.userId, userId));
    expect(rows.find((j) => j.status === "failed")).toMatchObject({ lockedBy: null, lockedUntil: null, lastError: "Account deleted" });
    expect(rows.find((j) => j.idempotencyKey === `done-${userId}`)?.status).toBe("done");
  });

  it("can't have data recreated once the users row is gone", async () => {
    const userId = await seedUser();
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    await processAccountDeletion(userId);
    await expect(db.insert(jobs).values({ type: "compute_intelligence", userId, idempotencyKey: `late-${userId}` })).rejects.toThrow();
    await expect(db.insert(files).values({ userId, kind: "resume", storageKey: "x", sha256: "y", sizeBytes: 1, mime: "text/plain" })).rejects.toThrow();
  });
});

describe("uploads racing the deletion", () => {
  it("deletes objects that were never registered, by listing that user's prefix only", async () => {
    const userId = await seedUser();
    r2.listObjectKeys.mockImplementation(async () => [`resumes/${userId}/orphan.pdf`]);
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    await processAccountDeletion(userId);
    expect(r2.listObjectKeys).toHaveBeenCalledWith(`resumes/${userId}/`);
    expect(r2.deleteObject).toHaveBeenCalledWith(`resumes/${userId}/orphan.pdf`);
  });

  it("stays open until issued URLs expire, then sweeps a late upload and completes", async () => {
    const userId = await seedUser();
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    const first = await processAccountDeletion(userId);
    expect(first).toMatchObject({ dataDeleted: true, status: "pending" });
    const waiting = await stateOf(userId);
    expect(waiting.nextAttemptAt.getTime()).toBe(waiting.sweepAfter.getTime());
    expect(waiting.sweptAt).toBeNull();

    r2.listObjectKeys.mockImplementation(async () => [`resumes/${userId}/late.pdf`]);
    await makeDue(userId);
    expect((await processAccountDeletion(userId))?.status).toBe("completed");
    expect(r2.deleteObject).toHaveBeenCalledWith(`resumes/${userId}/late.pdf`);
  });

  it("refuses a malformed id rather than listing a wider prefix", async () => {
    const badId = "not-a-uuid";
    await expect(requestAccountDeletion(badId, { requestedBy: "self", actorEmail: "x", action: "y" })).rejects.toThrow();
    expect(r2.listObjectKeys).not.toHaveBeenCalled();
  });
});

describe("GitHub revocation", () => {
  it("keeps the sealed token for a retry, separate from the data, then drops it on success", async () => {
    const userId = await seedUser();
    await addGithub(userId);
    revokeGithubGrant.mockImplementationOnce(async () => "failed");
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    const first = await processAccountDeletion(userId);

    expect(first?.dataDeleted).toBe(true); // A GitHub outage doesn't keep anyone's data.
    expect(await db.select().from(users).where(eq(users.id, userId))).toEqual([]);
    expect((await stateOf(userId)).githubTokenEnc).not.toBeNull();

    await makeDue(userId);
    expect((await processAccountDeletion(userId))?.status).toBe("completed");
    expect(await stateOf(userId)).toMatchObject({ githubTokenEnc: null, githubOutcome: "revoked" });
    expect(revokeGithubGrant).toHaveBeenLastCalledWith("ghs_secret_value");
  });

  it("treats a grant GitHub no longer knows as finished", async () => {
    const userId = await seedUser();
    await addGithub(userId);
    revokeGithubGrant.mockImplementationOnce(async () => "already_invalid");
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    await processAccountDeletion(userId);
    expect(await stateOf(userId)).toMatchObject({ githubTokenEnc: null, githubOutcome: "already_invalid" });
  });

  it("gives up after its retries, deletes the credential and says so, without logging the token", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const userId = await seedUser();
    await addGithub(userId);
    revokeGithubGrant.mockImplementation(async () => "failed");
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    for (let i = 0; i < 5; i++) {
      await makeDue(userId);
      await processAccountDeletion(userId);
    }
    expect(revokeGithubGrant).toHaveBeenCalledTimes(5);
    expect(await stateOf(userId)).toMatchObject({ githubTokenEnc: null, githubOutcome: "abandoned", status: "completed" });
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).toContain("account_deletion_github_abandoned");
    expect(logged).not.toContain("ghs_secret_value");
  });
});

describe("linked apps", () => {
  it("queues integration.revoked, which survives the users row, and drops pending profile updates", async () => {
    const userId = await seedUser();
    await db.insert(integrationConsents).values({ userId, clientId: "collaborate", scopes: {}, hiddenProjects: [], linkedAt: new Date() });
    await db.insert(webhookOutbox).values({ clientId: "collaborate", userId, event: "profile.updated", reason: "x" });
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    await processAccountDeletion(userId);

    const rows = await db.select().from(webhookOutbox).where(eq(webhookOutbox.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: "integration.revoked", reason: "account_deleted", status: "pending" });
  });

  it("says which linked apps have no webhook, rather than claiming they were told", async () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const userId = await seedUser();
    await db.insert(integrationConsents).values({ userId, clientId: "meet", scopes: {}, hiddenProjects: [], linkedAt: new Date() });
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    await processAccountDeletion(userId);
    expect(await db.select().from(webhookOutbox).where(eq(webhookOutbox.userId, userId))).toEqual([]);
    expect(JSON.stringify(warnings.mock.calls)).toContain("account_deletion_no_webhook");
  });
});

describe("failure handling", () => {
  it("backs off and alerts on repeated failure, logging the type and not the storage key", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const userId = await seedAccount();
    r2.deleteObject.mockImplementation(async (key: string) => {
      throw new Error(`can't delete ${key}`);
    });
    await requestAccountDeletion(userId, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
    let previous = 0;
    for (let i = 0; i < 3; i++) {
      await makeDue(userId);
      await processAccountDeletion(userId);
      const wait = (await stateOf(userId)).nextAttemptAt.getTime() - Date.now();
      expect(wait).toBeGreaterThan(previous);
      previous = wait;
    }
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).toContain("account_deletion_stuck");
    expect(logged).not.toContain(fileKey(userId));
    expect((await stateOf(userId)).lastError).toBe("Error");
  });

  it("lets an operator run a retry now, including for a pre-existing soft delete", async () => {
    const userId = await seedAccount({ deletedAt: new Date(Date.now() - 86_400_000) });
    r2.deleteObject.mockRejectedValueOnce(new Error("R2 down"));
    await executeStudentDeletionWorkflow(userId, "admin@example.com", "old soft delete");
    await retryAccountDeletionNow(userId);
    await executeStudentDeletionWorkflow(userId, "admin@example.com", "old soft delete").catch(() => {});
    expect(await db.select().from(users).where(eq(users.id, userId))).toEqual([]);
  });

  it("only the first request records an entry, across an operator's retries", async () => {
    const userId = await seedAccount();
    r2.deleteObject.mockRejectedValueOnce(new Error("R2 down"));
    await executeStudentDeletionWorkflow(userId, "admin@example.com", "first");
    await executeStudentDeletionWorkflow(userId, "admin@example.com", "second");
    const { rows } = await db.execute(sql`SELECT count(*)::int AS n FROM admin_audit_logs WHERE target_id = ${userId} AND action = 'student.delete_workflow'`);
    expect((rows[0] as { n: number }).n).toBe(1);
  });
});
