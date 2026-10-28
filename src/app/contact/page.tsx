import type { Metadata } from "next";
import "@/styles/landing.css";
import "@/styles/contact.css";
import { ContactContent } from "@/components/contact/contact-content";

export const metadata: Metadata = {
  title: "Contact Us · AI Tathastu",
  description:
    "Good things start with a conversation. Have a question, idea or problem? Reach out to the AI Tathastu team.",
};

export default function ContactPage() {
  return <ContactContent />;
}
