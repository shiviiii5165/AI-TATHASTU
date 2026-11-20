// Shown instantly on every click into a dashboard route while the server renders the page,
// so a navigation never looks like a dead button.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex w-full max-w-6xl flex-col gap-4 animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="h-4 w-80 max-w-full rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-40 rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
