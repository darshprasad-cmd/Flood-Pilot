import type { Metadata } from "next";
import GovDashboard from "@/components/gov/GovDashboard";

export const metadata: Metadata = {
  title: "Flood operations",
  description: "Restricted operations dashboard for flood control.",
  robots: { index: false, follow: false },
};

export default function GovPage() {
  return <GovDashboard />;
}
