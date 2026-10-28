import type { Metadata } from "next";
// landing.css first, then this page's own styles (the cascade order it was designed with).
import "@/styles/landing.css";
import "@/styles/about.css";
import { ABOUT_HTML } from "@/components/landing/about-markup";
import { InteractiveMarkup } from "@/components/landing/interactive-markup";

export const metadata: Metadata = {
  title: "About Us · AI Tathastu — You imagine. AI Tathastu makes it happen.",
  description:
    "Turn your skills, projects and ideas into meaningful next steps with AI Tathastu.",
};

export default function AboutPage() {
  return <InteractiveMarkup html={ABOUT_HTML} />;
}
