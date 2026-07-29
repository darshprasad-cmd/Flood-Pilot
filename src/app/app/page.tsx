import type { Metadata } from "next";
import AppEntry from "@/components/app/AppEntry";

export const metadata: Metadata = {
  title: "My map",
  description:
    "Your area, your roads and your vehicle — live flood risk, risk-based routing and one clear recommendation across Delhi NCR.",
};

export default function AppPage() {
  return <AppEntry />;
}
