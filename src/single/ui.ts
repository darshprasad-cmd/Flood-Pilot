/**
 * Shared DOM and formatting helpers for the single-file build.
 *
 * Deliberately small and dependency-free: nothing here knows about the flood
 * engine, about Leaflet, or about the shell's layout. It exists so the four
 * rendering modules escape HTML the same way and round numbers the same way,
 * instead of each growing its own copy — the same argument the file's header
 * makes about not being a second implementation, applied one level down.
 *
 * Interface (owned by this module, imported by map.ts, panels.ts, intro.ts):
 *
 *   el(id)          element by id, typed
 *   maybeEl(id)     the same, but nullable, for elements the shell may not have
 *   select(id)      element by id, narrowed to <select>
 *   queryAll(sel)   every match, as a real array
 *   whenReady(fn)   run now if the document is parsed, else on DOMContentLoaded
 *   escapeHtml(s)   for any value interpolated into an innerHTML string
 *   optionsHtml(xs) an <option> list for the shell's selects
 *   percent(p)      0..1 → "42%"
 *   fixed0(n)       number → whole-number string, no unit
 *   pluralise(n, one, many)
 *   COLORS          the handful of hard-coded strokes the shell's CSS variables
 *                   do not cover, because Leaflet needs literal colour strings
 */

/**
 * Element by id.
 *
 * shell.html's markup is the contract for every module here; a missing id is a
 * build error rather than a runtime condition worth handling, so this asserts
 * rather than returning null.
 */
export const el = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

/**
 * Element by id, or null.
 *
 * The counterpart to `el` for the parts of the shell that are genuinely
 * optional — the language control is not present in every build of the layout,
 * and a missing one should cost the page nothing.
 */
export const maybeEl = <T extends HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

/** Narrowed accessor for the selects the shell declares. */
export const select = (id: string): HTMLSelectElement => el<HTMLSelectElement>(id);

/** Every match as an array, so callers can map and filter over the result. */
export const queryAll = <T extends Element>(selector: string): T[] =>
  Array.from(document.querySelectorAll<T>(selector));

/**
 * Run once the shell's markup exists.
 *
 * The bundle is the last element in <body>, so the common case is that the
 * document is already parsed and `fn` runs synchronously — which matters,
 * because the modules that localise the page have to finish before the first
 * render rather than a frame after it. The listener is only for the case where
 * the script is moved or deferred.
 */
export function whenReady(fn: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
    return;
  }
  fn();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Builds an `<option>` list. Values are ids, labels are user-visible text. */
export function optionsHtml(items: { value: string; label: string }[]): string {
  return items
    .map((item) => `<option value="${item.value}">${escapeHtml(item.label)}</option>`)
    .join("");
}

/** 0..1 probability as a whole-number percentage, without the sign. */
export const percent = (probability: number): number => Math.round(probability * 100);

/** Whole-number string for a measured quantity — centimetres, metres, minutes. */
export const fixed0 = (value: number): string => value.toFixed(0);

/**
 * Picks between two forms.
 *
 * Generic over the two arguments so it can choose between message *keys* as
 * well as words — which is what callers should do, because the languages this
 * file is meant for do not all split at one.
 */
export const pluralise = <T extends string>(count: number, one: T, many: T): T =>
  count === 1 ? one : many;

/**
 * Literal colours.
 *
 * Leaflet paints into SVG attributes rather than CSS classes, so the strokes
 * cannot come from the shell's custom properties. The route-card borders reuse
 * the same values so a card and its polyline always agree.
 */
export const COLORS = {
  /** The time-only route, and the "some roads at risk" stat. */
  fastest: "#f08a3c",
  /** The recommended route, and a clear stat. */
  safe: "#2fbf6f",
  /** A route that cannot be made safely, and the impassable stat. */
  danger: "#e8503a",
  /** Default stat figure, matching --fg. */
  neutral: "#e9eef7",
  /** Dark casing drawn under every road, matching --ink-950. */
  casing: "#05070b",
} as const;
