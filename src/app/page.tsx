import type { Metadata } from "next";
import { LandingEnhancer } from "@/components/landing/landing-enhancer";
import { LandingPage } from "@/components/landing/landing-page";
import "@/styles/landing.css";

export const metadata: Metadata = {
  title: "AI Tathastu — You imagine. AI Tathastu makes it happen.",
  description:
    "Turn your skills, projects and ideas into meaningful next steps with AI Tathastu.",
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
