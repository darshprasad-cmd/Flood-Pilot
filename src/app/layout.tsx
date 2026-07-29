import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dishaai.netlify.app"),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "An intelligent map that understands Delhi, understands you, and calmly guides you to the safest decision. Risk-based routing, vehicle survivability and explainable AI on live government and open data.",
  applicationName: BRAND.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // iOS renders this under the home-screen icon in the system font, which on
    // older versions has no Devanagari. The Latin name is legible everywhere.
    title: BRAND.latin,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // Road names contain numbers; iOS turning them into phone links is noise.
    telephone: false,
  },
  keywords: [
    "दिशा",
    "DishaAI",
    "Delhi flood",
    "waterlogging",
    "Yamuna",
    "flood prediction",
    "urban resilience",
    "safe route",
  ],
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description:
      "AI urban intelligence for Delhi. Not the fastest route — the one you survive.",
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
