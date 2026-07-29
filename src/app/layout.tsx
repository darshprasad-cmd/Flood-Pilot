import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://floodpilot.vercel.app"),
  title: {
    default: "FloodPilot — AI Urban Flood Intelligence",
    template: "%s · FloodPilot",
  },
  description:
    "FloodPilot predicts where a city floods, how deep, and when — then tells you what to do about it. Explainable, confidence-scored urban flood intelligence for citizens and city governments.",
  applicationName: "FloodPilot",
  keywords: [
    "flood prediction",
    "urban resilience",
    "flood routing",
    "smart city",
    "disaster intelligence",
  ],
  openGraph: {
    title: "FloodPilot — AI Urban Flood Intelligence",
    description:
      "An operating system for urban flood resilience. Risk-based routing, vehicle survivability, and explainable decisions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Loaded via <link> rather than next/font so the build never depends
            on network access to Google Fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
