"use client";

import { useEffect, useState } from "react";

/**
 * The landing page's only client code: personalizes the CTAs for signed-in
 * visitors and (re)starts /landing.js features after client-side navigation.
 * The markup itself is server-rendered (landing-page.tsx), so this component
 * doesn't ship the HTML string in the JS bundle, and the page stays static:
 * the session is read here, from Auth.js's /api/auth/session.
 */
export function LandingEnhancer() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((session: { user?: unknown } | null) => setSignedIn(Boolean(session?.user)))
      .catch(() => {}); // signed-out CTAs are the safe default
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const root = document.getElementById("landing-root");
    if (!root || !signedIn) return;
    // Hide the plain sign-in link; keep only the styled "Open Dashboard" CTAs.
    root.querySelectorAll<HTMLAnchorElement>(".ref-signin-link").forEach((link) => {
      link.style.display = "none";
    });
    // Update destination according to authentication/onboarding state
    // while keeping the exact button label consistent as "Get Started Free"
    root.querySelectorAll<HTMLAnchorElement>(
      "#navCreateProfileBtn, #mobileGetStartedBtn, #ctaStartFreeBtn, .btn-final-cta, .ref-primary-cta, #ctaCardCreateBtn"
    ).forEach((btn) => {
      btn.href = "/api/session/refresh";
    });
  }, [signedIn]);

  // Once per mount (never again when the session arrives, which would duplicate carousels and loops).
  useEffect(() => {
    const root = document.getElementById("landing-root");
    if (!root) return;
    // On first load /landing.js initializes itself; after client-side
    // navigation back to "/" it has to be re-run on the new DOM.
    const win = window as unknown as { initAllLandingFeatures?: () => void };
    win.initAllLandingFeatures?.();

    // Safety fallback for scroll reveals.
    const t = setTimeout(() => {
      root.querySelectorAll(".rv:not(.in)").forEach((el) => el.classList.add("in"));
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return null;
}
