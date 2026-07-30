/**
 * Copy for the single-file build.
 *
 * Every user-visible string in this build lives here, in one flat dictionary,
 * so that the seven-language layer the Next app already ships (src/lib/i18n)
 * has one place to land rather than a hundred string literals scattered across
 * the render functions.
 *
 * Today there is exactly one locale and `setLocale` does nothing. That is
 * deliberate: the extraction is the hard, mechanical half of the job and it is
 * done, so adding a dictionary later is additive and cannot change what English
 * readers see. `t()` returns the English string byte-for-byte as it was written
 * inline before, which is what makes this a refactor.
 *
 * Interface (owned by this module, imported by map.ts, panels.ts, intro.ts):
 *
 *   t(key, vars?)     the string for `key`, with {placeholders} filled
 *   setLocale(locale) no-op today; will re-point the active dictionary
 *   getLocale()       the active locale
 *   BRAND_NAME        the wordmark, from the shared brand constant
 *
 * Two conventions matter for whoever adds the other six dictionaries:
 *
 *   - Placeholders are `{name}` and are substituted verbatim. `t()` does not
 *     escape; callers escape values that reach innerHTML, using ui.escapeHtml.
 *   - Plurals get one key per form rather than an inline ternary, because the
 *     languages this file is meant for do not all pluralise the way English
 *     does. See `trade.underpass` / `trade.underpasses`.
 */

import { BRAND } from "@/lib/brand";

export type Locale = "en";

export const BRAND_NAME = BRAND.name;
export const BRAND_TAGLINE = BRAND.tagline;

/**
 * English.
 *
 * Grouped by the surface each string appears on. Strings marked "shell" are
 * currently also written literally in shell.html, which stays the source of the
 * static layout; they are recorded here so a locale switch has something to
 * replace them with.
 */
const EN = {
  /* Document and header — shell.html ------------------------------------- */
  "app.title": "दिशाAI — Know the Safest Way Forward",
  "app.description":
    "AI urban flood intelligence for Delhi NCR, in a single file. Risk-based routing, vehicle survivability and explainable predictions.",
  "header.scenarioLabel": "Rainfall scenario",

  /* Status line ---------------------------------------------------------- */
  "status.starting": "Starting…",
  "status.working": "Reading rainfall, drains and elevation…",
  "status.degraded":
    "Running on open data. Official feeds are not connected in this build.",
  "status.live": "Live open data.",
  "status.failed": "Could not start: {error}",

  /* City conditions ------------------------------------------------------ */
  "stats.atRisk": "Roads at risk",
  "stats.impassable": "Impassable",
  "stats.deepest": "Deepest",

  /* Journey planner — shell.html ----------------------------------------- */
  "plan.heading": "Plan a journey",
  "plan.from": "From",
  "plan.to": "To",
  "plan.vehicle": "Vehicle",
  "plan.submit": "Plan this journey",
  "plan.vehicleOption": "{manufacturer} {model} — {clearanceMm} mm",

  /* Route results -------------------------------------------------------- */
  "routes.samePoints": "Pick two different points.",
  "routes.noRoute": "No route could be planned between these two junctions.",
  "routes.fastest": "What a maps app gives you",
  "routes.recommended": "What {brand} recommends",
  "routes.leastDangerous": "Least dangerous route",
  "routes.time": "Time",
  "routes.deepest": "Deepest water",
  "routes.underpasses": "Underpasses",
  "routes.impassableStretches": "Impassable stretches",
  "routes.identicalSafe":
    "Both searches picked the same roads. There is no safer alternative to trade time for, which is good news.",
  "routes.identicalUnsafe":
    "Both searches picked the same roads because every alternative is worse. Changing route cannot fix this journey.",

  /* Why the recommended route costs what it costs ------------------------ */
  "trade.depth": "{extra} minutes more to avoid {depth} cm of water.",
  "trade.underpass": "{extra} minutes more to avoid {count} underpass.",
  "trade.underpasses": "{extra} minutes more to avoid {count} underpasses.",
  "trade.risk": "{extra} minutes more for a measurably lower-risk route.",
  "trade.time": "The recommended route costs {extra} minutes more.",

  /* Road detail ---------------------------------------------------------- */
  "road.heading": "Road detail",
  "road.empty":
    "Select any road on the map to see its modelled depth, timing and failure modes.",
  "road.probability": "Flood probability",
  "road.peakDepth": "Peak depth",
  "road.timeToFlood": "Time to flood",
  "road.recovery": "Recovery",
  "road.elevation": "Elevation",
  "road.blockages": "What goes wrong here",

  /* Map ------------------------------------------------------------------ */
  "map.tooltip": "{probability}% · {depth} cm peak",
  "map.attribution":
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',

  /* Units ---------------------------------------------------------------- */
  "unit.percent": "{value}%",
  "unit.cm": "{value} cm",
  "unit.min": "{value} min",
  "unit.hr": "{value} hr",
  "unit.m": "{value} m",
  /** Shown where the model has no answer at all, rather than a zero. */
  "unit.none": "—",
} as const;

export type MessageKey = keyof typeof EN;

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en: EN };

let locale: Locale = "en";

/**
 * Look up a string and fill its `{placeholders}`.
 *
 * Unknown placeholders are left in place rather than blanked, so a missing
 * variable shows up as `{extra}` on screen instead of silently reading as a
 * complete sentence with a hole in the meaning.
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[locale][key] ?? EN[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * No-op today — there is one dictionary.
 *
 * Kept as a real function so callers can already be written against it, and so
 * the module that adds Hindi, Punjabi, Urdu, Bengali, Bhojpuri and Maithili
 * only has to extend `DICTIONARIES` and re-run the render functions. There is
 * no React here, so a locale change has to redraw rather than re-render.
 */
export function setLocale(next: Locale): void {
  locale = next;
}

export function getLocale(): Locale {
  return locale;
}
