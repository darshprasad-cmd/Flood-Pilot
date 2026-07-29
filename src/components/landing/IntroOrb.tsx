"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The opening shot.
 *
 * A green orb flickers into life at the centre of a dark screen, throws three
 * rings of water outward, and dissolves to reveal the map underneath. It lands
 * exactly where the compass mark sits, so the orb does not so much disappear as
 * become the product.
 *
 * Green is not a decorative choice. On this palette green is the safe end of
 * the risk ramp, and colour in this product is only ever allowed to mean
 * something — the orb is the system coming alive and reporting clear.
 *
 * Three rules it obeys, because an intro that ignores any of them is an
 * obstacle rather than a welcome:
 *
 *   - It never blocks. The landing page is fully rendered underneath the whole
 *     time; this is an overlay that fades, not a gate that opens.
 *   - Any tap, click or key ends it immediately.
 *   - It does not run for somebody who has asked for reduced motion, and it
 *     does not run twice in a session.
 */

const STORAGE_KEY = "disha.intro.seen";
/** Ignition, ripples, and a beat to breathe before the dissolve. */
const HOLD_MS = 2100;
const FADE_MS = 750;

export default function IntroOrb() {
  // "pending" until we know whether this browser wants it at all — rendering
  // optimistically would flash a black screen at people who opted out.
  const [phase, setPhase] = useState<"pending" | "playing" | "leaving" | "done">(
    "pending",
  );

  /**
   * This effect reads a flag and then writes it, which makes running it twice
   * a different operation from running it once — the second pass would find
   * the flag its own first pass had just written and conclude the intro had
   * already played. React deliberately double-invokes mount effects in
   * development to surface exactly this, and reserves the right to do it in
   * production too, so the decision is made once and latched.
   */
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current) return;
    decided.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private browsing. Playing the intro again is a small cost.
    }

    if (reduced || seen) {
      setPhase("done");
      return;
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* see above */
    }

    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;

    const leave = () => setPhase("leaving");
    const hold = setTimeout(leave, HOLD_MS);

    // Impatience is a legitimate response to an intro.
    window.addEventListener("pointerdown", leave, { once: true });
    window.addEventListener("keydown", leave, { once: true });
    window.addEventListener("wheel", leave, { once: true, passive: true });

    return () => {
      clearTimeout(hold);
      window.removeEventListener("pointerdown", leave);
      window.removeEventListener("keydown", leave);
      window.removeEventListener("wheel", leave);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "pending" || phase === "done") return null;

  return (
    <div
      // Pointer-transparent from the first frame: the listener above already
      // catches the tap, and nothing here should ever swallow a click meant
      // for the page it is sitting on top of.
      className={`pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-ink-950 ${
        phase === "leaving" ? "animate-intro-out" : ""
      }`}
      aria-hidden
    >
      {/* Water leaving the source. Staggered so it reads as a sequence of
          waves rather than one thick expanding band. */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-ripple absolute h-40 w-40 rounded-full border"
          style={{
            borderColor: "rgba(47,191,111,0.55)",
            animationDelay: `${450 + i * 320}ms`,
          }}
        />
      ))}

      {/* Halo */}
      <span
        className="animate-orb-halo absolute h-64 w-64 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(47,191,111,0.55), rgba(47,191,111,0.06) 60%, transparent 72%)",
        }}
      />

      {/* Core */}
      <span
        className="animate-orb relative h-20 w-20 rounded-full"
        style={{
          // Lit from the upper left so it reads as a sphere rather than a disc.
          background:
            "radial-gradient(circle at 38% 34%, #d6f7e5, #4fd894 34%, #2fbf6f 62%, #148a4f 100%)",
          boxShadow:
            "0 0 28px 6px rgba(47,191,111,0.55), 0 0 90px 26px rgba(47,191,111,0.28), inset 0 0 22px rgba(255,255,255,0.28)",
        }}
      />
    </div>
  );
}
