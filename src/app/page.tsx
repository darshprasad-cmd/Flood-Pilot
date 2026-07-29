import type { Metadata } from "next";
import LandingExperience from "@/components/landing/LandingExperience";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    "An intelligent map that reads Delhi's rain, drains, elevation and roads — then tells you what to do about them. Risk-based routing, vehicle survivability and explainable AI.",
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return <LandingExperience />;
}
