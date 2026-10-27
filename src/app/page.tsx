import type { Metadata } from "next";
import { LandingEnhancer } from "@/components/landing/landing-enhancer";
import { LandingPage } from "@/components/landing/landing-page";
import "@/styles/landing.css";

export const metadata: Metadata = {
  title: "AI Tathastu — The Mind Behind Your Work",
  description:
    "The AI/ML home of your campus. Repositories, notebooks, papers, hackathons — gathered into one verified profile.",
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
