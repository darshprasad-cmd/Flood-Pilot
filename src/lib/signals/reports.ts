import { clamp } from "@/lib/core/math";
import { getStore } from "@/lib/db";
import type { CitizenReport } from "@/lib/db/types";
import type { ReportField, ReportSignalReading } from "./types";

/** Flood conditions change fast; a 40-minute-old sighting is already stale. */
const FLOOD_HALF_LIFE_MIN = 40;
/** A blocked drain stays blocked until somebody clears it. */
const BLOCKAGE_HALF_LIFE_MIN = 3 * 24 * 60;

/**
 * What a report nobody else has confirmed is worth here.
 *
 * The submission endpoint promises that a report below moderate confidence is
 * recorded and shown but does not move a prediction on its own, and until this
 * factor existed nothing enforced that promise: `verifyReport` computed
 * `actionable` and no code read it. The full verification cannot run in this
 * module — it needs model state and rainfall, and this field is one of the
 * inputs those are built from — so the gate is its strongest signal,
 * corroboration by a distinct reporter, which the store now counts honestly.
 */
const UNCORROBORATED_WEIGHT = 0.2;

/**
 * Turn raw citizen reports into a signal the prediction engine can consume.
 *
 * Three things matter and all three are handled here:
 *   - **Decay.** Old reports must stop mattering, at a rate that matches how
 *     fast the underlying thing changes.
 *   - **Direction.** "Road is clear" is evidence too, and has to be able to pull
 *     a prediction down, not just fail to push it up.
 *   - **Corroboration.** One anonymous report should barely register; five
 *     agreeing reports from five different people should move the number.
 *
 * The third of those is why evidence is accumulated per *reporter* and only
 * then summed across reporters, keeping each person's strongest report rather
 * than adding up everything they filed. Summing reports instead made four
 * submissions from one device indistinguishable from four witnesses, in either
 * direction — including four "road is clear" reports dragging a genuinely
 * flooded road down, which is the direction that hurts somebody.
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
  const byReporter = new Map<string, ReporterEvidence>();

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

    const key = `${report.segmentId}|${report.reporterId}`;
    const evidence = byReporter.get(key) ?? {
      segmentId: report.segmentId,
      flood: 0,
      clear: 0,
      blockage: 0,
      depthCm: null,
      depthWeight: 0,
    };
    byReporter.set(key, evidence);

    switch (report.type) {
      case "waterlogging":
        raiseFlood(evidence, weight, report.depthCm);
        break;
      case "vehicle_stalled":
        // A stalled vehicle is the strongest possible ground truth: somebody
        // tried it and the water won.
        raiseFlood(evidence, weight * 1.4, report.depthCm);
        reading.stalledVehicles += 1;
        break;
      case "overflowing_drain":
        // Water on the road, arriving from the drain rather than the sky.
        raiseFlood(evidence, weight * 0.8, null);
        evidence.blockage = Math.max(
          evidence.blockage,
          reportWeight(report, ageMin, BLOCKAGE_HALF_LIFE_MIN),
        );
        break;
      case "road_clear":
        evidence.clear = Math.max(evidence.clear, weight * 0.85);
        break;
      case "drain_blockage":
        evidence.blockage = Math.max(
          evidence.blockage,
          reportWeight(report, ageMin, BLOCKAGE_HALF_LIFE_MIN),
        );
        break;
      default:
        // Every other report type describes an obstruction rather than water,
        // and is consumed by the road-intelligence layer instead.
        break;
    }
  }

  // One person, one contribution — however many times they filed.
  for (const evidence of byReporter.values()) {
    const reading = bySegment[evidence.segmentId];
    reading.netFloodSignal += evidence.flood - evidence.clear;
    reading.drainBlockageSignal += evidence.blockage;
    addDepth(evidence.segmentId, evidence.depthCm, evidence.depthWeight);
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

/** What one person's reports on one segment amount to. */
interface ReporterEvidence {
  segmentId: string;
  /** Strongest water-positive contribution. */
  flood: number;
  /** Strongest "it is passable" contribution. */
  clear: number;
  /** Strongest blocked-drain contribution. */
  blockage: number;
  /** Depth from the report that produced `flood`, where it carried one. */
  depthCm: number | null;
  depthWeight: number;
}

/** Keep this person's strongest sighting, and the depth that came with it. */
function raiseFlood(
  evidence: ReporterEvidence,
  weight: number,
  depthCm: number | null,
): void {
  if (weight <= evidence.flood) return;
  evidence.flood = weight;
  evidence.depthCm = depthCm;
  evidence.depthWeight = weight;
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
  // Corroborations are distinct reporters, so zero means nobody else has seen
  // this — including when the same device filed it ten times. The report is
  // still carried, because the first sighting of a real flood also starts at
  // zero and has to be able to grow once somebody confirms it.
  const verified = report.corroborations > 0 ? 1 : UNCORROBORATED_WEIGHT;
  return report.reporterTrust * decay * consensus * verified;
}
