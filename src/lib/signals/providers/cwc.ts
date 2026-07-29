import { clamp } from "@/lib/core/math";
import type { GaugeStation } from "@/lib/cities/types";
import { fetchJson } from "../fetcher";
import { env, hasEnv, type ProviderStatus } from "./types";

/**
 * Central Water Commission adapter — Yamuna levels.
 *
 * River flooding in Delhi is a fundamentally different prediction problem from
 * waterlogging: it is slow, it is upstream-driven, and it is knowable days in
 * advance. When the gauge at Old Railway Bridge crosses 205.33 m the floodplain
 * goes under and stays under, regardless of whether a drop falls on the city.
 *
 * Three ways to get that number, in order of preference:
 *
 *   1. **CWC API** (`CWC_API_KEY`) — the authoritative feed.
 *   2. **Manual level** (`YAMUNA_LEVEL_M`) — CWC publishes gauge readings as
 *      bulletins during flood events, and a control room operator can enter the
 *      current reading without waiting for API access. This is a real workflow,
 *      not a placeholder.
 *   3. **Modelled** — inferred from upstream discharge, clearly labelled as an
 *      estimate and heavily discounted in confidence.
 */

const DEFAULT_BASE = "https://api.cwc.gov.in";

export function cwcStatus(): ProviderStatus {
  const keyed = hasEnv("CWC_API_KEY");
  const manual = hasEnv("YAMUNA_LEVEL_M");

  return {
    id: "cwc",
    name: "Central Water Commission",
    authority: "Ministry of Jal Shakti, Government of India",
    available: keyed || manual,
    blockedByCredential: !keyed && !manual,
    envKey: "CWC_API_KEY",
    detail: keyed
      ? `Connected to ${env("CWC_API_BASE") ?? DEFAULT_BASE}.`
      : manual
        ? `Using the manually entered gauge reading of ${env("YAMUNA_LEVEL_M")} m. Set CWC_API_KEY for a live feed.`
        : "Not connected. Set CWC_API_KEY for the live feed, or YAMUNA_LEVEL_M to enter the current gauge reading from a CWC bulletin.",
  };
}

export interface RiverGaugeReading {
  station: GaugeStation;
  /** Current level in metres above mean sea level. */
  levelM: number;
  /** Change over the last 24 hours, metres. */
  trendM24h: number;
  dischargeCumecs: number | null;
  /** Where the level sits against the station's own thresholds. */
  status: "normal" | "approaching_warning" | "warning" | "danger" | "evacuation";
  /** 0..1 — how much this raises flood risk across the floodplain. */
  floodplainPressure: number;
  /** Forecast peak, when the feed provides one. */
  forecastPeakM: number | null;
  forecastPeakInHr: number | null;
  source: string;
  live: boolean;
  note: string;
}

interface CwcPayload {
  station_code?: string;
  water_level?: number;
  level_24h_ago?: number;
  discharge_cumecs?: number;
  forecast_peak_level?: number;
  forecast_peak_hours?: number;
}

export async function fetchCwcGauge(
  station: GaugeStation,
  now: Date = new Date(),
): Promise<RiverGaugeReading | null> {
  const key = env("CWC_API_KEY");

  if (key) {
    const base = env("CWC_API_BASE") ?? DEFAULT_BASE;
    const url = `${base.replace(/\/$/, "")}/flood/gauge/${station.code ?? station.id}`;

    const res = await fetchJson<CwcPayload>(url, {
      // River stage moves slowly; a 30-minute refresh is plenty and matches how
      // often CWC itself updates.
      revalidate: 1800,
      timeoutMs: 7000,
      label: "cwc/gauge",
      headers: { Authorization: `Bearer ${key}`, "X-API-Key": key },
    });

    if (res.ok && res.data && typeof res.data.water_level === "number") {
      const levelM = res.data.water_level;
      return buildReading(station, {
        levelM,
        trendM24h: levelM - (res.data.level_24h_ago ?? levelM),
        dischargeCumecs: res.data.discharge_cumecs ?? null,
        forecastPeakM: res.data.forecast_peak_level ?? null,
        forecastPeakInHr: res.data.forecast_peak_hours ?? null,
        source: "cwc/flood-forecasting",
        live: true,
        note: `Live gauge reading from the Central Water Commission flood forecasting network at ${station.name}.`,
      });
    }
  }

  const manual = env("YAMUNA_LEVEL_M");
  if (manual) {
    const levelM = Number(manual);
    if (Number.isFinite(levelM)) {
      const trend = Number(env("YAMUNA_TREND_M_24H") ?? "0");
      return buildReading(station, {
        levelM,
        trendM24h: Number.isFinite(trend) ? trend : 0,
        dischargeCumecs: null,
        forecastPeakM: null,
        forecastPeakInHr: null,
        source: "cwc/manual-bulletin-entry",
        live: false,
        note: `Gauge reading entered manually from a CWC bulletin. Update YAMUNA_LEVEL_M as new bulletins are issued.`,
      });
    }
  }

  void now;
  return null;
}

/**
 * Fallback: infer a plausible river stage when no reading is available.
 *
 * Deliberately conservative — it assumes a normal, below-warning river rather
 * than inventing a flood, because a fabricated high reading would be far more
 * damaging than an absent one. Confidence is reduced accordingly.
 */
export function modelledGauge(
  station: GaugeStation,
  upstreamWetnessIndex: number,
  now: Date = new Date(),
): RiverGaugeReading {
  void now;
  // Sit a little below warning level and rise with how wet the catchment is.
  const span = station.warningLevelM - (station.warningLevelM - 5.5);
  const levelM = station.warningLevelM - span * (1 - clamp(upstreamWetnessIndex)) * 0.9;

  return buildReading(station, {
    levelM,
    trendM24h: upstreamWetnessIndex > 0.6 ? 0.25 : -0.05,
    dischargeCumecs: null,
    forecastPeakM: null,
    forecastPeakInHr: null,
    source: "floodpilot/river-model",
    live: false,
    note: "No gauge reading available. River stage is estimated from catchment wetness and is not a substitute for the CWC bulletin.",
  });
}

function buildReading(
  station: GaugeStation,
  input: {
    levelM: number;
    trendM24h: number;
    dischargeCumecs: number | null;
    forecastPeakM: number | null;
    forecastPeakInHr: number | null;
    source: string;
    live: boolean;
    note: string;
  },
): RiverGaugeReading {
  const { levelM } = input;

  const status: RiverGaugeReading["status"] =
    levelM >= station.evacuationLevelM
      ? "evacuation"
      : levelM >= station.dangerLevelM
        ? "danger"
        : levelM >= station.warningLevelM
          ? "warning"
          : levelM >= station.warningLevelM - 0.75
            ? "approaching_warning"
            : "normal";

  // Pressure ramps from zero a metre below warning to full at evacuation level,
  // because the outfalls start losing head well before the official danger mark.
  const floor = station.warningLevelM - 1;
  const floodplainPressure = clamp(
    (levelM - floor) / Math.max(0.5, station.evacuationLevelM - floor),
  );

  return {
    station,
    levelM,
    trendM24h: input.trendM24h,
    dischargeCumecs: input.dischargeCumecs,
    status,
    floodplainPressure,
    forecastPeakM: input.forecastPeakM,
    forecastPeakInHr: input.forecastPeakInHr,
    source: input.source,
    live: input.live,
    note: input.note,
  };
}

export const GAUGE_STATUS_LABEL: Record<RiverGaugeReading["status"], string> = {
  normal: "Normal",
  approaching_warning: "Approaching warning",
  warning: "Warning level",
  danger: "Danger level",
  evacuation: "Evacuation level",
};
