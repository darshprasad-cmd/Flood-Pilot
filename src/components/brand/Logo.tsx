import { BRAND } from "@/lib/brand";

/**
 * The दिशाAI mark.
 *
 * A compass: a bezel, four ticks, and a needle whose north half is signal blue
 * and south half aqua. Direction is the idea the name carries, so the mark
 * carries it too — and a compass survives being 16 px in a browser tab, which
 * a droplet with a road through it does not.
 *
 * The gradient ids are fixed rather than generated with `useId`, because this
 * renders inside Server Components where hooks are unavailable. Duplicate ids
 * across instances are harmless here: every instance defines the identical
 * gradient, so whichever one the browser resolves to is the right one.
 */
export function Mark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label={BRAND.latin}
    >
      <defs>
        <linearGradient id="disha-n" x1="16" y1="4" x2="20" y2="16">
          <stop offset="0" stopColor="#8fd0ff" />
          <stop offset="1" stopColor="#2b8cf0" />
        </linearGradient>
        <linearGradient id="disha-s" x1="16" y1="28" x2="12" y2="16">
          <stop offset="0" stopColor="#35d6d6" stopOpacity="0.85" />
          <stop offset="1" stopColor="#1d6fd0" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* Bezel */}
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />

      {/* Cardinal ticks — enough structure to read as an instrument */}
      <g stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round">
        <path d="M16 1.6v2.6" />
        <path d="M16 27.8v2.6" />
        <path d="M1.6 16h2.6" />
        <path d="M27.8 16h2.6" />
      </g>

      {/* Needle, tilted off true north so it reads as pointing somewhere */}
      <g transform="rotate(24 16 16)">
        <path d="M16 5.4 20.2 16 16 14.1Z" fill="url(#disha-n)" />
        <path d="M16 5.4 11.8 16 16 14.1Z" fill="url(#disha-n)" fillOpacity="0.62" />
        <path d="M16 26.6 11.8 16 16 17.9Z" fill="url(#disha-s)" />
        <path d="M16 26.6 20.2 16 16 17.9Z" fill="url(#disha-s)" fillOpacity="0.5" />
      </g>

      <circle cx="16" cy="16" r="1.5" fill="#05070b" stroke="currentColor" strokeOpacity="0.5" />
    </svg>
  );
}

/**
 * The wordmark: दिशा set in Devanagari, AI set in Latin.
 *
 * Two scripts on one baseline never agree by default. Devanagari hangs from
 * its shirorekha rather than sitting on a baseline, so the Latin half is
 * nudged and optically reduced until the two read as one word instead of two
 * words that happen to touch.
 */
export function Wordmark({
  size = 15,
  className = "",
  tone = "default",
}: {
  size?: number;
  className?: string;
  tone?: "default" | "muted";
}) {
  return (
    <span
      className={`inline-flex items-baseline whitespace-nowrap font-semibold tracking-tight ${
        tone === "muted" ? "text-fg-muted" : "text-fg"
      } ${className}`}
      style={{ fontSize: size }}
      // The mark is a name, not a sentence: keep it out of translation and
      // out of the RTL flip, and give screen readers something pronounceable.
      dir="ltr"
      translate="no"
      aria-label={BRAND.latin}
    >
      <span
        aria-hidden
        style={{
          fontFamily: '"Noto Sans Devanagari", var(--font-sans)',
          fontSize: "1.02em",
          lineHeight: 1,
        }}
      >
        {BRAND.script}
      </span>
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.94em",
          letterSpacing: "-0.01em",
          marginInlineStart: "0.04em",
          lineHeight: 1,
        }}
      >
        {BRAND.suffix}
      </span>
    </span>
  );
}

/** Mark and wordmark together — the lockup used in every header. */
export function Lockup({
  size = 15,
  markSize,
  className = "",
}: {
  size?: number;
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark size={markSize ?? Math.round(size * 1.4)} className="text-fg-muted" />
      <Wordmark size={size} />
    </span>
  );
}
