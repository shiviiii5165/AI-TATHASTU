import type { Metadata } from "next";
// landing.css first, then this page's own styles (the cascade order it was designed with).
import "@/styles/landing.css";
import "@/styles/about.css";
import { ABOUT_HTML } from "@/components/landing/about-markup";
import { InteractiveMarkup } from "@/components/landing/interactive-markup";

export const metadata: Metadata = {
  title: "About Us · AI Tathastu — Ideas Deserve to Become Reality",
  description:
    "AI Tathastu is an applied technology company building practical AI-powered products, verifiable skill profiles, and collaborative workspaces for students, researchers, and campus builders.",
};

export default function AboutPage() {
  return <InteractiveMarkup html={ABOUT_HTML} />;
}
