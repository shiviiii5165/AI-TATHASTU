/** Sends a rendering failure to /api/client-errors: the path and the error's class/digest only, never its message. */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname, kind: error.name || "Error", digest: error.digest }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting is best effort.
  }
}
