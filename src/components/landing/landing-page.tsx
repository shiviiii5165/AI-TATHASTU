"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { LANDING_HTML } from "@/components/landing/landing-markup";

export function LandingPage({
  user,
}: {
  user?: { id?: string; name?: string | null; email?: string | null };
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // If user is authenticated, personalize CTAs
    if (user) {
      // When authenticated, remove redundant plain Dashboard pill from header, keeping only the styled Open Dashboard CTA
      const signInLinks = containerRef.current.querySelectorAll<HTMLAnchorElement>(".ref-signin-link");
      signInLinks.forEach((link) => {
        link.style.display = "none";
      });

      const createButtons = containerRef.current.querySelectorAll<HTMLAnchorElement>(
        "#navCreateProfileBtn, .ref-primary-cta, #ctaCardCreateBtn"
      );
      createButtons.forEach((btn) => {
        const textSpan = btn.querySelector("span");
        if (textSpan) textSpan.textContent = "Open Dashboard";
        btn.href = "/dashboard";
      });
    }

    // Initialize landing interactive features on mount / route transition
    if (typeof window !== "undefined") {
      const win = window as unknown as { initAllLandingFeatures?: () => void };
      if (typeof win.initAllLandingFeatures === "function") {
        win.initAllLandingFeatures();
      }
    }

    // Safety fallback for scroll reveals
    setTimeout(() => {
      document.querySelectorAll(".rv:not(.in)").forEach((el) => el.classList.add("in"));
    }, 800);
  }, [user]);

  return (
    <div className="relative min-h-screen bg-white text-[#121624] overflow-x-hidden w-full max-w-full">
      {/* Landing page markup */}
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: LANDING_HTML }}
      />
      {/* Interactive landing script */}
      <Script src="/landing.js" strategy="afterInteractive" />
    </div>
  );
}
