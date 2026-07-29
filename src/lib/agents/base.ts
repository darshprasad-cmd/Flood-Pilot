import type { AgentEnvelope, Explanation, NonEmpty } from "@/lib/core/types";
import { buildConfidence, nonEmpty, sortExplanations } from "@/lib/core/types";
import type { ConfidenceReport, SignalProvenance } from "@/lib/core/types";

/**
 * The agent contract.
 *
 * Six independent services sit behind this one interface. Each is replaceable —
 * swap the decision agent for an LLM-backed one, or the route agent for a
 * solver, without touching anything else — and each is obliged to return its
 * reasoning, its confidence and its provenance alongside its answer.
 *
 * The obligation is enforced by the type: `AgentEnvelope.explanations` is
 * `NonEmpty<Explanation>`, so an agent that returns an unexplained result does
 * not compile. That is the whole point of the layer.
 */
export interface Agent<TIn, TOut> {
  id: string;
  name: string;
  version: string;
  /** One line, shown in the architecture view. */
  description: string;
  run(input: TIn): Promise<AgentEnvelope<TOut>>;
}

export interface EnvelopeInit<T> {
  data: T;
  explanations: Explanation[];
  fallbackExplanation: Explanation;
  confidence: ConfidenceReport | number;
  agent: string;
  version: string;
  inputs?: SignalProvenance[];
  degraded?: boolean;
  startedAt: number;
}

export function envelope<T>(init: EnvelopeInit<T>): AgentEnvelope<T> {
  const explanations: NonEmpty<Explanation> = nonEmpty(
    sortExplanations(init.explanations),
    init.fallbackExplanation,
  );

  const confidence: ConfidenceReport =
    typeof init.confidence === "number"
      ? buildConfidence([
          {
            key: "agent",
            label: init.agent,
            score: init.confidence,
            weight: 1,
            note:
              init.confidence < 0.7
                ? "Confidence is limited by the quality of the inputs this agent received."
                : undefined,
          },
        ])
      : init.confidence;

  return {
    data: init.data,
    explanations,
    confidence,
    meta: {
      agent: init.agent,
      version: init.version,
      computedAt: new Date().toISOString(),
      latencyMs: Date.now() - init.startedAt,
      inputs: init.inputs ?? [],
      degraded: init.degraded ?? false,
    },
  };
}

/** Descriptions surfaced in the AI architecture view on the landing page. */
export const AGENT_REGISTRY = [
  {
    id: "prediction",
    name: "Prediction Agent",
    role: "Produces flood predictions",
    detail:
      "Runs the hazard engine over every road segment: probability, depth, timing, drain overflow and recovery, with ranked drivers.",
  },
  {
    id: "route",
    name: "Route Agent",
    role: "Produces safe routes",
    detail:
      "Searches the road risk graph with time-dependent costs, comparing what a maps app would tell you against what is actually survivable.",
  },
  {
    id: "vehicle",
    name: "Vehicle Agent",
    role: "Produces survivability scores",
    detail:
      "Converts a specific vehicle's clearance, body, drivetrain and fuel into a wading limit, then judges it against predicted depth.",
  },
  {
    id: "decision",
    name: "Decision Agent",
    role: "Produces recommendations",
    detail:
      "Weighs the prediction, the routes, the vehicle and the purpose of the journey to choose an action — including not travelling.",
  },
  {
    id: "infrastructure",
    name: "Infrastructure Agent",
    role: "Produces government insights",
    detail:
      "Aggregates to hotspots, predicted drain failures and where to send pumps and teams, ranked by people affected.",
  },
  {
    id: "citizen",
    name: "Citizen Agent",
    role: "Produces personalised alerts",
    detail:
      "Turns the city-wide picture into what matters to one person: their route, their vehicle, their basement, their departure time.",
  },
] as const;
