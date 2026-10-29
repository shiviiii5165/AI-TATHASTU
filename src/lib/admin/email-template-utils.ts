// Client-safe email template variable definitions and rendering utilities.
// Free of "server-only" and Node.js native dependencies so it can safely run
// in both browser client components (for instant live preview) and server actions.

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const APPROVED_VARIABLES = [
  { key: "student_name", description: "First or full name of the student", sample: "Alex Morgan" },
  { key: "student_email", description: "Email address of the student", sample: "alex@university.edu" },
  { key: "ticket_id", description: "Public ticket identifier", sample: "TATH-2026-89412" },
  { key: "ticket_subject", description: "Subject of the support ticket", sample: "GitHub Connector Sync Issue" },
  { key: "ticket_status", description: "Current status of the ticket", sample: "In Progress" },
  { key: "ticket_priority", description: "Priority level of the ticket", sample: "High" },
  { key: "assigned_agent", description: "Name of the assigned agent", sample: "Priya Nair" },
  { key: "tracking_url", description: "Direct secure URL to ticket thread", sample: "https://www.aitathastu.com/support/tickets/TATH-2026-89412" },
  { key: "message_body", description: "Content of the agent message", sample: "We have refreshed your integration token." },
  { key: "resolution_summary", description: "Summary of problem resolution", sample: "Re-authenticated third-party webhook successfully." },
  { key: "action_url", description: "Primary CTA destination URL", sample: "https://www.aitathastu.com/dashboard" },
  { key: "action_label", description: "Call-to-action button label", sample: "View In Dashboard" },
  { key: "brand_name", description: "Platform brand name", sample: "AI Tathastu" },
  { key: "support_email", description: "Official support email address", sample: "support.aitathastu@gmail.com" },
  { key: "security_event", description: "Security event details", sample: "New sign-in from Chrome on Windows" },
  { key: "event_time", description: "Formatted timestamp of event", sample: "29 Oct 2026, 17:30 IST" },
] as const;

export type VariableKey = (typeof APPROVED_VARIABLES)[number]["key"];

/**
 * Replaces double-curly variables (e.g. {{student_name}}) with escaped values.
 * Strictly prevents stored XSS by auto-escaping every interpolated variable.
 */
export function renderTemplateContent(
  templateString: string,
  variables: Record<string, string | number | undefined | null>
): string {
  return templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = variables[key];
    if (val === undefined || val === null) {
      return ``;
    }
    return escapeHtml(String(val));
  });
}

/**
 * Validates that all variables used in a template exist in the approved registry.
 */
export function validateTemplateVariables(textToInspect: string): {
  valid: boolean;
  unknownVariables: string[];
} {
  const approvedKeys = new Set(APPROVED_VARIABLES.map((v) => v.key));
  const matches = textToInspect.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  const unknownVariables: string[] = [];

  for (const match of matches) {
    const varName = match[1];
    if (!approvedKeys.has(varName as VariableKey)) {
      unknownVariables.push(varName);
    }
  }

  return {
    valid: unknownVariables.length === 0,
    unknownVariables: Array.from(new Set(unknownVariables)),
  };
}

