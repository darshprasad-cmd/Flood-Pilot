import { clamp, haversineM } from "@/lib/core/math";
import { depthLabel } from "@/lib/core/format";
import { clockAt, formatDuration } from "@/lib/core/time";
import type { Explanation, RiskLevel } from "@/lib/core/types";
import { buildConfidence } from "@/lib/core/types";
import type { PredictionTimeline } from "@/lib/engine/timeline";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { RouteComparison } from "@/lib/routing/types";
import type { SignalBundle } from "@/lib/signals/types";
import { assessSurvivability } from "@/lib/vehicles/survivability";
import type { VehicleProfile } from "@/lib/vehicles/types";
import { envelope, type Agent } from "./base";

/**
 * Decision agent.
 *
 * The step most flood apps stop short of. Knowing a road will be under 40 cm of
 * water is not a decision; "take the metro, and move your car out of the
 * basement before 19:40" is. This agent weighs the prediction, the routes, the
 * vehicle and — critically — *why* the person is travelling, because the right
 * answer for a hospital run and for dinner plans are not the same answer.
 */

export type JourneyPurpose =
  | "commute"
  | "medical"
  | "school_run"
  | "work_critical"
  | "airport"
  | "leisure"
  | "delivery";

export type Urgency = "leave_now" | "flexible" | "deadline";

export interface JourneyContext {
  purpose: JourneyPurpose;
  urgency: Urgency;
  deadlineInMin: number | null;
  canWorkRemotely: boolean;
}

export const JOURNEY_PURPOSES: {
  id: JourneyPurpose;
  label: string;
  blurb: string;
}[] = [
  { id: "commute", label: "Commute", blurb: "Getting to or from work." },
  { id: "medical", label: "Medical", blurb: "Hospital, clinic or urgent care." },
  { id: "school_run", label: "School run", blurb: "Dropping off or collecting children." },
  { id: "work_critical", label: "Work-critical", blurb: "A meeting or shift that cannot move." },
  { id: "airport", label: "Airport", blurb: "A flight with a fixed departure." },
  { id: "leisure", label: "Leisure", blurb: "Discretionary — it can wait." },
  { id: "delivery", label: "Delivery or logistics", blurb: "Commercial trip." },
];

export type DecisionAction =
  | "leave_now"
  | "delay_departure"
  | "use_metro"
  | "use_cab"
  | "work_remotely"
  | "cancel_trip"
  | "move_vehicle"
  | "shelter_in_place";

export interface DecisionOption {
  action: DecisionAction;
  label: string;
  headline: string;
  /** 0..100 recommendation strength. */
  score: number;
  feasible: boolean;
  infeasibleReason: string | null;
  etaMin: number | null;
  riskLevel: RiskLevel;
  /** True when this is advice to act *alongside* the trip decision. */
  standalone: boolean;
  explanations: Explanation[];
}

export interface DecisionResult {
  primary: DecisionOption;
  alternatives: DecisionOption[];
  /** Advice that applies regardless of which travel option is chosen. */
  parallel: DecisionOption[];
  /** Set when nothing safe is available and the user should call for help. */
  emergencyContacts: { name: string; authority: string; phone: string[] }[];
}

export interface DecisionInput {
  graph: CityGraph;
  bundle: SignalBundle;
  comparison: RouteComparison | null;
  timeline: PredictionTimeline;
  vehicle: VehicleProfile | null;
  journey: JourneyContext;
  originNodeId: string;
  destinationNodeId: string;
  now: Date;
}

/** How far somebody will realistically walk to a metro station. */
const METRO_WALK_LIMIT_M = 900;

export class DecisionAgent implements Agent<DecisionInput, DecisionResult> {
  readonly id = "decision";
  readonly name = "Decision Agent";
  readonly version = "1.1.0";
  readonly description =
    "Chooses the safest action for this journey, including not travelling.";

  async run(input: DecisionInput) {
    const startedAt = Date.now();
    const options = buildOptions(input);

    const feasible = options
      .filter((o) => o.feasible && !o.standalone)
      .sort((a, b) => b.score - a.score);
    const parallel = options.filter((o) => o.standalone && o.feasible);

    const primary =
      feasible[0] ??
      shelterOption(input, "No travel option available right now.");

    const alternatives = feasible.slice(1, 4);

    const needsEmergency =
      primary.action === "shelter_in_place" ||
      (input.journey.purpose === "medical" && primary.riskLevel === "critical");

    const result: DecisionResult = {
      primary,
      alternatives,
      parallel,
      emergencyContacts: needsEmergency
        ? input.graph.controlRooms.slice(0, 3).map((c) => ({
            name: c.name,
            authority: c.authority,
            phone: c.phone,
          }))
        : [],
    };

    return envelope({
      data: result,
      explanations: primary.explanations,
      fallbackExplanation: {
        id: "decision_default",
        text: "No significant flood risk affects this journey right now.",
        category: "policy",
        impact: "reduces-risk",
        weight: 0.3,
      },
      confidence: buildConfidence([
        {
          key: "prediction",
          label: "Underlying flood prediction",
          score: input.comparison
            ? clamp(1 - input.comparison.safest.maxProbability * 0.35, 0.35, 0.95)
            : 0.5,
          weight: 0.5,
        },
        {
          key: "route",
          label: "Route availability",
          score: input.comparison ? 0.85 : 0.4,
          weight: 0.3,
          note: input.comparison
            ? undefined
            : "No route could be planned between these points, so the recommendation is based on city-wide conditions only.",
        },
        {
          key: "context",
          label: "Journey context",
          score: 0.9,
          weight: 0.2,
        },
      ]),
      agent: this.id,
      version: this.version,
      inputs: input.bundle.provenances,
      degraded: input.bundle.degraded,
      startedAt,
    });
  }
}

/* -------------------------------------------------------------------------- */

function buildOptions(input: DecisionInput): DecisionOption[] {
  const { comparison, timeline, vehicle, journey, graph, now } = input;
  const tz = graph.city.timezone;
  const safest = comparison?.safest ?? null;
  const options: DecisionOption[] = [];

  const survivability = safest?.survivability ?? null;
  const routeUnsafe =
    !safest ||
    safest.impassableCount > 0 ||
    survivability?.band === "unsafe" ||
    safest.safeRouteScore < 35;

  const urgencyBoost =
    journey.urgency === "leave_now" ? 12 : journey.urgency === "deadline" ? 6 : 0;
  const criticalPurpose =
    journey.purpose === "medical" ||
    journey.purpose === "work_critical" ||
    journey.purpose === "airport";

  /* ── Leave now ──────────────────────────────────────────────────────── */

  if (safest) {
    const exp: Explanation[] = [...safest.explanations];

    if (timeline.latestSafeDepartureMin !== null) {
      exp.push({
        id: "dec_window",
        text: `The safe window closes at ${clockAt(now, tz, timeline.latestSafeDepartureMin)} — after that this route is not passable in your vehicle.`,
        category: "timing",
        impact: "increases-risk",
        weight: 0.95,
      });
    }

    options.push({
      action: "leave_now",
      label: "Leave now",
      headline:
        timeline.latestSafeDepartureMin !== null
          ? `Leave within ${formatDuration(timeline.latestSafeDepartureMin)} — the window closes at ${clockAt(now, tz, timeline.latestSafeDepartureMin)}`
          : `Take the recommended safe route — ${formatDuration(safest.durationMin)}`,
      score: routeUnsafe
        ? 18
        : clamp(38 + safest.safeRouteScore * 0.5 + urgencyBoost, 0, 100),
      feasible: !routeUnsafe,
      infeasibleReason: routeUnsafe
        ? safest.impassableCount > 0
          ? "Part of every available route will be too deep for your vehicle."
          : survivability?.band === "unsafe"
            ? "The deepest water on the route exceeds what your vehicle can cross."
            : "No route scores well enough to recommend travelling."
        : null,
      etaMin: Math.round(safest.durationMin),
      riskLevel: safest.riskLevel,
      standalone: false,
      explanations: exp,
    });
  }

  /* ── Delay departure ────────────────────────────────────────────────── */

  const delayUntil =
    timeline.recommendedDepartureMin !== null && timeline.recommendedDepartureMin > 10
      ? timeline.recommendedDepartureMin
      : null;

  if (delayUntil !== null) {
    const missesDeadline =
      journey.deadlineInMin !== null &&
      safest !== null &&
      delayUntil + safest.durationMin > journey.deadlineInMin;

    options.push({
      action: "delay_departure",
      label: "Delay departure",
      headline: `Wait until ${clockAt(now, tz, delayUntil)} — conditions improve by then`,
      score: missesDeadline
        ? 30
        : clamp(
            (routeUnsafe ? 74 : 44) - delayUntil * 0.06 - (criticalPurpose ? 10 : 0),
            0,
            100,
          ),
      feasible: journey.urgency !== "leave_now" && !missesDeadline,
      infeasibleReason:
        journey.urgency === "leave_now"
          ? "You said this journey cannot wait."
          : missesDeadline
            ? `Waiting until ${clockAt(now, tz, delayUntil)} would miss your deadline.`
            : null,
      etaMin: safest ? Math.round(delayUntil + safest.durationMin) : null,
      riskLevel: "low",
      standalone: false,
      explanations: [
        {
          id: "dec_delay",
          text: `Rainfall peaks and drains catch up before ${clockAt(now, tz, delayUntil)}. Leaving after the peak avoids the worst of it entirely.`,
          category: "timing",
          impact: "reduces-risk",
          weight: 0.9,
        },
        ...(routeUnsafe
          ? [
              {
                id: "dec_delay_unsafe",
                text: "Every route is currently unsafe in your vehicle, so waiting is not a matter of comfort.",
                category: "route" as const,
                impact: "blocks" as const,
                weight: 0.95,
              },
            ]
          : []),
      ],
    });
  }

  /* ── Metro ──────────────────────────────────────────────────────────── */

  const metro = metroFeasibility(input);
  options.push({
    action: "use_metro",
    label: "Use the Metro",
    headline: metro.feasible
      ? `${metro.originStation} to ${metro.destinationStation} — runs above and below the flooding`
      : "Metro does not serve both ends of this journey",
    score: metro.feasible
      ? clamp((routeUnsafe ? 88 : 46) + (criticalPurpose ? 8 : 0), 0, 100)
      : 10,
    feasible: metro.feasible,
    infeasibleReason: metro.reason,
    etaMin: metro.etaMin,
    riskLevel: "safe",
    standalone: false,
    explanations: metro.feasible
      ? [
          {
            id: "dec_metro",
            text: `Delhi Metro runs elevated or underground and keeps running when the roads do not. ${metro.originStation} is ${Math.round(metro.originWalkM)} m from your start and ${metro.destinationStation} is ${Math.round(metro.destinationWalkM)} m from your destination.`,
            category: "route",
            impact: "reduces-risk",
            weight: 0.95,
          },
        ]
      : [],
  });

  /* ── Cab ────────────────────────────────────────────────────────────── */

  const cab = cabAdvantage(input);
  options.push({
    action: "use_cab",
    label: "Take a cab",
    headline: cab.better
      ? "A higher vehicle can make this journey when yours cannot"
      : "A cab faces the same water your vehicle does",
    score: cab.better ? clamp((routeUnsafe ? 62 : 30) + urgencyBoost, 0, 100) : 16,
    feasible: true,
    infeasibleReason: null,
    etaMin: safest ? Math.round(safest.durationMin * 1.15) : null,
    riskLevel: safest?.riskLevel ?? "moderate",
    standalone: false,
    explanations: cab.better
      ? [
          {
            id: "dec_cab",
            text: `The deepest water on the route is ${depthLabel(safest?.maxDepthCm ?? 0)}. That is beyond your ${vehicle?.model ?? "vehicle"} but within a typical SUV-class cab.`,
            category: "vehicle",
            impact: "reduces-risk",
            weight: 0.8,
          },
        ]
      : [
          {
            id: "dec_cab_nobenefit",
            text: `At ${depthLabel(safest?.maxDepthCm ?? 0)} a cab is in the same trouble your vehicle is. Changing vehicle does not solve this.`,
            category: "vehicle",
            impact: "neutral",
            weight: 0.5,
          },
        ],
  });

  /* ── Work remotely ──────────────────────────────────────────────────── */

  const remoteRelevant =
    journey.purpose === "commute" || journey.purpose === "work_critical";
  options.push({
    action: "work_remotely",
    label: "Work remotely",
    headline: "Skip the journey entirely today",
    score:
      journey.canWorkRemotely && remoteRelevant
        ? clamp(routeUnsafe ? 80 : 28, 0, 100)
        : 8,
    feasible: journey.canWorkRemotely && remoteRelevant,
    infeasibleReason: !remoteRelevant
      ? "This journey is not a commute."
      : !journey.canWorkRemotely
        ? "You indicated this journey cannot be done remotely."
        : null,
    etaMin: null,
    riskLevel: "safe",
    standalone: false,
    explanations: [
      {
        id: "dec_remote",
        text: routeUnsafe
          ? "Every route between these points is unsafe in your vehicle for the next few hours. Not travelling is the only option with no downside."
          : "Conditions are manageable, but staying put removes the risk entirely.",
        category: "policy",
        impact: "reduces-risk",
        weight: routeUnsafe ? 0.9 : 0.4,
      },
    ],
  });

  /* ── Cancel ─────────────────────────────────────────────────────────── */

  options.push({
    action: "cancel_trip",
    label: "Cancel the trip",
    headline: "This journey is not worth the risk today",
    score:
      journey.purpose === "leisure"
        ? clamp(routeUnsafe ? 76 : 22, 0, 100)
        : criticalPurpose
          ? 4
          : 18,
    feasible: journey.purpose === "leisure" || (routeUnsafe && !criticalPurpose),
    infeasibleReason: criticalPurpose
      ? "You marked this journey as one that cannot be cancelled."
      : null,
    etaMin: null,
    riskLevel: "safe",
    standalone: false,
    explanations: [
      {
        id: "dec_cancel",
        text:
          journey.purpose === "leisure"
            ? "This is a discretionary trip and the roads are not in a state that rewards discretion."
            : "With no safe route and no way to wait, not going is the remaining option.",
        category: "policy",
        impact: "reduces-risk",
        weight: 0.75,
      },
    ],
  });

  /* ── Move the vehicle (parallel advice) ─────────────────────────────── */

  const parking = parkingRisk(input);
  if (parking) options.push(parking);

  /* ── Medical override ───────────────────────────────────────────────── */

  if (journey.purpose === "medical") {
    for (const option of options) {
      if (
        option.action === "cancel_trip" ||
        option.action === "work_remotely" ||
        option.action === "delay_departure"
      ) {
        option.score = Math.min(option.score, 12);
        option.feasible = false;
        option.infeasibleReason =
          "This is a medical journey — FloodPilot will not recommend delaying or cancelling it.";
      }
      if (option.action === "use_cab" || option.action === "use_metro") {
        option.score += 15;
      }
    }
  }

  return options;
}

/* -------------------------------------------------------------------------- */

function metroFeasibility(input: DecisionInput) {
  const { graph, originNodeId, destinationNodeId, comparison } = input;
  const origin = graph.getNode(originNodeId);
  const destination = graph.getNode(destinationNodeId);

  const originMetro = origin?.metro;
  const destinationMetro = destination?.metro;

  if (!originMetro || originMetro.walkM > METRO_WALK_LIMIT_M) {
    return {
      feasible: false,
      reason: originMetro
        ? `The nearest station to ${origin?.name} is ${Math.round(originMetro.walkM)} m away — too far to be a realistic option in heavy rain.`
        : `${origin?.name ?? "Your starting point"} is not served by the Metro.`,
      originStation: originMetro?.station ?? "",
      destinationStation: destinationMetro?.station ?? "",
      originWalkM: originMetro?.walkM ?? 0,
      destinationWalkM: destinationMetro?.walkM ?? 0,
      etaMin: null as number | null,
    };
  }

  if (!destinationMetro || destinationMetro.walkM > METRO_WALK_LIMIT_M) {
    return {
      feasible: false,
      reason: destinationMetro
        ? `The nearest station to ${destination?.name} is ${Math.round(destinationMetro.walkM)} m away.`
        : `${destination?.name ?? "Your destination"} is not served by the Metro.`,
      originStation: originMetro.station,
      destinationStation: destinationMetro?.station ?? "",
      originWalkM: originMetro.walkM,
      destinationWalkM: destinationMetro?.walkM ?? 0,
      etaMin: null as number | null,
    };
  }

  // Metro averages roughly 32 km/h door to door including stops and interchange,
  // plus the walk at each end.
  const straightM =
    origin && destination ? haversineM(origin.at, destination.at) : 0;
  const rideMin = (straightM * 1.25) / 1000 / 32 * 60;
  const walkMin = (originMetro.walkM + destinationMetro.walkM) / 80;
  const etaMin = Math.round(rideMin + walkMin + 8);

  return {
    feasible: true,
    reason: null as string | null,
    originStation: originMetro.station,
    destinationStation: destinationMetro.station,
    originWalkM: originMetro.walkM,
    destinationWalkM: destinationMetro.walkM,
    etaMin: comparison ? etaMin : etaMin,
  };
}

/** Would a taller vehicle actually help, or is the water beyond everything? */
function cabAdvantage(input: DecisionInput) {
  const depth = input.comparison?.safest.maxDepthCm ?? 0;
  if (depth < 5) return { better: false };

  const typicalCab: VehicleProfile = {
    id: "cab",
    manufacturer: "Typical",
    model: "SUV-class cab",
    year: 2023,
    bodyType: "suv",
    groundClearanceMm: 198,
    tyreType: "standard",
    driveType: "fwd",
    fuelType: "cng",
  };

  const cabAssessment = assessSurvivability(typicalCab, depth);
  const own = input.vehicle
    ? assessSurvivability(input.vehicle, depth)
    : null;

  return {
    better:
      cabAssessment.band !== "unsafe" &&
      (own === null || own.band === "unsafe" || own.band === "borderline"),
  };
}

/**
 * Basement parking.
 *
 * A separate decision from how to travel, and one the brief calls out
 * explicitly: if the street outside floods, the car in the basement is lost
 * whether or not anyone drives anywhere. It fills long before the street becomes
 * impassable, so the deadline for moving it is earlier than the deadline to leave.
 */
function parkingRisk(input: DecisionInput): DecisionOption | null {
  const { graph, originNodeId, now } = input;
  const tz = graph.city.timezone;

  const nearby = graph
    .allSegments()
    .filter((s) => s.from === originNodeId || s.to === originNodeId)
    .filter((s) => s.basementParking > 0);

  if (nearby.length === 0) return null;

  let worst: { segmentId: string; name: string; peak: number; onset: number | null } | null =
    null;

  for (const segment of nearby) {
    const state = graph.getState(segment.id);
    if (!state) continue;
    if (!worst || state.peakDepthCm > worst.peak) {
      worst = {
        segmentId: segment.id,
        name: segment.name,
        peak: state.peakDepthCm,
        onset: state.timeToFloodMin,
      };
    }
  }

  // Basements start taking water once the street is over kerb height.
  if (!worst || worst.peak < 14) return null;

  const deadline = worst.onset === null ? 0 : Math.max(0, worst.onset - 20);

  return {
    action: "move_vehicle",
    label: "Move your vehicle now",
    headline: `Basement parking at ${worst.name} is at risk — move any vehicle out before ${clockAt(now, tz, deadline)}`,
    score: 95,
    feasible: true,
    infeasibleReason: null,
    etaMin: null,
    riskLevel: worst.peak > 40 ? "severe" : "high",
    standalone: true,
    explanations: [
      {
        id: "dec_parking",
        text: `Street depth here peaks at ${depthLabel(worst.peak)}. Water above kerb height runs down a basement ramp far faster than it rises on the road — by the time the street looks bad, the basement is already flooded.`,
        category: "vehicle",
        impact: "increases-risk",
        weight: 1,
      },
      {
        id: "dec_parking_timing",
        text:
          worst.onset === null
            ? "Move it now — there is no useful warning time left."
            : `Water crosses kerb height in about ${formatDuration(worst.onset)}. Allow twenty minutes to move a vehicle and find somewhere higher.`,
        category: "timing",
        impact: "increases-risk",
        weight: 0.9,
      },
    ],
  };
}

function shelterOption(input: DecisionInput, reason: string): DecisionOption {
  return {
    action: "shelter_in_place",
    label: "Stay where you are",
    headline: "There is no safe way to make this journey right now",
    score: 100,
    feasible: true,
    infeasibleReason: null,
    etaMin: null,
    riskLevel: "severe",
    standalone: false,
    explanations: [
      {
        id: "dec_shelter",
        text: reason,
        category: "policy",
        impact: "blocks",
        weight: 1,
      },
      {
        id: "dec_shelter_advice",
        text: "Driving into standing water of unknown depth is the single most common way people die in urban floods. Wait it out and check again in thirty minutes.",
        category: "policy",
        impact: "blocks",
        weight: 0.95,
      },
    ],
  };
}

export const decisionAgent = new DecisionAgent();
