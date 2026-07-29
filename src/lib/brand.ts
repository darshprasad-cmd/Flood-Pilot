/**
 * दिशाAI — brand constants.
 *
 * "दिशा" (disha) is Hindi for direction: not merely a heading, but the right
 * path. Paired with AI it says what the product is in two syllables — an
 * intelligence that tells you which way to go — in a word most of the people
 * this is built for already know.
 *
 * The name lives here rather than in a hundred string literals so that a
 * rebrand is a one-file change, and so that the Devanagari and Latin halves
 * can be typeset separately: they need different fonts and different optical
 * sizes to sit level with each other.
 */
export const BRAND = {
  /** Devanagari half of the wordmark. */
  script: "दिशा",
  /** Latin half. */
  suffix: "AI",
  /** Full name, for prose, metadata and titles. */
  name: "दिशाAI",
  /**
   * Latin-only fallback.
   *
   * Used where Devanagari cannot be relied on to render — OS install prompts,
   * PWA shortcut labels on older Android, plain-text export. Never shown next
   * to the real wordmark; a brand that spells itself two ways on one screen
   * looks like two brands.
   */
  latin: "DishaAI",
  tagline: "Know the Safest Way Forward.",
  taglineAlt: "AI Urban Intelligence.",
  /** One line explaining the name, for first-run and the about page. */
  meaning:
    "दिशा means direction — not just which way, but the right way.",
  city: "Delhi NCR",
  repo: "https://github.com/darshprasad-cmd/Flood-Pilot",
} as const;
