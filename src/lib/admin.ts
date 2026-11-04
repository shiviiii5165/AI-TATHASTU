import "server-only";

import type { User } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin-emails";
import { requireOperator } from "@/lib/admin/rbac";

/**
 * A quick check for what to show, from the user row alone. Decides nothing about access:
 * that's getAdminContext, which also reads team membership. Deletion has its own check in SQL.
 */
export const isAdmin = (user: Pick<User, "isAdmin" | "email">) => user.isAdmin || isAdminEmail(user.email);

/**
 * Any active operator. Signed out → /login; otherwise not an operator → 404, so the page
 * isn't advertised. Pages and actions also need requireAdminPermission: a test enforces it.
 */
export async function requireAdmin() {
  return (await requireOperator()).user;
}
