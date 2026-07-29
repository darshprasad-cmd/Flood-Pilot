"use client";

import { useState } from "react";
import AppShell from "./AppShell";
import Onboarding from "@/components/onboarding/Onboarding";
import { Mark } from "@/components/brand/Logo";
import { useProfile } from "@/lib/profile";

/**
 * The gate.
 *
 * A first-time visitor gets the conversation; a returning one goes straight to
 * their dashboard. Deliberately not a route — pushing somebody to `/start` and
 * then to `/app` would put a full page load in the middle of a cinematic
 * flight, and the flight is the point.
 */
export default function AppEntry() {
  const { profile, hydrated } = useProfile();
  const [forceSetup, setForceSetup] = useState(false);

  // Nothing profile-dependent may render before localStorage has been read, or
  // a returning user sees onboarding flash past on the way to their dashboard.
  if (!hydrated) return <Splash />;

  const needsSetup = forceSetup || profile.completedAt === null;

  if (needsSetup) {
    return <Onboarding onComplete={() => setForceSetup(false)} />;
  }

  return <AppShell onEditSetup={() => setForceSetup(true)} />;
}

function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center bg-ink-950">
      <Mark size={34} className="animate-breathe text-fg-faint" />
    </div>
  );
}
