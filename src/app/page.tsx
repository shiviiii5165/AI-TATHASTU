import type { Metadata } from "next";
import { LandingEnhancer } from "@/components/landing/landing-enhancer";
import { LandingPage } from "@/components/landing/landing-page";
import "@/styles/landing.css";

export const metadata: Metadata = {
  title: "AI Tathastu: Your Dreams. Our Intelligence. Tathastu.",
  description:
    "Connect your GitHub, LinkedIn, LeetCode and resume. See what skills you have, what is missing, and what to learn next.",
};

// Fully static: no per-request session check on the server. The enhancer asks
// for the session in the browser to personalize the CTAs.
export default function Home() {
  return (
    <LandingPage>
      <LandingEnhancer />
    </LandingPage>
  );
}
