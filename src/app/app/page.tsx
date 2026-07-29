import type { Metadata } from "next";
import AppShell from "@/components/app/AppShell";

export const metadata: Metadata = {
  title: "Flood intelligence",
  description:
    "Live flood risk, risk-based routing and vehicle survivability across Delhi NCR.",
};

export default function AppPage() {
  return <AppShell />;
}
