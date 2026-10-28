import type { Metadata } from "next";
// landing.css first, then this page's own styles (the cascade order it was designed with).
import "@/styles/landing.css";
import "@/styles/about.css";
import { AboutContent } from "@/components/about/about-content";

export const metadata: Metadata = {
  title: "About AI Tathastu · Built to help students grow",
  description:
    "We bring your skills, projects and goals together to help you find what to learn, build and explore next.",
};

export default function AboutPage() {
  return <AboutContent />;
}
