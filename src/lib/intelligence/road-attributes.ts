import { clamp } from "@/lib/core/math";
import { depthSeverity } from "@/lib/core/risk";
import type { ReportCluster } from "@/lib/community/types";
import type { CommunityReport } from "@/lib/community/types";
import { REPORT_META } from "@/lib/community/types";
import type { SegmentCalibration } from "@/lib/engine/calibration";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { IntersectionDelay } from "./signal-delay";
import type { CongestionForecast } from "./congestion";

/**
 * Road intelligence.
 *
 * The brief's point, and it is the right one: a routing engine that optimises
 * travel time alone is optimising the wrong thing. Every road here carries the
 * full set of attributes that actually determine whether you should drive down
 * it — and the routing cost function consumes all of them rather than just the
 * clock.
 *
 * Two of these deserve naming because they are unusual:
 *
 *   - **communityConfidence** — how well *observed* this road is. A road nobody
 *     has reported from is not a safe road; it is an unwatched one, and the
 *     product should not pretend those are the same.
 *   - **historicalReliability** — how often predictions on this road have turned
 *     out to be right. It is the honest counterweight to everything else here.
 */
export interface RoadIntelligence {
  segmentId: string;
  name: string;

  /** 0..1 — probability weighted by how deep it gets. */
  floodRisk: number;
  /** 0..1 congestion right now. */
  traffic: number;
  /** 0..1 — reported roadworks affecting this stretch. */
  construction: number;
  /** Estimated wait at the junction this road leads into, in seconds. */
  signalDelaySec: number;
  averageSpeedKph: number;
  /** 0..1 — likelihood of an incident here, from reports and road character. */
  accidentRisk: number;
  /** 0..1 — how well observed this road is by the community. */
  communityConfidence: number;
  /** 0..1 — how often predictions here have matched reality. */
  historicalReliability: number;
  /** Minutes of delay above free-flow, from every cause combined. */
  estimatedDelayMin: number;
  /** Lanes currently reported blocked. */
  lanesBlocked: number;
  /** Verified community clusters touching this road. */
  activeClusters: string[];
}

export interface AttributeInput {
  graph: CityGraph;
  clusters: ReportCluster[];
  reports: CommunityReport[];
  delays: Map<string, IntersectionDelay>;
  congestion: Map<string, CongestionForecast>;
  calibration: Map<string, SegmentCalibration>;
  now: Date;
}

export function buildRoadIntelligence(
  input: AttributeInput,
): Map<string, RoadIntelligence> {
  const { graph, clusters, reports, delays, congestion, calibration, now } = input;
  const out = new Map<string, RoadIntelligence>();

  // Index reports and clusters by segment once.
  const reportsBySegment = new Map<string, CommunityReport[]>();
  for (const report of reports) {
    const list = reportsBySegment.get(report.segmentId);
    if (list) list.push(report);
    else reportsBySegment.set(report.segmentId, [report]);
  }

  const clustersBySegment = new Map<string, ReportCluster[]>();
  for (const cluster of clusters) {
    for (const id of cluster.segmentIds) {
      const list = clustersBySegment.get(id);
      if (list) list.push(cluster);
      else clustersBySegment.set(id, [cluster]);
    }
  }

  for (const segment of graph.allSegments()) {
    const state = graph.getState(segment.id);
    if (!state) continue;

    const segReports = reportsBySegment.get(segment.id) ?? [];
    const segClusters = clustersBySegment.get(segment.id) ?? [];

    /* Construction ---------------------------------------------------- */
    const construction = clamp(
      weightedSignal(segReports, ["construction", "metro_construction"], now) +
        (segment.constructionObstruction ? 0.35 : 0),
    );

    /* Accident risk ---------------------------------------------------- */
    // Reported incidents dominate; underlying road character sets the floor.
    const reportedIncidents = weightedSignal(
      segReports,
      ["accident", "broken_down_vehicle"],
      now,
    );
    const structural =
      (segment.roadClass === "ring" || segment.roadClass === "highway" ? 0.18 : 0.1) +
      (segment.isUnderpass ? 0.08 : 0) +
      clamp(state.trafficDensity - 0.6) * 0.15 +
      // Wet roads are where collisions actually happen.
      depthSeverity(state.peakDepthCm) * 0.25;

    const accidentRisk = clamp(reportedIncidents * 0.7 + structural);

    /* Lanes blocked ---------------------------------------------------- */
    const lanesBlocked = Math.max(
      0,
      ...segClusters.map((c) => c.lanesBlocked ?? 0),
      ...segReports.map((r) => r.lanesBlocked ?? 0),
    );

    /* Community confidence --------------------------------------------- */
    // Distinct reporters, saturating. Nobody watching is not the same as fine.
    const reporters = new Set(segReports.map((r) => r.reporterId)).size;
    const communityConfidence = clamp(reporters / 5);

    /* Historical reliability -------------------------------------------- */
    const cal = calibration.get(segment.id);
    const historicalReliability =
      !cal || cal.sampleCount === 0
        ? 0.5 // unknown, not good
        : clamp(1 - cal.meanAbsError, 0.1, 0.98);

    /* Signal delay ------------------------------------------------------ */
    const signalDelaySec = delays.get(segment.to)?.estimatedDelaySec ?? 0;

    /* Composite delay --------------------------------------------------- */
    const freeFlowMin = (segment.lengthM / 1000 / segment.speedLimitKph) * 60;
    const trafficDelayMin =
      freeFlowMin * (2.6 * state.trafficDensity ** 2.1);
    const laneDelayMin = lanesBlocked > 0
      ? freeFlowMin * clamp(lanesBlocked / Math.max(1, segment.lanes)) * 2.2
      : 0;
    const floodDelayMin = depthSeverity(state.depthCm) * 6;
    const constructionDelayMin = construction * 3.5;

    const estimatedDelayMin =
      trafficDelayMin +
      laneDelayMin +
      floodDelayMin +
      constructionDelayMin +
      signalDelaySec / 60;

    const forecast = congestion.get(segment.id);

    out.set(segment.id, {
      segmentId: segment.id,
      name: segment.name,
      floodRisk: clamp(state.floodProbability * depthSeverity(state.peakDepthCm)),
      traffic: forecast?.currentDensity ?? state.trafficDensity,
      construction,
      signalDelaySec,
      averageSpeedKph:
        segment.speedLimitKph / (1 + 2.6 * state.trafficDensity ** 2.1),
      accidentRisk,
      communityConfidence,
      historicalReliability,
      estimatedDelayMin,
      lanesBlocked,
      activeClusters: segClusters.map((c) => c.id),
    });
  }

  return out;
}

/**
 * Time-decayed strength of a set of report types on one segment.
 *
 * Distinct reporters again, not raw report count.
 */
function weightedSignal(
  reports: CommunityReport[],
  types: string[],
  now: Date,
): number {
  const byReporter = new Map<string, number>();

  for (const report of reports) {
    if (!types.includes(report.type)) continue;
    const meta = REPORT_META[report.type];
    const ageMin = (now.getTime() - Date.parse(report.createdAt)) / 60_000;
    const decay = 0.5 ** (Math.max(0, ageMin) / meta.halfLifeMin);
    byReporter.set(
      report.reporterId,
      Math.max(byReporter.get(report.reporterId) ?? 0, decay * report.reporterTrust),
    );
  }

  const total = [...byReporter.values()].reduce((sum, v) => sum + v, 0);
  return clamp(Math.tanh(total * 0.8));
}

/**
 * Extra routing cost from community intelligence, in equivalent minutes.
 *
 * Kept separate from the flood penalty so the two can be reasoned about — and
 * turned off — independently.
 */
export function communityPenaltyMin(intel: RoadIntelligence | undefined): number {
  if (!intel) return 0;

  let penalty = 0;

  // Blocked lanes are already in estimatedDelayMin; this is the risk of being
  // stuck behind something unpredictable rather than the average delay.
  penalty += intel.accidentRisk * 9;
  penalty += intel.construction * 5;

  // A road nobody is watching earns a small penalty against an equivalent road
  // that people are actively confirming is fine.
  penalty += (1 - intel.communityConfidence) * 1.5;

  // Roads where our predictions have historically been wrong deserve a wider
  // margin, not blind trust.
  penalty += (1 - intel.historicalReliability) * 3;

  return penalty;
}
