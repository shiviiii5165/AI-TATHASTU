import Script from "next/script";
import type { ReactNode } from "react";

import { LANDING_HTML } from "@/components/landing/landing-markup";

/**
 * Server Component: the static landing markup is rendered once on the server
 * and never bundled into client JavaScript. `children` carries the small,
 * session-dependent client enhancer.
 */
export function LandingPage({ children }: { children?: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white text-[#121624] overflow-x-hidden w-full max-w-full">
      {/* Landing page markup */}
      <div id="landing-root" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
      {children}
      {/* Interactive landing script */}
      <Script src="/landing.js" strategy="afterInteractive" />
    </div>
  );
}
