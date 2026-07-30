"use client";

import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import Onboarding from "@/components/onboarding/Onboarding";
import { AppSplash } from "./AppSplash";
import { useProfile } from "@/lib/profile";
import { useT } from "@/lib/i18n";

/**
 * The gate — or rather, what used to be one.
 *
 * A first-time visitor now lands in the working dashboard and is *invited* to
 * personalise it. Previously they were held in an eight-question form that
 * announced "about 40 seconds" before showing anything, which meant the first
 * thing the product did was ask rather than answer. Somebody who opens a flood
 * map during a downpour wants to know whether the road is passable, and that
 * question is answerable city-wide without knowing where they live.
 *
 * Deliberately not a route — pushing somebody to `/start` and then to `/app`
 * would put a full page load in the middle of a cinematic flight, and the
 * flight is the point.
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

  // Onboarding is now only ever entered on purpose — from the invitation below
  // or from "Change my details" — never as a toll on the way in.
  const firstRun = profile.completedAt === null;
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const showInvite = hydrated && firstRun && !forceSetup && splash === "gone" && !inviteDismissed;

  return (
    <>
      {/* Mounted as soon as the profile is readable, so the real interface is
          already behind the splash rather than starting when it ends. */}
      {hydrated
        ? forceSetup
          ? <Onboarding firstRun={firstRun} onComplete={() => setForceSetup(false)} />
          : <AppShell onEditSetup={() => setForceSetup(true)} />
        : null}

      {showInvite ? (
        <PersonaliseInvite
          onAccept={() => setForceSetup(true)}
          onDismiss={() => setInviteDismissed(true)}
        />
      ) : null}

      {splash === "gone" ? null : <AppSplash leaving={splash === "leaving"} />}
    </>
  );
}

/**
 * The offer that replaced the questionnaire.
 *
 * Sits above the interface rather than in front of it: the dashboard behind is
 * already usable, so this must never read as something to get past. It reuses
 * the old welcome-step copy, which was already translated into all seven
 * locales and went unreferenced when that step was removed.
 */
function PersonaliseInvite({
  onAccept,
  onDismiss,
}: {
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const t = useT();

  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 lg:justify-start lg:p-6">
      <div className="float-card pointer-events-auto animate-arrive w-full max-w-sm rounded-2xl p-4">
        <p className="text-sm leading-relaxed text-fg">{t.onboarding.welcomeBody}</p>
        <p className="mt-1.5 text-xs text-fg-faint">{t.onboarding.welcomeNote}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="min-h-11 flex-1 rounded-xl bg-signal-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-signal-400"
          >
            {t.onboarding.welcomeCta}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-xl border border-line px-4 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            {t.onboarding.skipSetup}
          </button>
        </div>
      </div>
    </div>
  );
}
