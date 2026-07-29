import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://floodpilot.netlify.app"),
  title: {
    default: "FloodPilot — AI Urban Flood Intelligence for Delhi",
    template: "%s · FloodPilot",
  },
  description:
    "FloodPilot predicts where Delhi floods, how deep, and when — then tells you what to do about it. Explainable, confidence-scored urban flood intelligence for citizens and city governments.",
  applicationName: "FloodPilot",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FloodPilot",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // Road names contain numbers; iOS turning them into phone links is noise.
    telephone: false,
  },
  keywords: [
    "Delhi flood",
    "waterlogging",
    "Yamuna",
    "flood prediction",
    "urban resilience",
    "flood routing",
  ],
  openGraph: {
    title: "FloodPilot — AI Urban Flood Intelligence for Delhi",
    description:
      "An operating system for urban flood resilience. Risk-based routing, vehicle survivability, and explainable decisions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  width: "device-width",
  initialScale: 1,
  // Fill the display on notched iPhones; padding is reintroduced via
  // env(safe-area-inset-*) only where it is actually needed.
  viewportFit: "cover",
  // Deliberately not locking maximum-scale: pinch-zoom is an accessibility
  // feature, and the iOS zoom-on-focus problem is solved properly in CSS by
  // giving form controls a 16px font size instead.
  userScalable: true,
};

/**
 * Fonts for every script FloodPilot speaks: Latin, Devanagari (Hindi, Bhojpuri,
 * Maithili), Gurmukhi (Punjabi), Bengali and Nastaliq (Urdu).
 *
 * Loaded via <link> rather than next/font so the build never depends on network
 * access, and with display=swap so a slow font never delays a flood warning.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Inter:wght@400;500;600;700" +
  "&family=JetBrains+Mono:wght@400;500;600" +
  "&family=Noto+Sans+Devanagari:wght@400;500;600;700" +
  "&family=Noto+Sans+Gurmukhi:wght@400;500;600;700" +
  "&family=Noto+Sans+Bengali:wght@400;500;600;700" +
  "&family=Noto+Nastaliq+Urdu:wght@400;700" +
  "&display=swap";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONT_HREF} rel="stylesheet" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="min-h-dvh antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
