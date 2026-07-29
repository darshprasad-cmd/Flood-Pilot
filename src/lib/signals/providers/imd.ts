import { clamp, stdev } from "@/lib/core/math";
import type { LatLng } from "@/lib/core/types";
import { fetchJson } from "../fetcher";
import type { RainPoint, WeatherCell, WeatherField } from "../types";
import { HORIZON_MIN } from "../weather";
import { env, hasEnv, type ProviderStatus } from "./types";

/**
 * India Meteorological Department adapter.
 *
 * IMD is the authoritative source for rainfall over Delhi — quantitative
 * precipitation forecasts, hourly observed rainfall from the AWS network, and
 * the colour-coded warnings the city's response actually keys off. Its API
 * requires registration, so this adapter activates when `IMD_API_KEY` is set and
 * otherwise reports itself unavailable so the resolver can fall through.
 *
 * `IMD_API_BASE` exists because IMD serves different products from different
 * hosts depending on the access granted; point it at whichever base URL your
 * credential covers without changing code.
 *
 * The response mapper below targets the shape IMD's gridded forecast products
 * use — a station or grid identifier plus time-indexed rainfall arrays. If your
 * credential returns a different envelope, `mapImdPayload` is the single
 * function to adjust.
 */

const DEFAULT_BASE = "https://api.imd.gov.in";

export function imdStatus(): ProviderStatus {
  const available = hasEnv("IMD_API_KEY");
  return {
    id: "imd",
    name: "India Meteorological Department",
    authority: "Ministry of Earth Sciences, Government of India",
    available,
    blockedByCredential: !available,
    envKey: "IMD_API_KEY",
    detail: available
      ? `Connected to ${env("IMD_API_BASE") ?? DEFAULT_BASE}.`
      : "Not connected. IMD requires a registered API key; set IMD_API_KEY to make it the primary rainfall source for Delhi.",
  };
}

/** Colour-coded warning, as IMD issues them. */
export type ImdWarningLevel = "green" | "yellow" | "orange" | "red";

export interface ImdWarning {
  level: ImdWarningLevel;
  headline: string;
  validFrom: string;
  validTo: string;
  district: string;
}

interface ImdForecastPayload {
  station?: string;
  latitude?: number;
  longitude?: number;
  /** ISO timestamps aligned with the rainfall arrays. */
  time?: string[];
  /** Rainfall in mm for each interval. */
  rainfall_mm?: (number | null)[];
  /** Intensity in mm/hr, when the product supplies it directly. */
  intensity_mm_hr?: (number | null)[];
  probability?: (number | null)[];
  temperature_c?: number;
  humidity_pct?: number;
  warnings?: ImdWarning[];
}

export interface ImdResult {
  field: WeatherField;
  warnings: ImdWarning[];
}

/**
 * Fetch the IMD rainfall field for a set of grid points.
 *
 * Returns `null` when IMD is not configured or does not answer, which is the
 * signal for the resolver to fall through to the next provider rather than fail.
 */
export async function fetchImdRainfall(
  points: LatLng[],
  now: Date = new Date(),
): Promise<ImdResult | null> {
  const key = env("IMD_API_KEY");
  if (!key) return null;

  const base = env("IMD_API_BASE") ?? DEFAULT_BASE;
  const results: WeatherCell[] = [];
  const warnings: ImdWarning[] = [];

  for (const point of points) {
    const url =
      `${base.replace(/\/$/, "")}/forecast/rainfall` +
      `?lat=${point.lat.toFixed(4)}&lon=${point.lng.toFixed(4)}` +
      `&hours=${Math.round(HORIZON_MIN / 60)}`;

    const res = await fetchJson<ImdForecastPayload>(url, {
      revalidate: 600,
      timeoutMs: 7000,
      label: "imd/forecast",
      headers: { Authorization: `Bearer ${key}`, "X-API-Key": key },
    });

    if (!res.ok || !res.data) return null;

    const cell = mapImdPayload(point, res.data, now);
    if (!cell) return null;
    results.push(cell);

    for (const w of res.data.warnings ?? []) {
      if (!warnings.some((existing) => existing.headline === w.headline)) {
        warnings.push(w);
      }
    }
  }

  return {
    field: {
      provenance: {
        source: "imd/forecast",
        kind: "forecast",
        fetchedAt: now.toISOString(),
        // The authoritative source for Indian rainfall, and the one the city's
        // own response is keyed to.
        reliability: 0.93,
        live: true,
        note: `India Meteorological Department quantitative precipitation forecast, ${points.length} grid points.`,
      },
      issuedAt: now.toISOString(),
      cells: results,
      spatialVarianceMmHr: stdev(results.map((c) => c.peakIntensityMmHr)),
    },
    warnings,
  };
}

/**
 * Map an IMD payload onto the engine's weather cell.
 *
 * Adjust here — and only here — if your IMD product returns a different envelope.
 */
export function mapImdPayload(
  at: LatLng,
  payload: ImdForecastPayload,
  now: Date,
): WeatherCell | null {
  const times = payload.time;
  if (!times || times.length === 0) return null;

  const nowMs = now.getTime();
  const intervalMin =
    times.length > 1
      ? Math.max(15, (Date.parse(times[1]) - Date.parse(times[0])) / 60_000)
      : 60;

  const curve: RainPoint[] = [];
  for (let i = 0; i < times.length; i++) {
    const startMin = (Date.parse(times[i]) - nowMs) / 60_000;
    if (startMin < -intervalMin || startMin > HORIZON_MIN) continue;

    const mmPerHr =
      payload.intensity_mm_hr?.[i] ??
      ((payload.rainfall_mm?.[i] ?? 0) * 60) / intervalMin;

    curve.push({
      minutesFromNow: Math.max(0, Math.round(startMin)),
      mmPerHr: Math.max(0, mmPerHr),
      probability: clamp((payload.probability?.[i] ?? 60) / 100),
    });
  }

  if (curve.length === 0) return null;

  const window = (fromMin: number, toMin: number) =>
    curve
      .filter((p) => p.minutesFromNow >= fromMin && p.minutesFromNow < toMin)
      .reduce((sum, p) => sum + (p.mmPerHr * intervalMin) / 60, 0);

  const peak = curve.reduce((best, p) => (p.mmPerHr > best.mmPerHr ? p : best), curve[0]);

  return {
    at,
    tempC: payload.temperature_c ?? 28,
    humidity: payload.humidity_pct ?? 75,
    currentRainMmHr: curve[0]?.mmPerHr ?? 0,
    curve,
    accum1hMm: window(0, 60),
    accum3hMm: window(0, 180),
    accum6hMm: window(0, 360),
    accum24hMm: window(0, 1440),
    past24hMm: 0,
    peakIntensityMmHr: peak.mmPerHr,
    peakInMin: peak.mmPerHr > 0.6 ? peak.minutesFromNow : null,
    eventTotalMm: window(0, HORIZON_MIN),
  };
}

/** Map an IMD warning colour onto how much it should raise modelled risk. */
export function warningRiskFloor(level: ImdWarningLevel): number {
  switch (level) {
    case "red":
      return 0.75;
    case "orange":
      return 0.55;
    case "yellow":
      return 0.35;
    default:
      return 0;
  }
}
