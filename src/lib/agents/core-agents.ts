import { clamp } from "@/lib/core/math";
import { depthLabel } from "@/lib/core/format";
import type { Explanation } from "@/lib/core/types";
import { buildConfidence } from "@/lib/core/types";
import { runFloodEngine, type EngineResult } from "@/lib/engine";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { HazardPrediction } from "@/lib/hazard/types";
import type { RoadIntelligence } from "@/lib/intelligence/road-attributes";
import { planRoutes } from "@/lib/routing/safe-route";
import type { RouteComparison, RouteRequest } from "@/lib/routing/types";
import type { ScenarioId } from "@/lib/signals/scenarios";
import { assessSurvivability } from "@/lib/vehicles/survivability";
import type { SurvivabilityAssessment, VehicleProfile } from "@/lib/vehicles/types";
import { envelope, type Agent } from "./base";

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Prediction Agent                                                          */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface PredictionInput {
  cityId: string;
  scenario: ScenarioId;
  now?: Date;
}

/**
 * Wraps the hazard engine.
 *
 * Thin by design: the agent's job is to expose the engine through the common
 * contract with provenance and confidence attached, not to add reasoning of its
 * own on top of the model's.
 */
export class PredictionAgent implements Agent<PredictionInput, EngineResult> {
  readonly id = "prediction";
  readonly name = "Prediction Agent";
  readonly version = "1.1.0";
  readonly description =
    "Runs the hazard engine over every road segment in the city.";

  async run(input: PredictionInput) {
    const startedAt = Date.now();
    const result = await runFloodEngine(
      input.cityId,
      input.scenario,
      input.now ?? new Date(),
    );

    const worst = [...result.states].sort(
      (a, b) => b.peakDepthCm - a.peakDepthCm,
    )[0];
    const worstSegment = worst ? result.graph.getSegment(worst.segmentId) : null;

    const explanations: Explanation[] = [];

    if (worst && worstSegment && worst.peakDepthCm > 5) {
      explanations.push({
        id: "pred_worst",
        text: `${worstSegment.name} is the city's worst point: ${Math.round(worst.floodProbability * 100)}% chance of flooding, peaking at ${depthLabel(worst.peakDepthCm)}.`,
        category: "weather",
        impact: "increases-risk",
        weight: 1,
      });
    }

    const activeSources = result.bundle.sources.filter((s) => s.used);
    explanations.push({
      id: "pred_sources",
      text: `Prediction based on ${activeSources.map((s) => s.providerName).join(", ")}.`,
      category: "confidence",
      impact: "neutral",
      weight: 0.4,
      evidence: activeSources.map((s) => ({ label: s.providerName, value: s.detail })),
    });

    const meanConfidence =
      result.states.reduce((sum, s) => sum + s.confidence, 0) /
      Math.max(1, result.states.length);

    return envelope({
      data: result,
      explanations,
      fallbackExplanation: {
        id: "pred_quiet",
        text: "No road in the city is currently forecast to flood.",
        category: "weather",
        impact: "reduces-risk",
        weight: 0.3,
      },
      confidence: buildConfidence([
        {
          key: "engine",
          label: "Mean segment confidence",
          score: meanConfidence,
          weight: 0.7,
          note:
            meanConfidence < 0.7
              ? "Several segments are working from modelled rather than measured inputs."
              : undefined,
        },
        {
          key: "sources",
          label: "Source availability",
          score: result.bundle.degraded ? 0.55 : 0.9,
          weight: 0.3,
          note: result.bundle.degraded
            ? "At least one preferred data source is unavailable, so a fallback was used."
            : undefined,
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

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Route Agent                                                               */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface RouteAgentInput {
  graph: CityGraph;
  predictions: Map<string, HazardPrediction>;
  request: RouteRequest;
  /** Community-derived road attributes; routing degrades gracefully without. */
  intelligence?: Map<string, RoadIntelligence>;
}

/**
 * Produces the fastest/safest comparison.
 *
 * Google's Directions API is consulted where a key is present, but only as a
 * cross-check on travel time and road hierarchy. The recommended route always
 * comes from our own search over the risk graph, because a maps API optimises
 * for time and has no idea the underpass on its fastest route is about to be
 * under a metre of water.
 */
export class RouteAgent implements Agent<RouteAgentInput, RouteComparison | null> {
  readonly id = "route";
  readonly name = "Route Agent";
  readonly version = "1.1.0";
  readonly description =
    "Searches the road risk graph for a route that is survivable, not merely quick.";

  async run(input: RouteAgentInput) {
    const startedAt = Date.now();
    const comparison = planRoutes(
      input.graph,
      input.predictions,
      input.request,
      input.intelligence,
    );

    return envelope({
      data: comparison,
      explanations: comparison ? [...comparison.explanations] : [],
      fallbackExplanation: {
        id: "route_none",
        text: "No route could be found between these two points on the modelled network.",
        category: "route",
        impact: "blocks",
        weight: 1,
      },
      confidence: comparison
        ? buildConfidence([
            {
              key: "graph",
              label: "Road network coverage",
              score: 0.72,
              weight: 0.5,
              note: "Routing runs on दिशाAI's own risk graph of major corridors, not a full street network — very local detours are not modelled.",
            },
            {
              key: "timing",
              label: "Arrival-time modelling",
              score: 0.8,
              weight: 0.5,
            },
          ])
        : 0.3,
      agent: this.id,
      version: this.version,
      degraded: !comparison,
      startedAt,
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Vehicle Agent                                                             */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface VehicleAgentInput {
  vehicle: VehicleProfile;
  depthCm: number;
  slopePct?: number;
}

export class VehicleAgent
  implements Agent<VehicleAgentInput, SurvivabilityAssessment>
{
  readonly id = "vehicle";
  readonly name = "Vehicle Agent";
  readonly version = "1.0.0";
  readonly description =
    "Judges a specific vehicle against a specific depth of water.";

  async run(input: VehicleAgentInput) {
    const startedAt = Date.now();
    const assessment = assessSurvivability(input.vehicle, input.depthCm, {
      slopePct: input.slopePct,
    });

    const explanations: Explanation[] = assessment.reasons.map((reason, i) => ({
      id: `veh_${i}`,
      text: reason.text,
      category: "vehicle" as const,
      impact: reason.impact,
      weight: reason.impact === "blocks" ? 1 : 0.6,
    }));

    return envelope({
      data: assessment,
      explanations,
      fallbackExplanation: {
        id: "veh_default",
        text: "No water of any consequence for this vehicle.",
        category: "vehicle",
        impact: "reduces-risk",
        weight: 0.3,
      },
      confidence: buildConfidence([
        {
          key: "clearance",
          label: "Published clearance figure",
          score: 0.85,
          weight: 0.5,
        },
        {
          key: "model",
          label: "Wading model",
          score: 0.68,
          weight: 0.5,
          note: "Wading depth is derived from body style and drivetrain rather than a manufacturer fording rating, which most passenger cars do not publish.",
        },
      ]),
      agent: this.id,
      version: this.version,
      startedAt,
    });
  }
}

export const predictionAgent = new PredictionAgent();
export const routeAgent = new RouteAgent();
export const vehicleAgent = new VehicleAgent();

/** Shared helper: how bad is the city right now, 0..1. */
export function citySeverity(result: EngineResult): number {
  const scored = result.states.map(
    (s) => s.floodProbability * clamp(s.peakDepthCm / 40),
  );
  scored.sort((a, b) => b - a);
  // Top decile rather than mean: a city is not fine on average when ten roads
  // are under water.
  const top = scored.slice(0, Math.max(1, Math.round(scored.length * 0.1)));
  return clamp(top.reduce((sum, v) => sum + v, 0) / top.length);
}
