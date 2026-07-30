/**
 * The opening moment.
 *
 * A green orb ignites at the centre of a dark screen, throws four rings of
 * water outward, and the दिशाAI wordmark surfaces out of its glow — then the
 * whole thing dissolves off the top of an app that has been sitting there,
 * fully rendered, the entire time.
 *
 * Green is not a decorative choice. On this palette green is the safe end of
 * the risk ramp, and colour in this product is only ever allowed to mean
 * something: the orb is the system coming alive and reporting clear. It is a
 * port of the Next app's IntroOrb, with AppSplash's minimum-hold rule folded
 * in, because in one file the two moments are the same moment.
 *
 * ── Why the curtain is raised at import, not by startIntro ──────────────
 *
 * main.ts asks for the intro after `refresh()` resolves, which is two to three
 * seconds in — an orb that arrives after the map has already drawn is an
 * interstitial, not an opening. So the reveal happens at module scope, which
 * is the first thing the bundle does, and `startIntro()` is the *hand-off*:
 * "the app is ready, get out of the way as soon as the sequence has had its
 * minimum hold". main.ts is untouched and its call site is still exactly
 * right; what changed is that the intro no longer waits to be born, only to
 * be dismissed.
 *
 * ── The rules, and what this environment does to them ───────────────────
 *
 *   - It never gates. The overlay is `pointer-events: none` over a page that
 *     has already rendered, and the one interactive thing in it — the skip
 *     button — opts back in on its own.
 *   - Any pointerdown, keydown or wheel ends it. It does not run under
 *     `prefers-reduced-motion`, and not twice in one session.
 *   - Nothing about the app becoming usable depends on a frame ever running.
 *     Every deadline here is a `setTimeout`, which fires in a hidden document
 *     where rAF and (unreliably) CSS animations do not, and one of those
 *     timers is a failsafe that does not care whether `startIntro` is ever
 *     called at all. The composition is authored so that the *resting* state
 *     of each element is its finished state — see `.intro-static` in
 *     shell.html — so a timeline that never advances leaves the intro correct
 *     rather than blank.
 */

import { BRAND_NAME, BRAND_TAGLINE } from "./i18n";

export interface IntroOptions {
  /** Called once the intro is over, however it ended. */
  onDone?: () => void;
}

const STORAGE_KEY = "disha.intro.seen";

/** Ignition, ripples, wordmark, tagline — then a beat before the dissolve. */
const HOLD_MS = 3000;
const FADE_MS = 700;

/**
 * The curtain comes down at this point regardless.
 *
 * `startIntro()` is the graceful signal, but it is only reached if `boot()`
 * resolves; a throw anywhere in the engine pass would otherwise park an orb
 * over an error message nobody can read. A real timer rather than a frame
 * callback, so it fires on the surfaces where nothing else does.
 */
const FAILSAFE_MS = 6000;

/** Impatience is a legitimate response to an intro. */
const IMPATIENCE = ["pointerdown", "keydown", "wheel"] as const;

type Phase = "idle" | "playing" | "leaving" | "done";

let phase: Phase = "idle";
let root: HTMLElement | null = null;
let startedAt = 0;
let handedOff = false;
let onDone: (() => void) | undefined;
const timers: number[] = [];

function schedule(ms: number, run: () => void): void {
  timers.push(window.setTimeout(run, ms));
}

/* ── The decision ─────────────────────────────────────────────────────── */

let decided = false;
let willPlay = false;

/**
 * Play or not — answered once, then latched.
 *
 * The React version read this flag and wrote it inside the same mount effect,
 * which made running that effect twice a different operation from running it
 * once: the second pass found the flag its own first pass had just written and
 * concluded the intro had already played. Latching the answer in a variable
 * means every later caller gets the first answer, whatever storage says by
 * then, so asking again is free and safe.
 */
function shouldPlay(): boolean {
  if (decided) return willPlay;
  decided = true;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let seen = false;
  try {
    seen = window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private browsing, or a file:// origin with opaque storage — which is
    // precisely how this build gets opened. Replaying the intro is a small
    // cost next to not shipping one.
  }

  willPlay = !reduced && !seen;

  if (willPlay) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* see above */
    }
  }

  return willPlay;
}

/* ── Raise, dissolve, remove ──────────────────────────────────────────── */

function open(): void {
  if (phase !== "idle") return;

  // Deliberately not ui.el(): every other id in the shell is a build-time
  // contract worth asserting, but this one element's absence should make the
  // intro decline rather than take the app down with it.
  root = document.getElementById("intro");
  if (!root || !shouldPlay()) {
    phase = "done";
    return;
  }

  // The shell carries these literally so the markup reads as the screen it is,
  // but the brand constant stays the source of truth — the same arrangement
  // panels.ts uses for the header.
  const word = document.getElementById("intro-word");
  const tagline = document.getElementById("intro-tagline");
  if (word) word.textContent = BRAND_NAME;
  // Set in caps and tracked out, where a full stop reads as a typo.
  if (tagline) tagline.textContent = BRAND_TAGLINE.replace(/\.$/, "");

  /**
   * Compose it statically when the timeline cannot advance.
   *
   * CSS animations are no more reliable than requestAnimationFrame in a hidden
   * document, and every element here rests at its finished state with the
   * keyframes animating *into* it — so switching the animations off leaves the
   * composition correct instead of blank. Unlike CinematicMap's camera guard
   * there is nothing to re-sync on `visibilitychange`: that guard has to undo a
   * wrong frame, this one already lands on the right one.
   */
  if (document.hidden) root.classList.add("intro-static");

  root.hidden = false;
  phase = "playing";
  startedAt = Date.now();

  for (const event of IMPATIENCE) {
    window.addEventListener(event, leave, { passive: true });
  }
  document.getElementById("intro-skip")?.addEventListener("click", leave);

  schedule(FAILSAFE_MS, leave);
}

function leave(): void {
  if (phase !== "playing") return;
  phase = "leaving";
  root?.classList.add("intro-leaving");
  schedule(FADE_MS, finish);
}

function finish(): void {
  if (phase === "done") return;
  phase = "done";

  for (const id of timers) clearTimeout(id);
  timers.length = 0;
  for (const event of IMPATIENCE) window.removeEventListener(event, leave);

  root?.remove();
  root = null;

  const done = onDone;
  onDone = undefined;
  done?.();
}

/* ── Interface ────────────────────────────────────────────────────────── */

/**
 * Hand the screen over.
 *
 * Called by main.ts once the first engine pass has landed. The hold is a
 * minimum rather than a delay — AppSplash's rule, that a splash which appears
 * for forty milliseconds and vanishes registers as a flicker and not a brand —
 * so an engine pass slower than the sequence dissolves the moment it arrives,
 * and a faster one waits out the remainder.
 */
export function startIntro(options: IntroOptions = {}): void {
  // Nothing was ever raised: reduced motion, a second load in this session, or
  // a shell without the overlay. The caller's continuation still runs.
  if (phase === "idle" || phase === "done") {
    options.onDone?.();
    return;
  }

  onDone = options.onDone;

  if (phase === "playing" && !handedOff) {
    handedOff = true;
    schedule(Math.max(0, HOLD_MS - (Date.now() - startedAt)), leave);
  }
}

/** Tear it down now, without the dissolve. Safe to call at any point. */
export function endIntro(): void {
  finish();
}

// Raised before main.ts renders anything, and taken down by a timer that does
// not depend on main.ts getting that far. See the header for why this is not
// inside startIntro().
open();
