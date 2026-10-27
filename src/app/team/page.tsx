import type { Metadata } from "next";
// landing.css first, then this page's own styles (the cascade order it was designed with).
import "@/styles/landing.css";
import "@/styles/team.css";
import { TEAM_HTML } from "@/components/landing/team-markup";
import { InteractiveMarkup } from "@/components/landing/interactive-markup";

export const metadata: Metadata = {
  title: "Meet the Team · AI Tathastu",
  description:
    "The people, researchers, builders, and mentors behind AI Tathastu — making learning, research and opportunities accessible for every student.",
};

export default function TeamPage() {
  return <InteractiveMarkup html={TEAM_HTML} />;
}
