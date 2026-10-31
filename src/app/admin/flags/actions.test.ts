import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireAdminPermission: vi.fn(),
  revalidatePath: vi.fn(),
  recordAdminAudit: vi.fn(),
  dbUpdate: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/admin/rbac", () => ({
  requireAdminPermission: mocks.requireAdminPermission,
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: mocks.recordAdminAudit,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

const mockWhere = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn(() => ({ where: mockWhere }));
vi.mock("@/db", () => ({
  db: {
    update: vi.fn(() => ({ set: mockSet })),
  },
}));

import { toggleFlagAction } from "./actions";

describe("Admin Feature Flags Server Action (toggleFlagAction)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when caller is not an authenticated administrator", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("Unauthorized: not an admin"));

    const formData = new FormData();
    formData.append("key", "test_flag");
    formData.append("enabled", "false");

    await expect(toggleFlagAction(formData)).rejects.toThrow("Unauthorized: not an admin");
    expect(mockSet).not.toHaveBeenCalled();
    expect(mocks.recordAdminAudit).not.toHaveBeenCalled();
  });

  it("fails closed when administrator lacks flags.manage permission", async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ id: "user-1", email: "restricted@admin.com" });
    mocks.requireAdminPermission.mockRejectedValueOnce(new Error("Forbidden: missing flags.manage"));

    const formData = new FormData();
    formData.append("key", "test_flag");
    formData.append("enabled", "false");

    await expect(toggleFlagAction(formData)).rejects.toThrow("Forbidden: missing flags.manage");
    expect(mockSet).not.toHaveBeenCalled();
    expect(mocks.recordAdminAudit).not.toHaveBeenCalled();
  });

  it("safely toggles flag and records audit log when caller has valid permissions", async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ id: "admin-1", email: "admin@aitathastu.com" });
    mocks.requireAdminPermission.mockResolvedValueOnce(undefined);

    const formData = new FormData();
    formData.append("key", "pilot_site_embed");
    formData.append("enabled", "false");

    await toggleFlagAction(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.requireAdminPermission).toHaveBeenCalledWith("flags.manage");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        updatedBy: "admin@aitathastu.com",
      })
    );
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: "admin@aitathastu.com",
        action: "flag.toggle",
        resource: "feature_flags",
        targetId: "pilot_site_embed",
        details: { previous: false, next: true },
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/flags");
  });
});
