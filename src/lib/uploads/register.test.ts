import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  wakeWorker: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/worker-ping", () => ({
  wakeWorker: mocks.wakeWorker,
}));

vi.mock("@/db", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
    update: mocks.update,
  },
}));

import { registerResume } from "./register";

describe("registerResume error and defensive handling (BUG-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const upload = {
    fileName: "resume.pdf",
    sizeBytes: 1024,
    mime: "application/pdf" as const,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  };

  it("throws a descriptive error when file insertion conflicts and existing file cannot be resolved", async () => {
    mocks.insert.mockReturnValueOnce({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [], // conflict: inserted is undefined
        }),
      }),
    });

    // findExistingResume query
    mocks.select.mockReturnValueOnce({
      from: () => ({
        where: async () => [], // existing file not found
      }),
    });

    await expect(registerResume("user-1", upload)).rejects.toThrow(
      "Failed to resolve file ID for resume upload: user-1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("throws a descriptive error when job insertion conflicts and existing job cannot be resolved", async () => {
    // files insert succeeds
    mocks.insert.mockReturnValueOnce({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [{ id: "file-123" }],
        }),
      }),
    });

    // jobs insert conflicts (returns empty array)
    mocks.insert.mockReturnValueOnce({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [],
        }),
      }),
    });

    // select existing jobs returns empty array
    mocks.select.mockReturnValueOnce({
      from: () => ({
        where: async () => [],
      }),
    });

    await expect(registerResume("user-1", upload)).rejects.toThrow(
      "Failed to resolve job ID for resume upload:"
    );
  });

  it("successfully resolves existing job on conflict without crashing on index access", async () => {
    // files insert succeeds
    mocks.insert.mockReturnValueOnce({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [{ id: "file-123" }],
        }),
      }),
    });

    // jobs insert conflicts (returns empty array)
    mocks.insert.mockReturnValueOnce({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [],
        }),
      }),
    });

    // select existing jobs returns existing job row
    mocks.select.mockReturnValueOnce({
      from: () => ({
        where: async () => [{ id: "existing-job-456" }],
      }),
    });

    // jobs update for retry
    mocks.update.mockReturnValueOnce({
      set: () => ({
        where: async () => [],
      }),
    });

    // onboardingState update
    mocks.update.mockReturnValueOnce({
      set: () => ({
        where: async () => [],
      }),
    });

    const result = await registerResume("user-1", upload);
    expect(result).toEqual({ jobId: "existing-job-456" });
    expect(mocks.wakeWorker).toHaveBeenCalledWith("resume_extract");
  });
});
