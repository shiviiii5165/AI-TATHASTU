/**
 * Server-side failure reporting for Operational Health. Next calls onRequestError for errors thrown while handling
 * a route handler ("route"), rendering a page ("render") or running a server action ("action"). Each is counted in
 * route_stats under its route *pattern* (e.g. /admin/students/[id]), so no record id or query string is stored, and
 * only the error's class/digest is kept: messages can carry personal data.
 */
export async function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: "render" | "route" | "action" | "middleware" },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // the database client is Node-only
  try {
    const { recordRouteOutcome } = await import("@/lib/admin/monitoring");
    const kind = error instanceof Error ? error.name : "unknown";
    const digest = (error as { digest?: string } | null)?.digest;
    await recordRouteOutcome({
      route: `${context.routeType} ${request.method} ${context.routePath}`,
      ok: false,
      ms: 0,
      slow: false,
      error: digest ? `${kind} (digest ${digest})` : kind,
    });
  } catch {
    // Reporting must never add a second failure.
  }
}
