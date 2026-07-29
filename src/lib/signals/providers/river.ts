import type { GaugeStation, ProviderId } from "@/lib/cities/types";
import type { LatLng } from "@/lib/core/types";
import { fetchRiverField } from "../terrain";
import type { RiverField } from "../types";
import { fetchCwcGauge, modelledGauge, type RiverGaugeReading } from "./cwc";
import type { ResolvedSignal } from "./types";

export interface RiverResult {
  /** Gauge readings with official warning thresholds attached. */
  gauges: RiverGaugeReading[];
  /** Modelled discharge field, used where no gauge covers a location. */
  field: RiverField;
  /**
   * 0..1 — how much the river is pressing on the city's drainage right now.
   * This is the number the flood model actually consumes.
   */
  floodplainPressure: number;
}

/**
 * Resolve river state from the city's preferred providers in order.
 *
 * For Delhi this is CWC's Yamuna gauges first. Cities with no gauge in their
 * plugin — Bengaluru, for instance — simply get the discharge field and zero
 * floodplain pressure, which is the correct answer rather than a degraded one.
 */
export async function resolveRiver(
  gauges: GaugeStation[],
  probePoints: LatLng[],
  preference: ProviderId[],
  upstreamWetnessIndex: number,
  now: Date = new Date(),
): Promise<ResolvedSignal<RiverResult>> {
  const skipped: { id: ProviderId; reason: string }[] = [];
  const readings: RiverGaugeReading[] = [];
  let usedProvider: ProviderId = "internal-model";

  if (gauges.length > 0 && preference.includes("cwc")) {
    for (const station of gauges) {
      const reading = await fetchCwcGauge(station, now);
      if (reading) {
        readings.push(reading);
        usedProvider = "cwc";
      } else {
        readings.push(modelledGauge(station, upstreamWetnessIndex, now));
      }
    }

    if (usedProvider !== "cwc") {
      skipped.push({
        id: "cwc",
        reason:
          "CWC requires an API key (CWC_API_KEY). Set YAMUNA_LEVEL_M to enter the current gauge reading from a CWC bulletin instead.",
      });
    }
  }

  const field = await fetchRiverField(probePoints, now);
  if (usedProvider === "internal-model" && field.provenance.live) {
    usedProvider = "open-meteo-flood";
  }

  // The floodplain only cares about the worst gauge on the reach.
  const floodplainPressure = readings.reduce(
    (worst, r) => Math.max(worst, r.floodplainPressure),
    0,
  );

  return {
    data: { gauges: readings, field, floodplainPressure },
    usedProvider,
    skipped,
  };
}
