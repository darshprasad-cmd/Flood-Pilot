import type { ProviderId } from "@/lib/cities/types";
import type { RoadSegment } from "@/lib/graph/types";
import { buildTrafficField } from "../traffic";
import type { TrafficField } from "../types";
import { fetchGoogleTraffic } from "./google";
import type { ResolvedSignal } from "./types";

/**
 * Resolve traffic from the city's preferred providers in order.
 *
 * Google's live travel times first, the internal time-of-day model as the
 * keyless fallback. Traffic matters here for two reasons that are easy to
 * conflate: it decides how long you are exposed to a flooding road, and — during
 * heavy rain in Delhi — it is itself the primary failure mode, because the city
 * gridlocks long before most roads are impassable.
 */
export async function resolveTraffic(
  segments: RoadSegment[],
  preference: ProviderId[],
  now: Date,
  peakRainMmPerHr: number,
  timezoneOffsetMin: number,
): Promise<ResolvedSignal<TrafficField>> {
  const skipped: { id: ProviderId; reason: string }[] = [];

  for (const provider of preference) {
    if (provider === "google-traffic") {
      const field = await fetchGoogleTraffic(
        segments.map((s) => ({
          id: s.id,
          from: s.geometry[0],
          to: s.geometry[s.geometry.length - 1],
          speedLimitKph: s.speedLimitKph,
          lengthM: s.lengthM,
        })),
        now,
      );

      if (field) {
        // Google resolves most but rarely all segments; fill the gaps from the
        // model so routing never sees a hole in the graph.
        const modelled = buildModel(segments, now, peakRainMmPerHr, timezoneOffsetMin);
        for (const segment of segments) {
          field.bySegment[segment.id] ??= modelled.bySegment[segment.id];
        }
        return { data: field, usedProvider: "google-traffic", skipped };
      }

      skipped.push({
        id: "google-traffic",
        reason: process.env.GOOGLE_MAPS_API_KEY
          ? "Google Maps is configured but did not return travel times."
          : "Google Maps Platform requires an API key (GOOGLE_MAPS_API_KEY).",
      });
      continue;
    }

    if (provider === "internal-model") break;
  }

  return {
    data: buildModel(segments, now, peakRainMmPerHr, timezoneOffsetMin),
    usedProvider: "internal-model",
    skipped,
  };
}

function buildModel(
  segments: RoadSegment[],
  now: Date,
  peakRainMmPerHr: number,
  timezoneOffsetMin: number,
): TrafficField {
  return buildTrafficField(
    segments.map((s) => ({
      id: s.id,
      roadClass: s.roadClass,
      lanes: s.lanes,
      speedLimitKph: s.speedLimitKph,
    })),
    now,
    peakRainMmPerHr,
    timezoneOffsetMin,
  );
}
