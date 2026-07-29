import { buildTimeline, type PredictionTimeline } from "@/lib/engine/timeline";
import { planRoutes } from "@/lib/routing/safe-route";
import type { RouteComparison } from "@/lib/routing/types";
import type { ScenarioId } from "@/lib/signals/scenarios";
import { assessSurvivability } from "@/lib/vehicles/survivability";
import type { SurvivabilityAssessment, VehicleProfile } from "@/lib/vehicles/types";
import type { AgentEnvelope } from "@/lib/core/types";
import { citizenAgent, type CitizenAlert } from "./citizen-agent";
import {
  predictionAgent,
  routeAgent,
  vehicleAgent,
} from "./core-agents";
import {
  decisionAgent,
  type DecisionResult,
  type JourneyContext,
} from "./decision-agent";

/**
 * Orchestrator.
 *
 * Composes the agents into one journey brief. It exists so the agents stay
 * independent — each can be swapped or called on its own — while the app has a
 * single call that produces everything a screen needs.
 *
 * The trace it returns is not decoration: it records which agent produced each
 * part of the answer, how long it took and how confident it was, which is what
 * makes the recommendation auditable rather than oracular.
 */

export interface JourneyRequest {
  cityId: string;
  scenario: ScenarioId;
  originNodeId: string;
  destinationNodeId: string;
  vehicle: VehicleProfile | null;
  journey: JourneyContext;
  departInMin: number;
  now?: Date;
}

export interface AgentTrace {
  agent: string;
  name: string;
  version: string;
  latencyMs: number;
  confidence: number;
  confidenceBand: string;
  degraded: boolean;
  topExplanation: string;
}

export interface JourneyBrief {
  comparison: RouteComparison | null;
  timeline: PredictionTimeline;
  decision: DecisionResult;
  survivability: SurvivabilityAssessment | null;
  alerts: CitizenAlert[];
  trace: AgentTrace[];
  /** Which providers actually supplied the underlying prediction. */
  sources: { signal: string; providerName: string; used: boolean; detail: string }[];
  computedAt: string;
  scenario: ScenarioId;
}

export async function runJourneyBrief(
  request: JourneyRequest,
): Promise<JourneyBrief> {
  const now = request.now ?? new Date();
  const trace: AgentTrace[] = [];

  const record = <T>(envelope: AgentEnvelope<T>, name: string) => {
    trace.push({
      agent: envelope.meta.agent,
      name,
      version: envelope.meta.version,
      latencyMs: envelope.meta.latencyMs,
      confidence: envelope.confidence.score,
      confidenceBand: envelope.confidence.band,
      degraded: envelope.meta.degraded,
      topExplanation: envelope.explanations[0].text,
    });
    return envelope.data;
  };

  /* 1. Prediction ------------------------------------------------------- */
  const predictionEnvelope = await predictionAgent.run({
    cityId: request.cityId,
    scenario: request.scenario,
    now,
  });
  const result = record(predictionEnvelope, "Prediction Agent");

  /* 2. Routes ----------------------------------------------------------- */
  const routeRequest = {
    cityId: request.cityId,
    originNodeId: request.originNodeId,
    destinationNodeId: request.destinationNodeId,
    vehicle: request.vehicle,
    departInMin: request.departInMin,
  };

  const routeEnvelope = await routeAgent.run({
    graph: result.graph,
    predictions: result.predictions,
    request: routeRequest,
  });
  const comparison = record(routeEnvelope, "Route Agent");

  /* 3. Vehicle ---------------------------------------------------------- */
  let survivability: SurvivabilityAssessment | null = null;
  if (request.vehicle && comparison) {
    const vehicleEnvelope = await vehicleAgent.run({
      vehicle: request.vehicle,
      depthCm: comparison.safest.maxDepthCm,
      slopePct: comparison.safest.worstLeg?.slopePct,
    });
    survivability = record(vehicleEnvelope, "Vehicle Agent");
  }

  /* 4. Timeline --------------------------------------------------------- */
  // Re-plans at each candidate departure, which is the only way to find the
  // moment the window actually shuts.
  const timeline = buildTimeline({
    graph: result.graph,
    bundle: result.bundle,
    predictions: result.predictions,
    route: comparison?.safest ?? null,
    now,
    horizonMin: 12 * 60,
    evaluateDeparture: (departInMin) => {
      const plan = planRoutes(result.graph, result.predictions, {
        ...routeRequest,
        departInMin,
      });
      if (!plan) return null;
      return {
        score: plan.safest.safeRouteScore,
        impassable: plan.safest.impassableCount,
      };
    },
  });

  /* 5. Decision --------------------------------------------------------- */
  const decisionEnvelope = await decisionAgent.run({
    graph: result.graph,
    bundle: result.bundle,
    comparison,
    timeline,
    vehicle: request.vehicle,
    journey: request.journey,
    originNodeId: request.originNodeId,
    destinationNodeId: request.destinationNodeId,
    now,
  });
  const decision = record(decisionEnvelope, "Decision Agent");

  /* 6. Citizen alerts --------------------------------------------------- */
  const citizenEnvelope = await citizenAgent.run({
    result,
    comparison,
    timeline,
    decision,
    vehicle: request.vehicle,
    survivability:
      survivability ??
      (request.vehicle && comparison
        ? assessSurvivability(request.vehicle, comparison.safest.maxDepthCm)
        : null),
    now,
  });
  const alerts = record(citizenEnvelope, "Citizen Agent");

  return {
    comparison,
    timeline,
    decision,
    survivability,
    alerts,
    trace,
    sources: result.bundle.sources.map((s) => ({
      signal: s.signal,
      providerName: s.providerName,
      used: s.used,
      detail: s.detail,
    })),
    computedAt: now.toISOString(),
    scenario: request.scenario,
  };
}

export { AGENT_REGISTRY } from "./base";
export type { Agent } from "./base";
export { predictionAgent, routeAgent, vehicleAgent } from "./core-agents";
export { decisionAgent } from "./decision-agent";
export type {
  DecisionAction,
  DecisionOption,
  DecisionResult,
  JourneyContext,
  JourneyPurpose,
  Urgency,
} from "./decision-agent";
export { JOURNEY_PURPOSES } from "./decision-agent";
export { infrastructureAgent } from "./infrastructure-agent";
export type { InfrastructureInsights } from "./infrastructure-agent";
export { citizenAgent } from "./citizen-agent";
export type { CitizenAlert } from "./citizen-agent";
