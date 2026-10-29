import type { ReactNode } from "react";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin";
import { getAdminContext } from "@/lib/admin/rbac";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection();
  const user = await requireAdmin();
  const ctx = await getAdminContext(user);

  return (
    <AdminShell
      userEmail={user.email || "admin@aitathastu.com"}
      userName={user.name}
      role={ctx?.role || "super_admin"}
    >
      {children}
    </AdminShell>
  );
}
