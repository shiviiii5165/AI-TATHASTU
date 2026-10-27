import type { Metadata } from "next";
// landing.css first, then this page's own styles (the cascade order it was designed with).
import "@/styles/landing.css";
import "@/styles/contact.css";
import { CONTACT_HTML } from "@/components/landing/contact-markup";
import { InteractiveMarkup } from "@/components/landing/interactive-markup";

export const metadata: Metadata = {
  title: "Support & Contact Us · AI Tathastu — Let's Talk",
  description:
    "Get in touch with the AI Tathastu team. Enquire about our verified student ecosystem, explore campus partnerships, get technical support, or share feedback.",
};

export default function ContactPage() {
  return <InteractiveMarkup html={CONTACT_HTML} />;
}
