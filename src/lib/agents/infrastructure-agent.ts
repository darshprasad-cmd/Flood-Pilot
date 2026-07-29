import { clamp } from "@/lib/core/math";
import { depthLabel, compactNumber } from "@/lib/core/format";
import { formatDuration } from "@/lib/core/time";
import type { Explanation, RiskLevel } from "@/lib/core/types";
import { buildConfidence } from "@/lib/core/types";
import type { EngineResult } from "@/lib/engine";
import type { CitizenReport } from "@/lib/db/types";
import { envelope, type Agent } from "./base";

/**
 * Infrastructure agent — the government view.
 *
 * Reframes the same predictions around a different question. A citizen asks
 * "can I get there"; a flood control room asks "where do the pumps go, and what
 * breaks next". Ranking is by people affected rather than by depth, because a
 * metre of water on an empty service road matters less than thirty centimetres
 * across an arterial carrying twenty thousand people.
 */

export interface HighRiskRoad {
  segmentId: string;
  name: string;
  corridor: string;
  midpoint: { lat: number; lng: number };
  probability: number;
  peakDepthCm: number;
  riskLevel: RiskLevel;
  peopleExposed: number;
  timeToImpassableMin: number | null;
  recoveryMin: number | null;
  isHotspot: boolean;
  hotspotName: string | null;
  criticalFacilities: string[];
}

export interface PredictedDrainFailure {
  segmentId: string;
  roadName: string;
  drainName: string;
  drainDistanceM: number;
  siltationPct: number;
  overflowLikelihood: number;
  peopleAffected: number;
  reason: string;
}

export interface ResourceDeployment {
  rank: number;
  segmentId: string;
  location: string;
  midpoint: { lat: number; lng: number };
  /** Pumps recommended on site. */
  pumps: number;
  /** Response teams recommended. */
  teams: number;
  /** Latest useful arrival time, minutes from now. */
  deployByMin: number | null;
  priority: "immediate" | "high" | "standby";
  rationale: string;
  peopleProtected: number;
  existingPumps: number;
}

export interface FloodHotspotCluster {
  id: string;
  name: string;
  kind: string;
  severity: string;
  at: { lat: number; lng: number };
  segmentIds: string[];
  worstDepthCm: number;
  probability: number;
  peopleExposed: number;
  source: string;
}

export interface InfrastructureInsights {
  highRiskRoads: HighRiskRoad[];
  drainFailures: PredictedDrainFailure[];
  deployments: ResourceDeployment[];
  hotspots: FloodHotspotCluster[];
  citizenReports: CitizenReport[];
  totals: {
    roadsAtRisk: number;
    roadsImpassable: number;
    peopleExposed: number;
    underpassesAtRisk: number;
    basementsAtRisk: number;
    pumpsRecommended: number;
    teamsRecommended: number;
  };
}

export interface InfrastructureInput {
  result: EngineResult;
  reports: CitizenReport[];
}

/** Total pumps a control room can realistically move in one event. */
const PUMP_BUDGET = 60;
const TEAM_BUDGET = 24;

export class InfrastructureAgent
  implements Agent<InfrastructureInput, InfrastructureInsights>
{
  readonly id = "infrastructure";
  readonly name = "Infrastructure Agent";
  readonly version = "1.0.0";
  readonly description =
    "Turns city-wide predictions into where to send pumps and what fails next.";

  async run(input: InfrastructureInput) {
    const startedAt = Date.now();
    const { result, reports } = input;
    const { graph } = result;

    /* ── High-risk roads ─────────────────────────────────────────────── */

    const highRiskRoads: HighRiskRoad[] = [];
    const drainFailures: PredictedDrainFailure[] = [];
    let basementsAtRisk = 0;

    for (const state of result.states) {
      const segment = graph.getSegment(state.segmentId);
      if (!segment) continue;

      if (state.peakDepthCm >= 8 && state.floodProbability >= 0.3) {
        highRiskRoads.push({
          segmentId: segment.id,
          name: segment.name,
          corridor: segment.corridor,
          midpoint: segment.midpoint,
          probability: state.floodProbability,
          peakDepthCm: state.peakDepthCm,
          riskLevel: state.riskLevel,
          peopleExposed: segment.populationExposure,
          timeToImpassableMin: state.timeToImpassableMin,
          recoveryMin: state.recoveryMin,
          isHotspot: !!segment.hotspot,
          hotspotName: segment.hotspot?.name ?? null,
          criticalFacilities: segment.criticalFacilities,
        });

        if (segment.basementParking > 0 && state.peakDepthCm > 14) {
          basementsAtRisk += segment.basementParking;
        }
      }

      if (segment.majorDrain && state.drainOverflowLikelihood >= 0.4) {
        drainFailures.push({
          segmentId: segment.id,
          roadName: segment.name,
          drainName: segment.majorDrain.name,
          drainDistanceM: Math.round(segment.majorDrain.distanceM),
          siltationPct: Math.round(segment.majorDrain.siltationIndex * 100),
          overflowLikelihood: state.drainOverflowLikelihood,
          peopleAffected: segment.populationExposure,
          reason:
            state.blockages.find((b) => b.kind === "drain_backflow")?.basis ??
            state.blockages.find((b) => b.kind === "storm_drain_overflow")?.basis ??
            "Drain capacity exceeded by forecast rainfall.",
        });
      }
    }

    highRiskRoads.sort(
      (a, b) =>
        b.probability * b.peopleExposed * (b.peakDepthCm / 40) -
        a.probability * a.peopleExposed * (a.peakDepthCm / 40),
    );
    drainFailures.sort(
      (a, b) =>
        b.overflowLikelihood * b.peopleAffected -
        a.overflowLikelihood * a.peopleAffected,
    );

    /* ── Deployments ─────────────────────────────────────────────────── */

    const deployments = allocateResources(highRiskRoads, graph);

    /* ── Hotspot clusters ────────────────────────────────────────────── */

    const hotspots = clusterHotspots(result);

    /* ── Explanations ────────────────────────────────────────────────── */

    const totals = {
      roadsAtRisk: highRiskRoads.length,
      roadsImpassable: result.states.filter((s) => s.timeToImpassableMin !== null)
        .length,
      peopleExposed: highRiskRoads.reduce((sum, r) => sum + r.peopleExposed, 0),
      underpassesAtRisk: highRiskRoads.filter(
        (r) => graph.getSegment(r.segmentId)?.isUnderpass,
      ).length,
      basementsAtRisk,
      pumpsRecommended: deployments.reduce((sum, d) => sum + d.pumps, 0),
      teamsRecommended: deployments.reduce((sum, d) => sum + d.teams, 0),
    };

    const explanations: Explanation[] = [];

    if (deployments[0]) {
      explanations.push({
        id: "infra_priority",
        text: `Highest-value deployment is ${deployments[0].location}: ${deployments[0].pumps} pumps and ${deployments[0].teams} team${deployments[0].teams === 1 ? "" : "s"}, protecting an estimated ${compactNumber(deployments[0].peopleProtected)} people.`,
        category: "policy",
        impact: "reduces-risk",
        weight: 1,
        evidence: [{ label: "Rationale", value: deployments[0].rationale }],
      });
    }

    if (drainFailures[0]) {
      explanations.push({
        id: "infra_drain",
        text: `${drainFailures[0].drainName} is the most consequential drainage failure: ${Math.round(drainFailures[0].overflowLikelihood * 100)}% likely to surcharge at ${drainFailures[0].roadName}.`,
        category: "drainage",
        impact: "increases-risk",
        weight: 0.9,
      });
    }

    if (totals.basementsAtRisk > 0) {
      explanations.push({
        id: "infra_basements",
        text: `${totals.basementsAtRisk} buildings with basement parking are on streets forecast to exceed kerb height. Basement losses precede road closures.`,
        category: "policy",
        impact: "increases-risk",
        weight: 0.85,
      });
    }

    if (reports.length > 0) {
      explanations.push({
        id: "infra_reports",
        text: `${reports.length} citizen report${reports.length === 1 ? "" : "s"} in the last 24 hours are feeding the prediction and can be used to verify it.`,
        category: "reports",
        impact: "neutral",
        weight: 0.5,
      });
    }

    return envelope({
      data: {
        highRiskRoads: highRiskRoads.slice(0, 30),
        drainFailures: drainFailures.slice(0, 15),
        deployments,
        hotspots,
        citizenReports: reports.slice(0, 50),
        totals,
      },
      explanations,
      fallbackExplanation: {
        id: "infra_quiet",
        text: "No road in the city currently meets the threshold for deployment.",
        category: "policy",
        impact: "reduces-risk",
        weight: 0.3,
      },
      confidence: buildConfidence([
        {
          key: "prediction",
          label: "Underlying predictions",
          score:
            result.states.reduce((sum, s) => sum + s.confidence, 0) /
            Math.max(1, result.states.length),
          weight: 0.6,
        },
        {
          key: "assets",
          label: "Asset inventory",
          score: 0.45,
          weight: 0.4,
          note: "Pump and drain inventories are modelled. Connecting the PWD and I&FC asset registers would make deployment advice operational rather than indicative.",
        },
      ]),
      agent: this.id,
      version: this.version,
      inputs: result.bundle.provenances,
      degraded: result.bundle.degraded,
      startedAt,
    });
  }
}

/**
 * Allocate a finite number of pumps and teams.
 *
 * The value of a pump is the people it protects per unit of water it has to
 * move, discounted by how much capacity is already on site. Sites that are
 * already beyond what pumping can achieve get teams for closure and rescue
 * instead — sending pumps to a two-metre underpass during the peak is theatre.
 */
function allocateResources(
  roads: HighRiskRoad[],
  graph: EngineResult["graph"],
): ResourceDeployment[] {
  let pumpsLeft = PUMP_BUDGET;
  let teamsLeft = TEAM_BUDGET;
  const deployments: ResourceDeployment[] = [];

  for (const road of roads.slice(0, 14)) {
    if (pumpsLeft <= 0 && teamsLeft <= 0) break;

    const segment = graph.getSegment(road.segmentId);
    if (!segment) continue;

    const severity = clamp(road.peakDepthCm / 60);
    const value = road.probability * road.peopleExposed * (0.4 + severity);

    // Beyond about a metre, pumping during the peak achieves little; the useful
    // response is closure and rescue.
    const pumpable = road.peakDepthCm < 100;

    const wantPumps = pumpable
      ? Math.min(8, Math.max(1, Math.round(severity * 6 + road.probability * 3)))
      : 0;
    const wantTeams = Math.max(1, Math.round(clamp(value / 40_000) * 3));

    const pumps = Math.max(0, Math.min(wantPumps, pumpsLeft));
    const teams = Math.max(0, Math.min(wantTeams, teamsLeft));
    if (pumps === 0 && teams === 0) continue;

    pumpsLeft -= pumps;
    teamsLeft -= teams;

    const deployByMin =
      road.timeToImpassableMin !== null
        ? Math.max(0, road.timeToImpassableMin - 30)
        : null;

    deployments.push({
      rank: deployments.length + 1,
      segmentId: road.segmentId,
      location: road.hotspotName ?? road.name,
      midpoint: road.midpoint,
      pumps,
      teams,
      deployByMin,
      priority:
        road.timeToImpassableMin !== null && road.timeToImpassableMin < 60
          ? "immediate"
          : road.probability > 0.6
            ? "high"
            : "standby",
      rationale: pumpable
        ? `${Math.round(road.probability * 100)}% chance of flooding to ${depthLabel(road.peakDepthCm)}, affecting ~${compactNumber(road.peopleExposed)} people${
            deployByMin !== null ? `; impassable in ${formatDuration(road.timeToImpassableMin ?? 0)}` : ""
          }. Pumping can hold this one.`
        : `Forecast depth of ${depthLabel(road.peakDepthCm)} is beyond what pumping can hold during the peak. Deploy for closure, diversion and rescue, and pump once the drain outfall reopens.`,
      peopleProtected: road.peopleExposed,
      existingPumps: segment.pumpStations,
    });
  }

  return deployments;
}

function clusterHotspots(result: EngineResult): FloodHotspotCluster[] {
  const { graph } = result;
  const byHotspot = new Map<string, FloodHotspotCluster>();

  for (const state of result.states) {
    const segment = graph.getSegment(state.segmentId);
    if (!segment?.hotspot) continue;

    const existing = byHotspot.get(segment.hotspot.id);
    if (existing) {
      existing.segmentIds.push(segment.id);
      existing.worstDepthCm = Math.max(existing.worstDepthCm, state.peakDepthCm);
      existing.probability = Math.max(existing.probability, state.floodProbability);
      existing.peopleExposed += segment.populationExposure;
    } else {
      byHotspot.set(segment.hotspot.id, {
        id: segment.hotspot.id,
        name: segment.hotspot.name,
        kind: segment.hotspot.kind,
        severity: segment.hotspot.severity,
        at: segment.midpoint,
        segmentIds: [segment.id],
        worstDepthCm: state.peakDepthCm,
        probability: state.floodProbability,
        peopleExposed: segment.populationExposure,
        source: segment.hotspot.source,
      });
    }
  }

  return [...byHotspot.values()].sort(
    (a, b) => b.probability * b.worstDepthCm - a.probability * a.worstDepthCm,
  );
}

export const infrastructureAgent = new InfrastructureAgent();
