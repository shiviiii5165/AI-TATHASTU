"use client";

/** The root layout itself failed, so nothing it provides (fonts, theme, CSS) can be relied on. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1.5rem" }}>
        <main role="alert" style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.75rem", margin: 0 }}>We couldn&apos;t load this page.</h1>
          <p style={{ lineHeight: 1.5 }}>This is on our side, and your saved information is safe. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ font: "inherit", padding: "0.5rem 1rem", cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
