import { clamp, hashRange } from "@/lib/core/math";
import type { RoadClass } from "@/lib/graph/types";
import type { TrafficField, TrafficReading } from "./types";

interface TrafficInput {
  id: string;
  roadClass: RoadClass;
  lanes: number;
  speedLimitKph: number;
}

/**
 * Traffic density.
 *
 * There is no keyless real-time traffic feed, so this is modelled — but modelled
 * on the things that actually drive congestion rather than a random number:
 * time of day, day of week, road class, and rainfall. The provenance says
 * "modelled" and the confidence layer discounts it accordingly.
 *
 * Swapping in a real feed (Google Roads, TomTom, HERE, or a city's own ANPR
 * counts) means replacing this one function.
 */
export function buildTrafficField(
  segments: TrafficInput[],
  now: Date,
  rainMmPerHr: number,
  timezoneOffsetMin: number,
): TrafficField {
  const local = new Date(now.getTime() + timezoneOffsetMin * 60_000);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  const day = local.getUTCDay(); // 0 = Sunday

  const base = diurnalCurve(hour, day);

  // Rain reliably makes congestion worse before any road actually floods —
  // people slow down, two-wheelers shelter under flyovers, and capacity drops.
  const rainSurcharge = clamp(rainMmPerHr / 30) * 0.28;

  const bySegment: Record<string, TrafficReading> = {};

  for (const seg of segments) {
    const appeal = CLASS_LOAD[seg.roadClass];
    const idiosyncrasy = hashRange(`traffic:${seg.id}`, -0.1, 0.14);
    const laneRelief = clamp((seg.lanes - 2) * 0.045, 0, 0.16);

    const density = clamp(base * appeal + rainSurcharge + idiosyncrasy - laneRelief);

    // Speed collapses non-linearly as density approaches saturation.
    const delayFactor = 1 + 2.6 * density ** 2.1;
    const meanSpeedKph = Math.max(6, seg.speedLimitKph / delayFactor);

    bySegment[seg.id] = {
      segmentId: seg.id,
      density,
      delayFactor,
      meanSpeedKph,
    };
  }

  return {
    provenance: {
      source: "floodpilot/traffic-model",
      kind: "modelled",
      fetchedAt: now.toISOString(),
      reliability: 0.55,
      live: false,
      note: "Congestion is modelled from time of day, road class and rainfall — not a live traffic feed.",
    },
    bySegment,
  };
}

/** Relative load a road class carries at peak. */
const CLASS_LOAD: Record<RoadClass, number> = {
  highway: 0.92,
  ring: 1.0,
  arterial: 0.95,
  collector: 0.72,
  local: 0.48,
  service: 0.36,
};

/**
 * Two sharp weekday peaks, a flatter and later weekend profile.
 * Returns roughly 0.1 (empty streets) to 1.0 (peak-hour saturation).
 */
function diurnalCurve(hour: number, day: number): number {
  const weekend = day === 0 || day === 6;

  if (weekend) {
    const midday = gaussian(hour, 13, 3.4) * 0.5;
    const evening = gaussian(hour, 19.5, 2.6) * 0.62;
    return clamp(0.16 + midday + evening);
  }

  const morning = gaussian(hour, 9.3, 1.5) * 0.72;
  const evening = gaussian(hour, 18.7, 1.8) * 0.86;
  const daytime = gaussian(hour, 14, 4) * 0.3;
  return clamp(0.14 + morning + evening + daytime);
}

function gaussian(x: number, mu: number, sigma: number): number {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
}
