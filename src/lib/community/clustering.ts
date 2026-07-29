import { clamp, haversineM, mean } from "@/lib/core/math";
import type { LatLng } from "@/lib/core/types";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { WeatherCell } from "@/lib/signals/types";
import {
  REPORT_META,
  type CommunityReport,
  type ConfidenceBand,
  type InferredEvent,
  type ReportCluster,
  type ReportType,
  type Severity,
} from "./types";
import { verifyReport } from "./verification";

/**
 * Cluster detection.
 *
 * Seventeen pins on a map is not information; "a major flood event at ITO
 * affecting four roads" is. This module does two things: it groups reports that
 * are plausibly about the same real-world event, and it *infers what that event
 * is* from the pattern of report types — which is often something nobody
 * actually reported.
 *
 * The inference is the interesting part. Twelve people reporting congestion and
 * nobody reporting water is not a flood; it is very likely an accident that
 * nobody has reported yet. Eight pothole reports at one spot over a month is not
 * eight potholes; it is a failing carriageway.
 */

/** Reports within this distance are candidates for the same event. */
const CLUSTER_RADIUS_M = 250;
/** Minimum reports to call something a cluster rather than a single sighting. */
const MIN_CLUSTER_SIZE = 3;

/** Samples the rainfall field at a point; supplied by the caller. */
export type WeatherSampler = (at: LatLng) => WeatherCell | undefined;

export function clusterReports(
  reports: CommunityReport[],
  graph: CityGraph,
  weatherAt: WeatherSampler,
  now: Date = new Date(),
): ReportCluster[] {
  // Only consider reports that are still plausibly describing the present.
  const live = reports.filter((r) => {
    const meta = REPORT_META[r.type];
    const age = (now.getTime() - Date.parse(r.createdAt)) / 60_000;
    return age <= meta.halfLifeMin * 3;
  });

  const clusters = spatialCluster(live);
  const out: ReportCluster[] = [];

  for (const members of clusters) {
    if (members.length < MIN_CLUSTER_SIZE) continue;

    const centroid: LatLng = {
      lat: mean(members.map((m) => m.at.lat)),
      lng: mean(members.map((m) => m.at.lng)),
    };

    const radiusM = Math.max(
      60,
      Math.max(...members.map((m) => haversineM(centroid, m.at))),
    );

    const typeCounts: Partial<Record<ReportType, number>> = {};
    for (const m of members) {
      typeCounts[m.type] = (typeCounts[m.type] ?? 0) + 1;
    }

    const dominantType = (Object.entries(typeCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] ?? members[0].type) as ReportType;

    // Verify each member so cluster confidence is built from verified evidence
    // rather than from raw volume — otherwise a cluster is just a spam target.
    const verifications = members.map((report) =>
      verifyReport({
        report,
        neighbours: members,
        segment: graph.getSegment(report.segmentId),
        state: graph.getState(report.segmentId),
        weather: weatherAt(report.at),
        now,
      }),
    );

    const reporterCount = new Set(members.map((m) => m.reporterId)).size;
    const meanConfidence = mean(verifications.map((v) => v.confidence));

    // Independent witnesses raise cluster confidence well above any individual
    // report's — that is the whole point of corroboration.
    //
    // Capped below 1: crowdsourced evidence, however abundant, never justifies
    // claiming certainty. Twelve people can all be looking at the same puddle.
    const confidence = clamp(
      meanConfidence + clamp((reporterCount - 1) / 8) * 0.35,
      0,
      0.96,
    );

    const depths = members
      .map((m) => m.depthCm)
      .filter((d): d is number => typeof d === "number");
    const lanes = members
      .map((m) => m.lanesBlocked)
      .filter((l): l is number => typeof l === "number");

    const stamps = members.map((m) => Date.parse(m.createdAt));
    const nearestNode = graph.nearestNode(centroid);

    out.push({
      id: `cl_${dominantType}_${Math.round(centroid.lat * 1e4)}_${Math.round(centroid.lng * 1e4)}`,
      cityId: members[0].cityId,
      at: centroid,
      radiusM: Math.round(radiusM),
      reportIds: members.map((m) => m.id),
      reportCount: members.length,
      reporterCount,
      segmentIds: [...new Set(members.map((m) => m.segmentId))],
      dominantType,
      typeCounts,
      severity: aggregateSeverity(members),
      confidence,
      band: toBand(confidence),
      lanesBlocked: lanes.length > 0 ? Math.round(Math.max(...lanes)) : null,
      meanDepthCm: depths.length > 0 ? Math.round(mean(depths)) : null,
      firstSeenAt: new Date(Math.min(...stamps)).toISOString(),
      lastSeenAt: new Date(Math.max(...stamps)).toISOString(),
      inferred: inferEvent(typeCounts, members, graph, reporterCount),
      locationName: nearestNode.name,
    });
  }

  return out.sort(
    (a, b) => b.confidence * b.reportCount - a.confidence * a.reportCount,
  );
}

/* -------------------------------------------------------------------------- */
/*  Spatial clustering                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Single-link agglomerative clustering on distance.
 *
 * Chosen over k-means because the number of events is unknown, and over strict
 * DBSCAN because at these volumes the simpler algorithm gives the same answer
 * and is far easier to reason about when a cluster looks wrong.
 */
function spatialCluster(reports: CommunityReport[]): CommunityReport[][] {
  const unassigned = [...reports];
  const clusters: CommunityReport[][] = [];

  while (unassigned.length > 0) {
    const seed = unassigned.shift() as CommunityReport;
    const group = [seed];

    // Grow the group until nothing else is within reach of any member.
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = unassigned.length - 1; i >= 0; i--) {
        const candidate = unassigned[i];
        const near = group.some(
          (m) => haversineM(m.at, candidate.at) <= CLUSTER_RADIUS_M,
        );
        if (near) {
          group.push(candidate);
          unassigned.splice(i, 1);
          grew = true;
        }
      }
    }

    clusters.push(group);
  }

  return clusters;
}

/* -------------------------------------------------------------------------- */
/*  Event inference                                                           */
/* -------------------------------------------------------------------------- */

function inferEvent(
  counts: Partial<Record<ReportType, number>>,
  members: CommunityReport[],
  graph: CityGraph,
  reporterCount: number,
): InferredEvent {
  const n = (type: ReportType) => counts[type] ?? 0;
  const total = members.length;

  const water = n("waterlogging") + n("vehicle_stalled");
  const drain = n("overflowing_drain") + n("drain_blockage");
  const congestion = n("heavy_congestion") + n("broken_down_vehicle");
  const blocking = n("road_closure") + n("fallen_tree") + n("power_lines_down");
  const works = n("construction") + n("metro_construction");
  const potholes = n("pothole");
  const emergency = n("emergency_vehicles") + n("water_tanker");

  const segments = [...new Set(members.map((m) => m.segmentId))]
    .map((id) => graph.getSegment(id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const hotspot = segments.find((s) => s.hotspot)?.hotspot ?? null;
  const drainName = segments.find((s) => s.majorDrain)?.majorDrain?.name ?? null;

  /* Major flood event. */
  if (water >= 3 && water / total >= 0.5) {
    return {
      kind: "major_flood_event",
      label: "Major flood event",
      likelihood: clamp(0.55 + water * 0.06 + (reporterCount - 1) * 0.04),
      explanation: `${water} reports of standing water from ${reporterCount} people within ${CLUSTER_RADIUS_M} m${
        hotspot ? `, at ${hotspot.name} — a ${hotspot.severity} waterlogging point` : ""
      }.`,
      recommendation: hotspot
        ? `Deploy pumps to ${hotspot.name} and close the affected approach.`
        : "Deploy pumps and divert traffic away from the affected stretch.",
    };
  }

  /* Drain failure — the Delhi-specific one worth calling out separately. */
  if (drain >= 2 && drain + water >= 3) {
    return {
      kind: "drain_failure",
      label: "Likely drain failure",
      likelihood: clamp(0.5 + drain * 0.1),
      explanation: `${drain} reports of drain overflow or blockage alongside ${water} of standing water${
        drainName ? `, on the ${drainName} catchment` : ""
      }. Water is arriving from the drain rather than from rainfall.`,
      recommendation:
        "Inspect the drain section and desilt. Pumping alone will not hold this if the outfall is blocked.",
    };
  }

  /* Congestion without any reported cause — the inference the brief asks for. */
  if (congestion >= 3 && water === 0 && works === 0 && blocking === 0) {
    return {
      kind: "likely_accident",
      label: "Accident likely",
      likelihood: clamp(0.45 + congestion * 0.07),
      explanation: `${congestion} congestion reports from ${reporterCount} people in one place, with no waterlogging, construction or closure reported. That pattern usually means an incident nobody has reported yet.`,
      recommendation:
        "Dispatch a patrol to confirm. Treat as an unconfirmed incident until verified.",
    };
  }

  /* Construction bottleneck. */
  if (works >= 1 && congestion >= 2) {
    return {
      kind: "construction_bottleneck",
      label: "Construction bottleneck",
      likelihood: clamp(0.5 + works * 0.08 + congestion * 0.05),
      explanation: `${works} construction report${works === 1 ? "" : "s"} with ${congestion} congestion reports at the same location.`,
      recommendation:
        "Review lane allocation and signal timing at the work zone; check the drainage section has not been narrowed.",
    };
  }

  /* Repeated potholes at one spot. */
  if (potholes >= 3) {
    return {
      kind: "infrastructure_defect",
      label: "Carriageway defect",
      likelihood: clamp(0.5 + potholes * 0.08),
      explanation: `${potholes} pothole reports at the same location from ${reporterCount} people. Repeated reports in one spot indicate a failing carriageway rather than isolated potholes.`,
      recommendation: "Schedule a surface inspection and resurfacing survey.",
    };
  }

  /* Hard blockage. */
  if (blocking >= 2) {
    return {
      kind: "road_blocked",
      label: "Road blocked",
      likelihood: clamp(0.55 + blocking * 0.1),
      explanation: `${blocking} reports of closure, fallen trees or downed lines.`,
      recommendation:
        "Confirm closure, publish a diversion, and notify the electricity distribution company if lines are involved.",
    };
  }

  if (emergency >= 2) {
    return {
      kind: "emergency_response",
      label: "Emergency response under way",
      likelihood: clamp(0.5 + emergency * 0.1),
      explanation: `${emergency} reports of emergency vehicles or pumping operations at this location.`,
      recommendation: "Keep the corridor clear; avoid routing traffic through it.",
    };
  }

  if (congestion >= 2) {
    return {
      kind: "localised_congestion",
      label: "Localised congestion",
      likelihood: clamp(0.4 + congestion * 0.08),
      explanation: `${congestion} congestion reports without an identified cause.`,
      recommendation: "Monitor. Escalate if reports continue past thirty minutes.",
    };
  }

  return {
    kind: "unclassified",
    label: "Reports clustered",
    likelihood: 0.35,
    explanation: `${total} reports of mixed types within ${CLUSTER_RADIUS_M} m, with no clear pattern.`,
    recommendation: "Monitor for a clearer signal before acting.",
  };
}

/* -------------------------------------------------------------------------- */

function aggregateSeverity(members: CommunityReport[]): Severity {
  const rank: Record<Severity, number> = {
    minor: 0,
    moderate: 1,
    major: 2,
    severe: 3,
  };
  const worst = members.reduce(
    (max, m) => Math.max(max, rank[m.severity]),
    0,
  );
  // A cluster of many "moderate" reports is worse than any one of them.
  const lifted = members.length >= 8 ? Math.min(3, worst + 1) : worst;
  return (["minor", "moderate", "major", "severe"] as Severity[])[lifted];
}

function toBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.82) return "very_high";
  if (confidence >= 0.62) return "high";
  if (confidence >= 0.42) return "moderate";
  return "low";
}
