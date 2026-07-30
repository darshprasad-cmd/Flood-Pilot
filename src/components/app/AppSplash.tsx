"use client";

import { Mark, Wordmark } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";

/**
 * The startup screen.
 *
 * This is what a person sees when they launch दिशाAI from their home screen,
 * because the PWA's `start_url` is `/app` and not the landing page. It was a
 * bare mark on black for one frame, which reads as a stutter rather than a
 * start.
 *
 * Two rules it follows:
 *
 *   - It is held for a short minimum. A splash that appears for 40 ms and
 *     vanishes is worse than none at all; the eye registers a flicker and not
 *     a brand.
 *   - It never blocks. The app renders underneath as soon as it can, and this
 *     dissolves off the top of it.
 *
 * Blue rather than the landing page's green. Green means "safe" on the risk
 * ramp and the intro orb has earned that meaning; this is the product loading,
 * which is not a safety statement about anything.
 */
export function AppSplash({ leaving }: { leaving: boolean }) {
  return (
    <div
      className={`safe-top safe-bottom fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink-950 ${
        leaving ? "animate-intro-out pointer-events-none" : ""
      }`}
      role="status"
      aria-label={BRAND.latin}
    >
      <div className="relative flex items-center justify-center">
        <span
          className="animate-orb-halo absolute h-40 w-40 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(43,140,240,0.45), rgba(43,140,240,0.05) 60%, transparent 72%)",
          }}
          aria-hidden
        />
        <Mark size={52} className="relative text-fg-muted" />
      </div>

      <span className="animate-intro-rise mt-6" style={{ animationDelay: "120ms" }}>
        <Wordmark size={30} />
      </span>

      {/* Indeterminate, and honestly so. A progress bar that invents a
          percentage for work it cannot measure is a lie told for comfort. */}
      <div className="shimmer mt-8 h-[2px] w-32 overflow-hidden rounded-full bg-ink-800">
        <span className="shimmer-bar" />
      </div>

      <p
        className="animate-intro-rise mt-5 text-[11px] uppercase tracking-[0.18em] text-fg-faint"
        style={{ animationDelay: "420ms" }}
      >
        {BRAND.city}
      </p>
    </div>
  );
}
