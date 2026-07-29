import { clamp } from "@/lib/core/math";
import { getStore } from "@/lib/db";
import type { CitizenReport } from "@/lib/db/types";
import type { ReportField, ReportSignalReading } from "./types";

/** Flood conditions change fast; a 40-minute-old sighting is already stale. */
const FLOOD_HALF_LIFE_MIN = 40;
/** A blocked drain stays blocked until somebody clears it. */
const BLOCKAGE_HALF_LIFE_MIN = 3 * 24 * 60;

/**
 * Turn raw citizen reports into a signal the prediction engine can consume.
 *
 * Three things matter and all three are handled here:
 *   - **Decay.** Old reports must stop mattering, at a rate that matches how
 *     fast the underlying thing changes.
 *   - **Direction.** "Road is clear" is evidence too, and has to be able to pull
 *     a prediction down, not just fail to push it up.
 *   - **Corroboration.** One anonymous report should nudge; five agreeing
 *     reports should move the number.
 */
export async function buildReportField(
  cityId: string,
  now: Date = new Date(),
): Promise<ReportField> {
  const store = getStore();
  const reports = await store.listReports({ cityId, withinMin: 7 * 24 * 60 });

  const bySegment: Record<string, ReportSignalReading> = {};
  // Local, not module-level: two requests must never share accumulator state.
  const depthAcc = new Map<string, { total: number; weight: number }>();

  const addDepth = (segmentId: string, depthCm: number | null, weight: number) => {
    if (depthCm === null || !Number.isFinite(depthCm)) return;
    const acc = depthAcc.get(segmentId) ?? { total: 0, weight: 0 };
    acc.total += depthCm * weight;
    acc.weight += weight;
    depthAcc.set(segmentId, acc);
  };

  for (const report of reports) {
    const reading = (bySegment[report.segmentId] ??= {
      segmentId: report.segmentId,
      netFloodSignal: 0,
      drainBlockageSignal: 0,
      observedDepthCm: null,
      stalledVehicles: 0,
      reportCount: 0,
      latestAt: null,
    });

    const ageMin = (now.getTime() - Date.parse(report.createdAt)) / 60_000;
    const weight = reportWeight(report, ageMin, FLOOD_HALF_LIFE_MIN);

    reading.reportCount += 1;
    if (!reading.latestAt || report.createdAt > reading.latestAt) {
      reading.latestAt = report.createdAt;
    }

    switch (report.type) {
      case "flooded_road":
        reading.netFloodSignal += weight;
        addDepth(report.segmentId, report.depthCm, weight);
        break;
      case "vehicle_stalled":
        // A stalled vehicle is the strongest possible ground truth: somebody
        // tried it and the water won.
        reading.netFloodSignal += weight * 1.4;
        reading.stalledVehicles += 1;
        addDepth(report.segmentId, report.depthCm, weight);
        break;
      case "road_clear":
        reading.netFloodSignal -= weight * 0.85;
        break;
      case "drain_blockage":
        reading.drainBlockageSignal += reportWeight(
          report,
          ageMin,
          BLOCKAGE_HALF_LIFE_MIN,
        );
        break;
    }
  }

  for (const reading of Object.values(bySegment)) {
    // Saturating rather than clipping: the tenth agreeing report should add less
    // than the second one did.
    reading.netFloodSignal = Math.tanh(reading.netFloodSignal);
    reading.drainBlockageSignal = clamp(Math.tanh(reading.drainBlockageSignal));
    const acc = depthAcc.get(reading.segmentId);
    reading.observedDepthCm =
      acc && acc.weight > 0 ? acc.total / acc.weight : null;
  }

  return {
    provenance: {
      source: "floodpilot/citizen-reports",
      kind: "crowdsourced",
      fetchedAt: now.toISOString(),
      reliability: reports.length > 0 ? 0.68 : 0.4,
      live: true,
      note:
        reports.length > 0
          ? `${reports.length} citizen report${reports.length === 1 ? "" : "s"} in the last 7 days.`
          : "No citizen reports yet for this city.",
    },
    bySegment,
  };
}

function reportWeight(
  report: CitizenReport,
  ageMin: number,
  halfLifeMin: number,
): number {
  const decay = 0.5 ** (Math.max(0, ageMin) / halfLifeMin);
  const consensus = clamp(
    1 + report.corroborations * 0.22 - report.contradictions * 0.3,
    0.15,
    2.2,
  );
  return report.reporterTrust * decay * consensus;
}
