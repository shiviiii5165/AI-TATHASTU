// Web vitals and JS transfer per route, in Chromium against a running LOCAL app.
// Median of N loads; "mobile" = 390 px, 4x CPU, 1.6 Mbps / 150 ms. Not field data.
//   node load/web-vitals.mts <base url> <tokens.json> [runs=3]
import { readFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const [base = "http://localhost:3100", tokens, runsArg = "3"] = process.argv.slice(2);
const session = tokens ? (JSON.parse(readFileSync(tokens, "utf8")) as { cookie: string }[])[2] : null;
const PUBLIC = ["/", "/login"];
const PRIVATE = ["/dashboard", "/profile", "/projects", "/skills", "/people", "/learning"];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const browser = await chromium.launch();
for (const profile of ["desktop", "mobile"] as const) {
  for (const route of [...PUBLIC, ...(session ? PRIVATE : [])]) {
    const runs = [];
    for (let i = 0; i < Number(runsArg); i++) {
      const context = await browser.newContext(profile === "mobile" ? { viewport: { width: 390, height: 844 }, isMobile: true } : { viewport: { width: 1440, height: 900 } });
      if (session) await context.addCookies([{ name: "authjs.session-token", value: session.cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      let jsBytes = 0;
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      const types = new Map<string, string>();
      cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
      cdp.on("Network.loadingFinished", (e) => { if (types.get(e.requestId) === "Script") jsBytes += e.encodedDataLength; });
      if (profile === "mobile") {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000 });
      }
      await page.addInitScript(() => {
        const w = window as unknown as { __v: { lcp: number; cls: number; tbt: number } };
        w.__v = { lcp: 0, cls: 0, tbt: 0 };
        new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__v.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__v.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__v.tbt += Math.max(0, e.duration - 50); }).observe({ type: "longtask", buffered: true });
      });
      const hydrationErrors: string[] = [];
      page.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) hydrationErrors.push(m.text()); });
      await page.goto(base + route, { waitUntil: "load", timeout: 120_000 });
      await page.waitForTimeout(2500);
      const v = await page.evaluate(() => (window as unknown as { __v: { lcp: number; cls: number; tbt: number } }).__v);
      runs.push({ ...v, jsBytes, hydration: hydrationErrors.length });
      await context.close();
    }
    console.log([profile, route, `LCP ${Math.round(median(runs.map((r) => r.lcp)))}`, `TBT ${Math.round(median(runs.map((r) => r.tbt)))}`, `CLS ${median(runs.map((r) => r.cls)).toFixed(3)}`, `JS ${Math.round(median(runs.map((r) => r.jsBytes)) / 1024)}KB`, `hydrationErrors ${Math.max(...runs.map((r) => r.hydration))}`].join(" | "));
  }
}
await browser.close();
