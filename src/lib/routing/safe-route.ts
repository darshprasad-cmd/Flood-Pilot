import { clamp } from "@/lib/core/math";
import { depthLabel, distanceLabel } from "@/lib/core/format";
import { depthSeverity, riskLevelFrom, worstRisk } from "@/lib/core/risk";
import { formatDuration } from "@/lib/core/time";
import type { Explanation, LatLng, NonEmpty } from "@/lib/core/types";
import { nonEmpty, sortExplanations } from "@/lib/core/types";
import { IMPASSABLE_CM } from "@/lib/engine/waterlogging";
import { depthAtMinute } from "@/lib/engine/hydrology";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { RoadSegment, SegmentState } from "@/lib/graph/types";
import type { HazardPrediction } from "@/lib/hazard/types";
import {
  communityPenaltyMin,
  type RoadIntelligence,
} from "@/lib/intelligence/road-attributes";
import { assessSurvivability } from "@/lib/vehicles/survivability";
import type { VehicleProfile } from "@/lib/vehicles/types";
import type {
  RouteComparison,
  RouteLeg,
  RouteMode,
  RouteRequest,
  RouteResult,
} from "./types";

/**
 * Risk-based routing.
 *
 * The core idea, and the thing that separates this from a maps app: the cost of
 * a road is not how long it takes, it is how long it takes *plus what it costs
 * you to be on it when the water arrives*. And crucially, the depth used is the
 * depth at the moment you would actually reach that road — a route that is clear
 * now but 40 cm deep in eighteen minutes is not a safe route.
 *
 * Two searches run over the same graph. The time-only search reproduces what a
 * conventional navigation app would tell you; the risk-weighted search is what
 * FloodPilot recommends. Showing both is the product.
 */

/** Minutes of detour a driver should accept to avoid the worst case. */
const RISK_BUDGET_MIN = 55;

export function planRoutes(
  graph: CityGraph,
  predictions: Map<string, HazardPrediction>,
  request: RouteRequest,
  /**
   * Community-derived road attributes.
   *
   * Optional so routing still works before the community layer has run, but
   * when present it is what makes this more than flood-aware routing: signal
   * delay, reported lane blockage, accident risk, construction and how reliable
   * our own predictions have been on each road all enter the cost.
   */
  intelligence?: Map<string, RoadIntelligence>,
): RouteComparison | null {
  const fastest = search(graph, predictions, request, "fastest", intelligence);
  const safest = search(graph, predictions, request, "safest", intelligence);

  if (!fastest || !safest) return null;

  const identical =
    fastest.legs.length === safest.legs.length &&
    fastest.legs.every((leg, i) => leg.segmentId === safest.legs[i].segmentId);

  // Relabel when the best available route is still not a safe one — calling it
  // the "recommended safe route" would be a lie the user might act on.
  if (safest.impassableCount > 0) {
    safest.label = "Least dangerous route";
  }

  const extraMinutes = Math.max(0, safest.durationMin - fastest.durationMin);
  const riskReduction = Math.max(
    0,
    (fastest.maxProbability - safest.maxProbability) * 100,
  );
  const depthReduction = Math.max(0, fastest.maxDepthCm - safest.maxDepthCm);

  return {
    fastest,
    safest,
    identical,
    safeRouteExists: safest.impassableCount === 0,
    extraMinutes,
    riskReduction,
    depthReduction,
    explanations: comparisonExplanations({
      fastest,
      safest,
      identical,
      extraMinutes,
      riskReduction,
      depthReduction,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Search                                                                    */
/* -------------------------------------------------------------------------- */

interface Label {
  nodeId: string;
  cost: number;
  timeMin: number;
  viaSegment: string | null;
  previous: string | null;
}

/**
 * Time-dependent Dijkstra.
 *
 * Edge cost depends on when you arrive, so the label carries elapsed time
 * alongside cost. Travel times are non-negative and the network is small, so a
 * plain label-setting search is both correct enough and instant.
 */
function search(
  graph: CityGraph,
  predictions: Map<string, HazardPrediction>,
  request: RouteRequest,
  mode: RouteMode,
  intelligence?: Map<string, RoadIntelligence>,
): RouteResult | null {
  const { originNodeId, destinationNodeId, vehicle, departInMin } = request;
  if (!graph.getNode(originNodeId) || !graph.getNode(destinationNodeId)) return null;

  const best = new Map<string, Label>();
  const start: Label = {
    nodeId: originNodeId,
    cost: 0,
    timeMin: 0,
    viaSegment: null,
    previous: null,
  };
  best.set(originNodeId, start);

  const queue: Label[] = [start];
  const settled = new Set<string>();

  while (queue.length > 0) {
    // Small graph: a linear scan beats the constant factor of a heap.
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].cost < queue[bestIndex].cost) bestIndex = i;
    }
    const current = queue.splice(bestIndex, 1)[0];

    if (settled.has(current.nodeId)) continue;
    settled.add(current.nodeId);
    if (current.nodeId === destinationNodeId) break;

    for (const edge of graph.neighbours(current.nodeId)) {
      if (settled.has(edge.to)) continue;

      const segment = graph.getSegment(edge.segmentId);
      if (!segment) continue;

      const state = graph.getState(segment.id);
      const prediction = predictions.get(segment.id);

      const intel = intelligence?.get(segment.id);
      const travelMin = travelTime(segment, state, intel);
      const arrivalMin = departInMin + current.timeMin;
      const depthCm = depthOnArrival(prediction, arrivalMin);

      // Both searches pay the real-world delay — a maps app would too. Only the
      // risk-weighted search pays the *risk*.
      const stepCost =
        mode === "fastest"
          ? travelMin
          : travelMin +
            riskPenaltyMin(segment, state, depthCm, vehicle) +
            communityPenaltyMin(intel);

      if (!Number.isFinite(stepCost)) continue;

      const nextCost = current.cost + stepCost;
      const existing = best.get(edge.to);
      if (existing && existing.cost <= nextCost) continue;

      const label: Label = {
        nodeId: edge.to,
        cost: nextCost,
        timeMin: current.timeMin + travelMin,
        viaSegment: segment.id,
        previous: current.nodeId,
      };
      best.set(edge.to, label);
      queue.push(label);
    }
  }

  const destination = best.get(destinationNodeId);
  if (!destination) return null;

  return buildResult(graph, predictions, request, mode, best);
}

/**
 * Free-flow time adjusted by congestion, plus every other source of delay we
 * know about.
 *
 * When road intelligence is available it supersedes the congestion-only
 * estimate, because it already accounts for signal waits, blocked lanes,
 * standing water and roadworks — all of which a travel-time model that looks
 * only at congestion systematically misses.
 */
function travelTime(
  segment: RoadSegment,
  state: SegmentState | undefined,
  intel?: RoadIntelligence,
): number {
  const freeFlowMin = (segment.lengthM / 1000 / segment.speedLimitKph) * 60;

  if (intel) return freeFlowMin + intel.estimatedDelayMin;

  const density = state?.trafficDensity ?? 0.4;
  const delayFactor = 1 + 2.6 * density ** 2.1;
  const speedKph = Math.max(5, segment.speedLimitKph / delayFactor);
  return (segment.lengthM / 1000 / speedKph) * 60;
}

function depthOnArrival(
  prediction: HazardPrediction | undefined,
  arrivalMin: number,
): number {
  if (!prediction) return 0;
  return depthAtMinute(prediction.onsetCurve, arrivalMin);
}

/**
 * Cost of being on this road, expressed in minutes so it is commensurable with
 * travel time. A driver should understand the trade directly: "this road is
 * worth twenty minutes of detour to avoid".
 */
function riskPenaltyMin(
  segment: RoadSegment,
  state: SegmentState | undefined,
  depthCm: number,
  vehicle: VehicleProfile | null,
): number {
  const probability = state?.floodProbability ?? 0;

  const limitCm = vehicle
    ? assessSurvivability(vehicle, depthCm, { slopePct: segment.slopePct })
        .maxSafeWadeCm
    : IMPASSABLE_CM;

  // Water beyond the vehicle's limit is effectively a wall, but the penalty is
  // large-and-finite rather than infinite.
  //
  // During a cloudburst there may be no crossing of the city that a hatchback
  // survives. Returning Infinity there produced *no route at all*, which meant
  // the product went silent at exactly the moment it had the most to say. A
  // finite wall still guarantees the search prefers any passable alternative,
  // while leaving a least-bad path to show — flagged leg by leg — so the user
  // can see that the obvious route is the dangerous one.
  if (depthCm > limitCm) {
    return 900 + (depthCm - limitCm) * 25;
  }

  const severity = depthSeverity(depthCm);
  let penalty = probability * severity * RISK_BUDGET_MIN;

  // Approaching the vehicle's limit, not merely deep in the abstract.
  const utilisation = limitCm > 0 ? depthCm / limitCm : 1;
  penalty += clamp(utilisation - 0.5, 0, 0.5) * 2 * 22;

  // An underpass is a trap rather than a puddle: the water is deeper than it
  // looks and there is no way out sideways.
  if (segment.isUnderpass && depthCm > 5) {
    penalty += 18 + probability * 22;
  }

  // Drain surcharge means the water is still rising when you get there.
  penalty += (state?.drainOverflowLikelihood ?? 0) * severity * 14;

  // Standing water on a slope is moving water.
  if (segment.slopePct > 2 && depthCm > 15) penalty += 12;

  // A road that will not recover is a road you may not get back along.
  if ((state?.recoveryMin ?? 0) > 240 && depthCm > 8) penalty += 10;

  return penalty;
}

/* -------------------------------------------------------------------------- */
/*  Result assembly                                                           */
/* -------------------------------------------------------------------------- */

function buildResult(
  graph: CityGraph,
  predictions: Map<string, HazardPrediction>,
  request: RouteRequest,
  mode: RouteMode,
  labels: Map<string, Label>,
): RouteResult | null {
  const nodeIds: string[] = [];
  const segmentIds: string[] = [];

  let cursor = labels.get(request.destinationNodeId);
  while (cursor) {
    nodeIds.unshift(cursor.nodeId);
    if (cursor.viaSegment) segmentIds.unshift(cursor.viaSegment);
    cursor = cursor.previous ? labels.get(cursor.previous) : undefined;
  }

  if (nodeIds[0] !== request.originNodeId) return null;

  const legs: RouteLeg[] = [];
  const geometry: LatLng[] = [];
  let elapsedMin = 0;
  let distanceM = 0;

  segmentIds.forEach((segmentId, index) => {
    const segment = graph.getSegment(segmentId);
    if (!segment) return;

    const state = graph.getState(segmentId);
    const prediction = predictions.get(segmentId);
    const travelMin = travelTime(segment, state);
    const entersAtMin = request.departInMin + elapsedMin;
    const depthOnArrivalCm = depthOnArrival(prediction, entersAtMin);

    // The stored geometry runs from `from` to `to`; reverse it when the route
    // traverses the segment the other way, so the drawn line follows the drive.
    const forward = segment.from === nodeIds[index];
    const legGeometry = forward ? segment.geometry : [...segment.geometry].reverse();

    const limitCm = request.vehicle
      ? assessSurvivability(request.vehicle, depthOnArrivalCm, {
          slopePct: segment.slopePct,
        }).maxSafeWadeCm
      : IMPASSABLE_CM;

    const impassable = depthOnArrivalCm > limitCm;
    const probability = state?.floodProbability ?? 0;

    legs.push({
      segmentId,
      name: segment.name,
      corridor: segment.corridor,
      fromName: graph.getNode(forward ? segment.from : segment.to)?.name ?? "",
      toName: graph.getNode(forward ? segment.to : segment.from)?.name ?? "",
      geometry: legGeometry,
      distanceM: segment.lengthM,
      travelMin,
      entersAtMin,
      depthOnArrivalCm,
      floodProbability: probability,
      riskLevel: riskLevelFrom(probability, depthOnArrivalCm),
      isUnderpass: segment.isUnderpass,
      slopePct: segment.slopePct,
      warning: legWarning(segment, depthOnArrivalCm, limitCm, impassable),
      impassable,
    });

    geometry.push(...(geometry.length > 0 ? legGeometry.slice(1) : legGeometry));
    elapsedMin += travelMin;
    distanceM += segment.lengthM;
  });

  if (legs.length === 0) return null;

  const maxDepthCm = Math.max(...legs.map((l) => l.depthOnArrivalCm));
  const maxProbability = Math.max(...legs.map((l) => l.floodProbability));
  const worstLeg =
    legs.reduce<RouteLeg | null>(
      (worst, leg) =>
        !worst ||
        leg.floodProbability * depthSeverity(leg.depthOnArrivalCm) >
          worst.floodProbability * depthSeverity(worst.depthOnArrivalCm)
          ? leg
          : worst,
      null,
    ) ?? null;

  const survivability = request.vehicle
    ? assessSurvivability(request.vehicle, maxDepthCm, {
        slopePct: worstLeg?.slopePct ?? 0,
      })
    : null;

  const safeRouteScore = scoreRoute(legs, survivability);

  const result: RouteResult = {
    mode,
    label: mode === "fastest" ? "Fastest route" : "Recommended safe route",
    nodeIds,
    legs,
    geometry,
    distanceM,
    durationMin: elapsedMin,
    safeRouteScore,
    riskLevel: worstRisk(legs.map((l) => l.riskLevel)),
    maxDepthCm,
    maxProbability,
    underpassCount: legs.filter((l) => l.isUnderpass).length,
    impassableCount: legs.filter((l) => l.impassable).length,
    worstLeg,
    survivability,
    explanations: nonEmpty([], PLACEHOLDER),
    arrivesInMin: request.departInMin + elapsedMin,
  };

  result.explanations = routeExplanations(result);
  return result;
}

function legWarning(
  segment: RoadSegment,
  depthCm: number,
  limitCm: number,
  impassable: boolean,
): string | null {
  if (impassable) {
    return `${depthLabel(depthCm)} of water here when you arrive — beyond what your vehicle can cross.`;
  }
  if (segment.isUnderpass && depthCm > 8) {
    return `Underpass with ${depthLabel(depthCm)} of standing water on arrival.`;
  }
  if (depthCm > limitCm * 0.7) {
    return `${depthLabel(depthCm)} on arrival, close to your vehicle's limit.`;
  }
  if (depthCm > 8) {
    return `${depthLabel(depthCm)} of standing water on arrival.`;
  }
  return null;
}

/**
 * Safe Route Score, 0-100.
 *
 * Weighted by exposure time rather than by segment count — five minutes on a
 * flooded arterial is worse than thirty seconds crossing one.
 */
function scoreRoute(
  legs: RouteLeg[],
  survivability: ReturnType<typeof assessSurvivability> | null,
): number {
  const totalMin = legs.reduce((sum, l) => sum + l.travelMin, 0) || 1;

  const exposure = legs.reduce((sum, leg) => {
    const risk = leg.floodProbability * depthSeverity(leg.depthOnArrivalCm);
    const underpassMultiplier = leg.isUnderpass ? 1.5 : 1;
    return sum + risk * underpassMultiplier * (leg.travelMin / totalMin);
  }, 0);

  // The worst single moment matters too — a route is not safe on average.
  const worst = Math.max(
    0,
    ...legs.map((l) => l.floodProbability * depthSeverity(l.depthOnArrivalCm)),
  );

  let score = 100 * (1 - clamp(exposure * 0.55 + worst * 0.45));

  if (legs.some((l) => l.impassable)) score = Math.min(score, 12);
  if (survivability?.band === "unsafe") score = Math.min(score, 25);
  else if (survivability?.band === "borderline") score = Math.min(score, 62);

  return Math.round(clamp(score, 0, 100));
}

/* -------------------------------------------------------------------------- */
/*  Explanations                                                              */
/* -------------------------------------------------------------------------- */

const PLACEHOLDER: Explanation = {
  id: "route_placeholder",
  text: "Route computed.",
  category: "route",
  impact: "neutral",
  weight: 0,
};

function routeExplanations(route: RouteResult): NonEmpty<Explanation> {
  const out: Explanation[] = [];

  if (route.impassableCount > 0) {
    out.push({
      id: "route_impassable",
      text: `${route.impassableCount} stretch${route.impassableCount === 1 ? "" : "es"} on this route will be too deep for your vehicle by the time you reach ${route.impassableCount === 1 ? "it" : "them"}.`,
      category: "route",
      impact: "blocks",
      weight: 1,
    });
  }

  if (route.worstLeg && route.worstLeg.depthOnArrivalCm > 5) {
    const leg = route.worstLeg;
    out.push({
      id: "route_worst",
      text: `The binding constraint is ${leg.name}: ${Math.round(leg.floodProbability * 100)}% chance of flooding, ${depthLabel(leg.depthOnArrivalCm)} expected when you get there at +${formatDuration(leg.entersAtMin)}.`,
      category: "route",
      impact: "increases-risk",
      weight: 0.95,
    });
  }

  if (route.underpassCount > 0) {
    out.push({
      id: "route_underpass",
      text: `${route.underpassCount} underpass${route.underpassCount === 1 ? "" : "es"} on this route. Underpasses fill faster than open roads and offer no way out sideways.`,
      category: "route",
      impact: route.mode === "fastest" ? "increases-risk" : "neutral",
      weight: 0.7,
    });
  } else if (route.mode === "safest") {
    out.push({
      id: "route_no_underpass",
      text: "This route avoids underpasses entirely.",
      category: "route",
      impact: "reduces-risk",
      weight: 0.6,
    });
  }

  if (route.survivability) {
    out.push({
      id: "route_vehicle",
      text: `Against the deepest water on this route (${depthLabel(route.maxDepthCm)}), your vehicle rates ${route.survivability.band}.`,
      category: "vehicle",
      impact:
        route.survivability.band === "unsafe"
          ? "blocks"
          : route.survivability.band === "borderline"
            ? "increases-risk"
            : "reduces-risk",
      weight: 0.85,
    });
  }

  out.push({
    id: "route_summary",
    text: `${distanceLabel(route.distanceM)} over ${formatDuration(route.durationMin)}, ${route.legs.length} road${route.legs.length === 1 ? "" : "s"}.`,
    category: "route",
    impact: "neutral",
    weight: 0.2,
  });

  return nonEmpty(sortExplanations(out), PLACEHOLDER);
}

function comparisonExplanations(input: {
  fastest: RouteResult;
  safest: RouteResult;
  identical: boolean;
  extraMinutes: number;
  riskReduction: number;
  depthReduction: number;
}): NonEmpty<Explanation> {
  const { fastest, safest, identical, extraMinutes, riskReduction, depthReduction } =
    input;

  if (identical) {
    // "Same route" means two very different things depending on whether that
    // route is safe. Saying "nothing to trade off" about a route that crosses
    // 31 cm of water would be actively misleading.
    if (safest.impassableCount > 0) {
      return [
        {
          id: "cmp_same_unsafe",
          text: `Every way across the city passes through water your vehicle cannot handle — avoiding ${safest.worstLeg?.name ?? "the worst stretch"} is not possible on this network. Changing route will not fix this; changing mode or timing will.`,
          category: "route",
          impact: "blocks",
          weight: 1,
        },
        {
          id: "cmp_same_detail",
          text: `The deepest point is ${depthLabel(safest.maxDepthCm)} on ${safest.worstLeg?.name ?? "the route"}, against a safe wading depth of ${depthLabel(safest.survivability?.maxSafeWadeCm ?? 0)}.`,
          category: "vehicle",
          impact: "blocks",
          weight: 0.95,
        },
      ];
    }

    return [
      {
        id: "cmp_same",
        text: "The fastest route is also the safest one right now — there is nothing to trade off.",
        category: "route",
        impact: "reduces-risk",
        weight: 1,
      },
    ];
  }

  const out: Explanation[] = [];

  if (safest.impassableCount > 0) {
    out.push({
      id: "cmp_nosafe",
      text: `There is no route across the city that your vehicle can make right now. This is the least dangerous one, and it still crosses ${depthLabel(safest.maxDepthCm)} of water.`,
      category: "route",
      impact: "blocks",
      weight: 1,
    });
  } else {
    out.push({
      id: "cmp_trade",
      text: `${formatDuration(extraMinutes)} more travel buys a ${Math.round(riskReduction)} point drop in flood probability and ${depthLabel(depthReduction)} less water at the worst point.`,
      category: "route",
      impact: "reduces-risk",
      weight: 1,
    });
  }

  if (fastest.impassableCount > 0 && safest.impassableCount === 0) {
    out.push({
      id: "cmp_blocked",
      text: "The fastest route is not merely riskier — part of it will be impassable in your vehicle.",
      category: "route",
      impact: "blocks",
      weight: 0.98,
    });
  }

  if (fastest.underpassCount > safest.underpassCount) {
    out.push({
      id: "cmp_underpass",
      text: `The safe route avoids ${fastest.underpassCount - safest.underpassCount} underpass${fastest.underpassCount - safest.underpassCount === 1 ? "" : "es"} the fast route uses.`,
      category: "route",
      impact: "reduces-risk",
      weight: 0.8,
    });
  }

  if (fastest.worstLeg) {
    out.push({
      id: "cmp_worst",
      text: `The fastest route's weak point is ${fastest.worstLeg.name} — ${depthLabel(fastest.worstLeg.depthOnArrivalCm)} on arrival.`,
      category: "route",
      impact: "increases-risk",
      weight: 0.85,
    });
  }

  return nonEmpty(sortExplanations(out), PLACEHOLDER);
}

export * from "./types";
