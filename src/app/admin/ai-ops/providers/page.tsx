import { Cpu } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { type CallStats, isWindow, providerTelemetry, WINDOWS, type Window } from "@/lib/admin/ai-telemetry";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { fullTimestamp } from "@/lib/admin/summaries";

export const metadata = {
  title: "AI Providers & Models · Admin Control Center",
  robots: { index: false },
};

const fmt = (x: number) => x.toLocaleString("en-IN");
const usd = (x: number) => `$${x.toFixed(x > 0 && x < 0.01 ? 4 : 2)}`;
const ms = (x: number | null) => (x === null ? "—" : `${fmt(x)} ms`);

function FailureCell({ s }: { s: CallStats }) {
  const parts = [
    s.rateLimited && `${s.rateLimited} rate-limited`,
    s.rejected && `${s.rejected} rejected`,
    s.timeouts && `${s.timeouts} timed out`,
    s.otherErrors && `${s.otherErrors} other errors`,
  ].filter(Boolean);
  return <span className="text-muted-foreground">{parts.length ? parts.join(" · ") : "None"}</span>;
}

export default async function AdminAiProvidersPage({ searchParams }: { searchParams?: Promise<{ w?: string }> } = {}) {
  await requireAdmin();
  await requireAdminPermission("ai.providers.read");
  const raw = (await searchParams)?.w;
  const w: Window = isWindow(raw) ? raw : "month";
  const t = await providerTelemetry(w);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="size-6 text-primary" />
            <span>AI Providers &amp; Models</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Calls the background worker made, from its usage records. Days are counted in UTC: this window starts {t.from.slice(0, 10)} 00:00 UTC.
          </p>
        </div>
        <nav aria-label="Time window" className="flex flex-wrap gap-1 text-xs">
          {(Object.keys(WINDOWS) as Window[]).map((k) => (
            <Link key={k} href={`/admin/ai-ops/providers?w=${k}`} aria-current={k === w ? "page" : undefined} className={`px-3 py-1.5 rounded-lg font-medium ${k === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              {WINDOWS[k]}
            </Link>
          ))}
        </nav>
      </div>

      <p className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
        Which providers, keys and models are configured lives in the worker&apos;s environment on Render and isn&apos;t visible to this app; a provider appears below once it has been called.
        {t.inFlight > 0 && <> {t.inFlight} call(s) are in progress and not counted yet.</>}
      </p>

      {t.providers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="no-calls">No AI calls in this window.</p>
      ) : (
        <>
          <section aria-labelledby="by-provider" className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
            <h2 id="by-provider" className="p-4 border-b border-border text-xs font-bold uppercase tracking-wider text-foreground">By provider</h2>
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="provider-table">
                <caption className="sr-only">AI calls by provider, {WINDOWS[w]}</caption>
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th scope="col" className="py-2.5 px-4">Provider</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Calls</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Succeeded</th>
                    <th scope="col" className="py-2.5 px-4">Failures</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Response time (median · p95)</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Tokens in · out</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Measured cost</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Estimated cost</th>
                    <th scope="col" className="py-2.5 px-4">Last success · last failure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {t.providers.map((p) => (
                    <tr key={p.provider} className="align-top">
                      <th scope="row" className="py-2.5 px-4 font-semibold text-foreground">{p.provider}</th>
                      <td className="py-2.5 px-4 text-right font-mono">{fmt(p.calls)}</td>
                      <td className={`py-2.5 px-4 text-right font-mono ${p.successRate !== null && p.successRate < 90 ? "text-rose-700 dark:text-rose-400 font-semibold" : ""}`}>{fmt(p.succeeded)} ({p.successRate ?? "—"}%)</td>
                      <td className="py-2.5 px-4"><FailureCell s={p} />{p.truncated > 0 && <span className="block text-[10px] text-muted-foreground">{p.truncated} answer(s) cut off (counted as succeeded work)</span>}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{ms(p.latency.median)} · {ms(p.latency.p95)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{fmt(p.tokensIn)} · {fmt(p.tokensOut)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{usd(p.meteredUsd)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{usd(p.estimatedUsd)}</td>
                      <td className="py-2.5 px-4 text-[11px] text-muted-foreground whitespace-nowrap">{p.lastSuccessAt ? fullTimestamp(p.lastSuccessAt) : "—"}<br />{p.lastFailureAt ? fullTimestamp(p.lastFailureAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="by-model" className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
            <h2 id="by-model" className="p-4 border-b border-border text-xs font-bold uppercase tracking-wider text-foreground">By model</h2>
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="model-table">
                <caption className="sr-only">AI calls by model, {WINDOWS[w]}</caption>
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th scope="col" className="py-2.5 px-4">Model</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Calls</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Success rate</th>
                    <th scope="col" className="py-2.5 px-4">Failures</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Median time</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Tokens in · out</th>
                    <th scope="col" className="py-2.5 px-4 text-right">Cost (measured + estimated)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {t.models.map((m) => (
                    <tr key={`${m.provider}/${m.model}`}>
                      <th scope="row" className="py-2.5 px-4 font-normal"><span className="font-mono text-foreground">{m.model}</span><span className="block text-[10px] text-muted-foreground">{m.provider}</span></th>
                      <td className="py-2.5 px-4 text-right font-mono">{fmt(m.calls)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{m.successRate ?? "—"}%</td>
                      <td className="py-2.5 px-4"><FailureCell s={m} /></td>
                      <td className="py-2.5 px-4 text-right font-mono">{ms(m.latency.median)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{fmt(m.tokensIn)} · {fmt(m.tokensOut)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{usd(m.meteredUsd)} + {usd(m.estimatedUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <details className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground">How these numbers are counted</summary>
        <ul className="mt-2 list-disc pl-4 space-y-1">
          <li><strong>Succeeded:</strong> the provider answered without error. Response times use successful calls only.</li>
          <li><strong>Rate-limited / rejected:</strong> the provider turned the request away before doing work (too many requests, access or model not found). Not charged.</li>
          <li><strong>Timed out / other errors:</strong> the call failed after it was sent; it may have been charged, so it is costed at the reserved maximum.</li>
          <li><strong>Measured cost:</strong> tokens the provider reported × the worker&apos;s configured rates. <strong>Estimated cost:</strong> the reserved maximum, used when no usage was reported. Neither is an invoice; compare with each provider&apos;s billing page.</li>
        </ul>
      </details>
    </div>
  );
}
