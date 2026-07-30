"use client";

import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import Onboarding from "@/components/onboarding/Onboarding";
import { AppSplash } from "./AppSplash";
import { useProfile } from "@/lib/profile";

/**
 * The gate.
 *
 * A first-time visitor gets the conversation; a returning one goes straight to
 * their dashboard. Deliberately not a route — pushing somebody to `/start` and
 * then to `/app` would put a full page load in the middle of a cinematic
 * flight, and the flight is the point.
 */

/** Long enough to read as a start rather than a flicker. */
const SPLASH_MIN_MS = 900;
/** Matches the dissolve in `fp-intro-out`. */
const SPLASH_FADE_MS = 700;

export default function AppEntry() {
  const { profile, hydrated } = useProfile();
  const [forceSetup, setForceSetup] = useState(false);
  const [splash, setSplash] = useState<"holding" | "leaving" | "gone">("holding");

  // Start the dissolve once the profile is known *and* the minimum has
  // elapsed, whichever is later. Reading localStorage usually wins the race by
  // a mile, which is exactly why the floor exists.
  useEffect(() => {
    if (!hydrated || splash !== "holding") return;
    const timer = setTimeout(() => setSplash("leaving"), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, [hydrated, splash]);

  useEffect(() => {
    if (splash !== "leaving") return;
    const timer = setTimeout(() => setSplash("gone"), SPLASH_FADE_MS);
    return () => clearTimeout(timer);
  }, [splash]);

  const needsSetup = forceSetup || profile.completedAt === null;

  return (
    <>
      {/* Mounted as soon as the profile is readable, so the real interface is
          already behind the splash rather than starting when it ends. */}
      {hydrated
        ? needsSetup
          ? <Onboarding onComplete={() => setForceSetup(false)} />
          : <AppShell onEditSetup={() => setForceSetup(true)} />
        : null}

      {splash === "gone" ? null : <AppSplash leaving={splash === "leaving"} />}
    </>
  );
}
