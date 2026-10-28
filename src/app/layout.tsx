import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const display = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for the Open Graph image (src/app/opengraph-image.png).
  metadataBase: new URL(process.env.AUTH_URL ?? "https://www.aitathastu.com"),
  title: { default: "AI Tathastu", template: "%s · AI Tathastu" },
  description: "Connect your GitHub, LinkedIn, LeetCode and resume. See what skills you have, what is missing, and what to learn next.",
  applicationName: "AI Tathastu",
  appleWebApp: { title: "AI Tathastu", statusBarStyle: "black-translucent" },
  openGraph: { siteName: "AI Tathastu", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
