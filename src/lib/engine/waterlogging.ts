import { clamp } from "@/lib/core/math";
import type { BlockageRisk, RoadSegment } from "@/lib/graph/types";
import type { Hydrograph } from "./hydrology";

/**
 * Waterlogging engine.
 *
 * Probability and depth describe *whether* and *how much*. This module answers
 * the operational questions that actually change what someone does:
 *
 *   - Will the drain surcharge onto the road?
 *   - When does this stop being drivable?
 *   - How long after the rain stops before it is drivable again?
 *   - Which specific failure is going to happen here?
 *
 * Delhi's waterlogging is dominated by two mechanisms that rainfall alone cannot
 * express: trunk drains that back up hours after the rain, and the Yamuna
 * reversing the city's outfalls. Both are first-class inputs here.
 */

/** Depth at which an ordinary car can no longer pass safely. */
export const IMPASSABLE_CM = 30;

/** Depth at which the road is worth flagging at all. */
export const ACTION_THRESHOLD_CM = 8;

export interface WaterloggingAssessment {
  /** 0..1 chance the storm or trunk drain surcharges onto the road surface. */
  drainOverflowLikelihood: number;
  /** Minutes until an ordinary car cannot pass. Null if that never happens. */
  timeToImpassableMin: number | null;
  /**
   * Minutes from now until water falls back below the action threshold.
   * Null when the forecast horizon ends with the road still under water — which
   * is itself the answer for a floodplain road during a river flood.
   */
  recoveryMin: number | null;
  /** True when recovery runs past the modelled horizon. */
  recoveryExceedsHorizon: boolean;
  blockages: BlockageRisk[];
}

export interface WaterloggingInputs {
  segment: RoadSegment;
  hydrograph: Hydrograph;
  floodProbability: number;
  /** 0..1 river backwater pressure at this segment. */
  floodplainPressure: number;
  /** 0..1 trunk-drain loading at this segment. */
  trunkDrainPressure: number;
  /** 0..1 effective local drain capacity after reports. */
  effectiveDrainCapacity: number;
  /** 0..1 citizen-reported blockage signal. */
  blockageReports: number;
  trafficDensity: number;
  peakRainMmPerHr: number;
  horizonMin: number;
}

export function assessWaterlogging(
  input: WaterloggingInputs,
): WaterloggingAssessment {
  const { segment, hydrograph } = input;

  const drainOverflowLikelihood = overflowLikelihood(input);
  const timeToImpassableMin = crossingTime(hydrograph, IMPASSABLE_CM);
  const { recoveryMin, exceedsHorizon } = recoveryTime(input);

  return {
    drainOverflowLikelihood,
    timeToImpassableMin,
    recoveryMin,
    recoveryExceedsHorizon: exceedsHorizon,
    blockages: rankBlockages({
      ...input,
      drainOverflowLikelihood,
      timeToImpassableMin,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Drain overflow                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Likelihood the drainage network pushes water back onto the road.
 *
 * Three independent routes to the same outcome, combined as independent failure
 * probabilities rather than added — a road can be saved by none of them and
 * doomed by any one.
 */
function overflowLikelihood(input: WaterloggingInputs): number {
  const { segment, peakRainMmPerHr, effectiveDrainCapacity, hydrograph } = input;

  // 1. Local inlets simply outmatched by rainfall intensity. Expressed as a
  //    ratio against working capacity: at capacity nothing happens, at three and
  //    a half times capacity surcharge is certain.
  const designCapacityMmHr = Math.max(3, 25 * effectiveDrainCapacity);
  const intensityRoute = clamp(
    (peakRainMmPerHr / designCapacityMmHr - 1) / 2.5,
  );

  // 2. The trunk drain running full and surcharging back through the inlets.
  const trunkRoute = clamp(input.trunkDrainPressure * 1.15);

  // 3. The river holding the outfall shut.
  const backwaterRoute = clamp(input.floodplainPressure * 1.1);

  // Reported blockages raise all three.
  const reportLift = 1 + input.blockageReports * 0.5;

  const survive =
    (1 - clamp(intensityRoute * reportLift)) *
    (1 - clamp(trunkRoute * reportLift)) *
    (1 - clamp(backwaterRoute));

  // Construction narrowing the drainage section is a known aggravator.
  const constructionLift = segment.constructionObstruction ? 1.18 : 1;

  // Couple to the depth model. A drain can be nominally overwhelmed while
  // barely any water accumulates, and reporting that as "certain overflow"
  // alongside "4 cm of water" would be incoherent — overflow only means
  // something once there is water to push back onto the road.
  const materiality = clamp(hydrograph.peakDepthCm / 12);

  return clamp((1 - survive) * constructionLift * materiality);
}

/* -------------------------------------------------------------------------- */
/*  Timing                                                                    */
/* -------------------------------------------------------------------------- */

function crossingTime(hydrograph: Hydrograph, thresholdCm: number): number | null {
  if (hydrograph.currentDepthCm >= thresholdCm) return 0;
  for (const point of hydrograph.points) {
    if (point.value >= thresholdCm) return point.minutesFromNow;
  }
  return null;
}

/**
 * How long until the road is usable again.
 *
 * Recession is not symmetric with the rise. Once the drains are surcharged and
 * the river is holding the outfall shut, a road stops draining almost entirely —
 * which is exactly why Geeta Colony stays under for a day and Vasant Kunj is
 * clear in an hour.
 */
function recoveryTime(input: WaterloggingInputs): {
  recoveryMin: number | null;
  exceedsHorizon: boolean;
} {
  const { hydrograph, horizonMin } = input;

  if (hydrograph.peakDepthCm < ACTION_THRESHOLD_CM) {
    return { recoveryMin: 0, exceedsHorizon: false };
  }

  // The hydrograph already models recession; if it clears inside the horizon,
  // take that directly.
  if (hydrograph.clearsAtMin !== null) {
    return { recoveryMin: hydrograph.clearsAtMin, exceedsHorizon: false };
  }

  // Beyond the horizon: extrapolate from the terminal drainage rate, degraded
  // by whatever is stopping the water from leaving.
  const terminal = hydrograph.points[hydrograph.points.length - 1];
  if (!terminal || terminal.value < ACTION_THRESHOLD_CM) {
    return { recoveryMin: horizonMin, exceedsHorizon: false };
  }

  const blockedFraction = clamp(
    input.floodplainPressure * 0.7 + input.trunkDrainPressure * 0.45,
  );

  // Base recession of roughly 6 cm/hr on a road that can drain, scaled down
  // sharply as the outfalls close.
  const baseRateCmPerHr = 6 * (0.15 + 0.85 * (1 - blockedFraction));
  const pumped = input.segment.pumpStations > 0 ? 1 + input.segment.pumpStations * 0.22 : 1;
  const rateCmPerHr = Math.max(0.35, baseRateCmPerHr * pumped);

  const excessCm = terminal.value - ACTION_THRESHOLD_CM;
  const extraMin = (excessCm / rateCmPerHr) * 60;

  return {
    recoveryMin: Math.round(horizonMin + extraMin),
    exceedsHorizon: true,
  };
}

/* -------------------------------------------------------------------------- */
/*  Blockage detection                                                        */
/* -------------------------------------------------------------------------- */

interface BlockageInputs extends WaterloggingInputs {
  drainOverflowLikelihood: number;
  timeToImpassableMin: number | null;
}

/**
 * Model the specific ways this road fails.
 *
 * There is no live telemetry on Delhi's drains, pumps or basements, so these are
 * estimated from infrastructure, terrain, history and rainfall — and each one
 * states the basis it rests on, because a modelled risk presented as an
 * observation would be worse than no risk at all.
 */
function rankBlockages(input: BlockageInputs): BlockageRisk[] {
  const { segment, hydrograph, floodProbability } = input;
  const peak = hydrograph.peakDepthCm;
  const risks: BlockageRisk[] = [];

  const push = (risk: BlockageRisk) => {
    if (risk.likelihood >= 0.08) risks.push(risk);
  };

  /* Clogged local drains ------------------------------------------------- */
  const siltation = 1 - input.effectiveDrainCapacity;
  push({
    kind: "clogged_drain",
    label: "Clogged storm-water inlets",
    likelihood: clamp(siltation * 0.85 + input.blockageReports * 0.4),
    basis:
      input.blockageReports > 0.1
        ? `Modelled from drain condition, raised by citizen reports of blockage here.`
        : `Modelled from inlet density and desilting condition on this corridor.`,
    consequence:
      "Water has nowhere to go at the kerb, so ponding starts at lower rainfall than the drain's design suggests.",
  });

  /* Storm drain overflow -------------------------------------------------- */
  push({
    kind: "storm_drain_overflow",
    label: "Storm drain surcharging onto the road",
    likelihood: input.drainOverflowLikelihood,
    basis: segment.majorDrain
      ? `${segment.majorDrain.name} runs ${Math.round(segment.majorDrain.distanceM)} m away and is ${Math.round(segment.majorDrain.siltationIndex * 100)}% silted against its design section.`
      : "Modelled from local drain capacity against forecast rainfall intensity.",
    consequence:
      "Water arrives from the drain rather than the sky — it keeps rising after the rain stops.",
  });

  /* Trunk drain backflow -------------------------------------------------- */
  if (input.trunkDrainPressure > 0.2 || input.floodplainPressure > 0.15) {
    push({
      kind: "drain_backflow",
      label: "Drain backflow from a blocked outfall",
      likelihood: clamp(
        input.floodplainPressure * 0.8 + input.trunkDrainPressure * 0.5,
      ),
      basis:
        input.floodplainPressure > 0.15
          ? "River stage is high enough to hold the drainage outfall shut."
          : `Trunk drain loading on ${segment.majorDrain?.name ?? "the nearby drain"}.`,
      consequence:
        "The drainage network reverses. Pumping is the only way water leaves, and recovery is measured in hours or days.",
    });
  }

  /* Underpass flooding ---------------------------------------------------- */
  if (segment.isUnderpass) {
    push({
      kind: "underpass_flooding",
      label: "Underpass filling",
      likelihood: clamp(floodProbability * 1.1),
      basis: segment.hotspot
        ? `${segment.hotspot.name} is on the recurring-waterlogging register (${segment.hotspot.source}); typical depth ${segment.hotspot.typicalDepthCm} cm.`
        : "Below-grade road section with no gravity outfall.",
      consequence: `A sealed box below grade. Modelled peak here is ${Math.round(peak)} cm — deep enough to submerge a vehicle rather than merely stop it.`,
    });
  }

  /* Waterlogged intersection ---------------------------------------------- */
  if (segment.roadClass === "ring" || segment.roadClass === "arterial" || segment.roadClass === "highway") {
    // Gridlock needs water on the road, not merely a chance of it. Below about
    // 6 cm traffic slows but does not stop.
    const ponding = clamp(peak / 18);
    push({
      kind: "waterlogged_intersection",
      label: "Junction waterlogging and gridlock",
      likelihood: clamp(ponding * (0.55 + floodProbability * 0.3 + input.trafficDensity * 0.25)),
      basis: `Modelled from ${Math.round(peak)} cm of forecast ponding and ${Math.round(input.trafficDensity * 100)}% congestion on a ${segment.lanes}-lane ${segment.roadClass}.`,
      consequence:
        "In Delhi the gridlock usually arrives before the water does. Traffic stops moving well below the depth that actually blocks a car.",
    });
  }

  /* Basement parking ------------------------------------------------------ */
  if (segment.basementParking > 0) {
    // Basements fill from street level, so what matters is depth above the kerb.
    const overKerbCm = Math.max(0, peak - 12);
    push({
      kind: "basement_parking",
      label: "Basement parking flooding",
      likelihood: clamp(
        (overKerbCm / 45) * floodProbability * (1 + input.drainOverflowLikelihood * 0.5),
      ),
      basis: `${segment.basementParking} building${segment.basementParking === 1 ? "" : "s"} with basement parking front this stretch; modelled street depth peaks at ${Math.round(peak)} cm.`,
      consequence:
        "Water reaching a ramp fills the basement far faster than the street floods. Move vehicles out before the street is impassable, not after.",
    });
  }

  /* Pump failure ---------------------------------------------------------- */
  if (segment.pumpStations > 0) {
    // The risk is not that pumps break; it is that they are outmatched.
    const load = clamp(peak / 80);
    push({
      kind: "pump_failure",
      label: "Pumping capacity outmatched",
      likelihood: clamp(load * 0.7 + input.floodplainPressure * 0.35),
      basis: `${segment.pumpStations} pumping station${segment.pumpStations === 1 ? "" : "s"} serve this stretch; modelled inflow is ${Math.round(hydrograph.totalInflowMm)} mm over the event.`,
      consequence:
        "Pumps that cannot keep up turn a two-hour closure into a day-long one, and pumps discharging into a full drain achieve nothing.",
    });
  }

  /* Construction obstruction ---------------------------------------------- */
  if (segment.constructionObstruction) {
    push({
      kind: "construction_obstruction",
      label: "Construction obstructing drainage",
      likelihood: clamp(0.35 + floodProbability * 0.4),
      basis: "Active corridor construction is known to narrow the drainage section here.",
      consequence:
        "Reduced drain section and site spoil in the inlets. Behaves worse than the corridor's history suggests.",
    });
  }

  /* Road closure ---------------------------------------------------------- */
  push({
    kind: "road_closure",
    label: "Road closed to traffic",
    likelihood: clamp(
      input.timeToImpassableMin !== null
        ? floodProbability * 0.9
        : (peak / IMPASSABLE_CM) * floodProbability * 0.5,
    ),
    basis:
      input.timeToImpassableMin !== null
        ? `Modelled depth crosses ${IMPASSABLE_CM} cm — the point at which an ordinary car cannot pass.`
        : "Modelled peak stays below the depth that blocks an ordinary car.",
    consequence:
      segment.criticalFacilities.length > 0
        ? `Cuts access to ${segment.criticalFacilities.join(", ")}.`
        : `Removes a ${segment.lanes}-lane link carrying an estimated ${segment.populationExposure.toLocaleString()} people.`,
  });

  return risks.sort((a, b) => b.likelihood - a.likelihood);
}
