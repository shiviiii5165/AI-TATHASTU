import type { Metadata } from "next";
// landing.css first, then this page's own styles (the cascade order it was designed with).
import "@/styles/landing.css";
import "@/styles/about.css";
import { ABOUT_HTML } from "@/components/landing/about-markup";
import { InteractiveMarkup } from "@/components/landing/interactive-markup";

export const metadata: Metadata = {
  title: "About Us · AI Tathastu: Career growth platform for students",
  description:
    "Connect your GitHub, LinkedIn, LeetCode and resume. See what skills you have, what is missing, and what to learn next.",
};

export default function AboutPage() {
  return <InteractiveMarkup html={ABOUT_HTML} />;
}
