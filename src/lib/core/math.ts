import type { LatLng } from "./types";

export function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Where does `v` sit between `a` and `b`, clamped to 0..1? */
export function invLerp(a: number, b: number, v: number): number {
  if (a === b) return 0;
  return clamp((v - a) / (b - a));
}

export function sigmoid(x: number): number {
  // Guard against overflow for large |x|.
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

export function logit(p: number): number {
  const q = clamp(p, 1e-6, 1 - 1e-6);
  return Math.log(q / (1 - q));
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function round(v: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length in metres of a polyline. */
export function polylineLengthM(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1], points[i]);
  }
  return total;
}

export function midpoint(points: LatLng[]): LatLng {
  if (points.length === 0) return { lat: 0, lng: 0 };
  return {
    lat: mean(points.map((p) => p.lat)),
    lng: mean(points.map((p) => p.lng)),
  };
}

/**
 * Inverse-distance-weighted sample of a scattered field.
 *
 * Rainfall varies a lot across a large city, so we fetch a coarse grid of
 * forecast cells and interpolate between them rather than pretending one city
 * centroid describes every road.
 */
export function interpolateIDW<T>(
  at: LatLng,
  cells: { at: LatLng; value: T }[],
  extract: (value: T) => number,
  power = 2,
): number {
  if (cells.length === 0) return 0;

  let weightSum = 0;
  let valueSum = 0;

  for (const cell of cells) {
    const d = haversineM(at, cell.at);
    // Sitting essentially on top of a cell: take it directly.
    if (d < 50) return extract(cell.value);
    const w = 1 / d ** power;
    weightSum += w;
    valueSum += w * extract(cell.value);
  }

  return weightSum === 0 ? 0 : valueSum / weightSum;
}

/** Nearest cell in a scattered field. */
export function nearest<T>(
  at: LatLng,
  cells: { at: LatLng; value: T }[],
): { value: T; distanceM: number } | null {
  let best: { value: T; distanceM: number } | null = null;
  for (const cell of cells) {
    const d = haversineM(at, cell.at);
    if (!best || d < best.distanceM) best = { value: cell.value, distanceM: d };
  }
  return best;
}

/**
 * Deterministic pseudo-random number in [0, 1) derived from a string.
 *
 * Simulated signals must be stable — a road cannot have a different "traffic
 * density" every time the page is refreshed, or nothing in the product would be
 * reproducible or debuggable.
 */
export function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // xorshift finalise for better spread
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Deterministic value in [lo, hi] from a seed. */
export function hashRange(seed: string, lo: number, hi: number): number {
  return lo + hashUnit(seed) * (hi - lo);
}
