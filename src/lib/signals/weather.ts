import { clamp, hashRange, stdev } from "@/lib/core/math";
import type { LatLng, SignalProvenance } from "@/lib/core/types";
import { asArray, fetchJson, parseUtc } from "./fetcher";
import { SCENARIOS, type ScenarioId } from "./scenarios";
import type { RainPoint, WeatherCell, WeatherField } from "./types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** How far ahead the engine reasons. */
export const HORIZON_MIN = 12 * 60;

interface OpenMeteoForecast {
  latitude: number;
  longitude: number;
  current?: {
    time: string;
    precipitation?: number;
    temperature_2m?: number;
    relative_humidity_2m?: number;
  };
  minutely_15?: { time: string[]; precipitation?: (number | null)[] };
  hourly?: {
    time: string[];
    precipitation?: (number | null)[];
    precipitation_probability?: (number | null)[];
  };
}

/** A rainfall interval normalised to minutes-from-now. */
interface Interval {
  startMin: number;
  endMin: number;
  mm: number;
  probability: number;
}

/* -------------------------------------------------------------------------- */
/*  Live fetch                                                                */
/* -------------------------------------------------------------------------- */

export async function fetchWeatherField(
  points: LatLng[],
  scenario: ScenarioId,
  now: Date = new Date(),
): Promise<WeatherField> {
  if (scenario !== "live") {
    return simulateField(points, scenario, now);
  }

  const url =
    `${FORECAST_URL}?latitude=${points.map((p) => p.lat.toFixed(4)).join(",")}` +
    `&longitude=${points.map((p) => p.lng.toFixed(4)).join(",")}` +
    `&current=precipitation,temperature_2m,relative_humidity_2m` +
    `&minutely_15=precipitation` +
    `&hourly=precipitation,precipitation_probability` +
    `&past_days=1&forecast_days=2&timezone=GMT`;

  // 10 minutes: shorter than this wastes upstream quota, longer than this and a
  // fast-developing cell would be stale by the time anyone acted on it.
  const res = await fetchJson<OpenMeteoForecast | OpenMeteoForecast[]>(url, {
    revalidate: 600,
    timeoutMs: 6500,
    label: "open-meteo/forecast",
  });

  const payloads = asArray(res.data);
  if (!res.ok || payloads.length !== points.length) {
    const fallback = simulateField(points, "monsoon-evening", now);
    return {
      ...fallback,
      provenance: {
        source: "open-meteo/forecast",
        kind: "modelled",
        fetchedAt: now.toISOString(),
        reliability: 0.35,
        live: false,
        note:
          res.error ??
          "Live forecast unavailable; falling back to a modelled monsoon cell.",
      },
    };
  }

  const nowMs = now.getTime();
  const cells = payloads.map((payload, i) =>
    buildCell(points[i], payload, nowMs),
  );

  return {
    provenance: {
      source: "open-meteo/forecast",
      kind: "forecast",
      fetchedAt: now.toISOString(),
      reliability: 0.86,
      live: true,
      note: `Global weather model, ${points.length} grid cells, ${res.latencyMs}ms.`,
    },
    issuedAt: now.toISOString(),
    cells,
    spatialVarianceMmHr: stdev(cells.map((c) => c.peakIntensityMmHr)),
  };
}

function buildCell(
  at: LatLng,
  payload: OpenMeteoForecast,
  nowMs: number,
): WeatherCell {
  const intervals: Interval[] = [];

  // Hourly first. Open-Meteo stamps an interval by its *end*, so a value at
  // 14:00 describes 13:00-14:00.
  const hourly = payload.hourly;
  if (hourly?.time) {
    for (let i = 0; i < hourly.time.length; i++) {
      const endMin = (parseUtc(hourly.time[i]) - nowMs) / 60_000;
      intervals.push({
        startMin: endMin - 60,
        endMin,
        mm: hourly.precipitation?.[i] ?? 0,
        probability: (hourly.precipitation_probability?.[i] ?? 0) / 100,
      });
    }
  }

  // Where 15-minute data exists it supersedes the hour it sits inside — near-term
  // intensity is what decides whether you have 20 minutes or 2 hours.
  const fine = payload.minutely_15;
  const fineIntervals: Interval[] = [];
  if (fine?.time) {
    for (let i = 0; i < fine.time.length; i++) {
      const endMin = (parseUtc(fine.time[i]) - nowMs) / 60_000;
      fineIntervals.push({
        startMin: endMin - 15,
        endMin,
        mm: fine.precipitation?.[i] ?? 0,
        probability: 0,
      });
    }
  }

  const fineCoverEnd = fineIntervals.length
    ? Math.max(...fineIntervals.map((f) => f.endMin))
    : -Infinity;
  const fineCoverStart = fineIntervals.length
    ? Math.min(...fineIntervals.map((f) => f.startMin))
    : Infinity;

  const merged: Interval[] = [
    ...fineIntervals.map((f) => ({
      ...f,
      probability: probabilityAt(intervals, f.startMin),
    })),
    ...intervals.filter(
      (h) => h.endMin <= fineCoverStart || h.startMin >= fineCoverEnd,
    ),
  ].sort((a, b) => a.startMin - b.startMin);

  const future = merged.filter((iv) => iv.endMin > 0 && iv.startMin < HORIZON_MIN);
  const curve: RainPoint[] = future.map((iv) => ({
    minutesFromNow: Math.max(0, Math.round(iv.startMin)),
    mmPerHr: (iv.mm * 60) / Math.max(1, iv.endMin - iv.startMin),
    probability: clamp(iv.probability),
  }));

  const peak = curve.reduce<RainPoint | null>(
    (best, p) => (!best || p.mmPerHr > best.mmPerHr ? p : best),
    null,
  );

  return {
    at,
    tempC: payload.current?.temperature_2m ?? 24,
    humidity: payload.current?.relative_humidity_2m ?? 70,
    currentRainMmHr: payload.current?.precipitation ?? 0,
    curve,
    accum1hMm: accumulate(merged, 0, 60),
    accum3hMm: accumulate(merged, 0, 180),
    accum6hMm: accumulate(merged, 0, 360),
    accum24hMm: accumulate(merged, 0, 1440),
    past24hMm: accumulate(merged, -1440, 0),
    peakIntensityMmHr: peak?.mmPerHr ?? 0,
    peakInMin: peak && peak.mmPerHr > 0.6 ? peak.minutesFromNow : null,
    eventTotalMm: accumulate(merged, 0, HORIZON_MIN),
  };
}

function probabilityAt(hourly: Interval[], atMin: number): number {
  const hit = hourly.find((h) => atMin >= h.startMin && atMin < h.endMin);
  return hit?.probability ?? 0;
}

/** Rainfall in mm falling between two minute offsets, splitting partial intervals. */
function accumulate(intervals: Interval[], fromMin: number, toMin: number): number {
  let total = 0;
  for (const iv of intervals) {
    const overlap =
      Math.min(iv.endMin, toMin) - Math.max(iv.startMin, fromMin);
    if (overlap <= 0) continue;
    const span = Math.max(1, iv.endMin - iv.startMin);
    total += iv.mm * (overlap / span);
  }
  return total;
}

/* -------------------------------------------------------------------------- */
/*  Simulation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Build a rainfall field from a scenario profile.
 *
 * The storm is a Gaussian pulse in time with a per-cell intensity multiplier, so
 * rain arrives at slightly different strengths across the city the way real
 * convective cells do. Everything is derived from the seed, so the same scenario
 * always produces the same field — predictions have to be reproducible.
 */
function simulateField(
  points: LatLng[],
  scenario: ScenarioId,
  now: Date,
): WeatherField {
  const profile = SCENARIOS[scenario];
  const cells = points.map((at, i) => simulateCell(at, i, scenario, now));

  return {
    provenance: {
      source: `floodpilot/scenario:${scenario}`,
      kind: "modelled",
      fetchedAt: now.toISOString(),
      reliability: scenario === "clear" ? 0.6 : 0.5,
      live: false,
      note: `Simulated scenario — ${profile.label}. Not a real forecast.`,
    },
    issuedAt: now.toISOString(),
    cells,
    spatialVarianceMmHr: stdev(cells.map((c) => c.peakIntensityMmHr)),
  };
}

function simulateCell(
  at: LatLng,
  index: number,
  scenario: ScenarioId,
  now: Date,
): WeatherCell {
  const profile = SCENARIOS[scenario];
  const seed = `${scenario}:${index}:${at.lat.toFixed(3)}`;

  if (profile.peakMmPerHr === 0) {
    return {
      at,
      tempC: 26,
      humidity: 52,
      currentRainMmHr: 0,
      curve: buildFlatCurve(),
      accum1hMm: 0,
      accum3hMm: 0,
      accum6hMm: 0,
      accum24hMm: 0,
      past24hMm: 0,
      peakIntensityMmHr: 0,
      peakInMin: null,
      eventTotalMm: 0,
    };
  }

  // Convective cells are patchy: one side of the city gets a third of what the
  // other side gets.
  const intensityScale = hashRange(`${seed}:i`, 0.55, 1.35);
  const arrivalShift = hashRange(`${seed}:t`, -12, 18);
  const peakAt = Math.max(5, profile.peakInMin + arrivalShift);
  const sigma = profile.durationMin / 4.2;
  const peakMm = profile.peakMmPerHr * intensityScale;

  const curve: RainPoint[] = [];
  for (let m = 0; m <= HORIZON_MIN; m += 15) {
    const mmPerHr = peakMm * Math.exp(-((m - peakAt) ** 2) / (2 * sigma ** 2));
    curve.push({
      minutesFromNow: m,
      mmPerHr: mmPerHr < 0.15 ? 0 : mmPerHr,
      probability: clamp(0.25 + (mmPerHr / Math.max(1, peakMm)) * 0.7),
    });
  }

  const window = (fromMin: number, toMin: number) =>
    curve
      .filter((p) => p.minutesFromNow >= fromMin && p.minutesFromNow < toMin)
      .reduce((sum, p) => sum + (p.mmPerHr * 15) / 60, 0);

  const currentRain = curve[0]?.mmPerHr ?? 0;

  return {
    at,
    tempC: 23.5,
    humidity: 89,
    currentRainMmHr: currentRain,
    curve,
    accum1hMm: window(0, 60),
    accum3hMm: window(0, 180),
    accum6hMm: window(0, 360),
    accum24hMm: window(0, 1440),
    // Scenarios assume a wet antecedent week — that is when cities flood.
    past24hMm: hashRange(`${seed}:p`, 4, 26),
    peakIntensityMmHr: peakMm,
    peakInMin: Math.round(peakAt),
    eventTotalMm: window(0, HORIZON_MIN),
  };
}

function buildFlatCurve(): RainPoint[] {
  const curve: RainPoint[] = [];
  for (let m = 0; m <= HORIZON_MIN; m += 15) {
    curve.push({ minutesFromNow: m, mmPerHr: 0, probability: 0.02 });
  }
  return curve;
}

/* -------------------------------------------------------------------------- */

export function weatherProvenance(field: WeatherField): SignalProvenance {
  return field.provenance;
}
