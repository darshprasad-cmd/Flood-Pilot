import { clamp } from "@/lib/core/math";
import type { RoadSegment } from "@/lib/graph/types";
import type { OnsetPoint } from "@/lib/hazard/types";
import type { RainPoint } from "@/lib/signals/types";

/**
 * Depth model.
 *
 * Probability answers "will this road flood". This answers the question that
 * actually decides what you do: **how deep, and when**. It is a lumped
 * reservoir model — crude next to a full 2D hydraulic solver, but it is driven
 * by the right variables and it produces a hydrograph rather than a single
 * number, which is what the timeline and the departure recommendation need.
 *
 *   ponded' = ponded + inflow - drainage,  then gravity recession
 *
 * Everything is expressed as millimetres of water standing on the road.
 */

/** Storm intensity Indian urban drainage is typically designed for. */
const DESIGN_STORM_MM_HR = 25;

const STEP_MIN = 15;

/** Water cannot pile up without limit; an open road sheds sideways eventually. */
const MAX_DEPTH_CM_ROAD = 120;
const MAX_DEPTH_CM_UNDERPASS = 260;

export interface PondingParams {
  /** Fraction of rain that becomes runoff rather than soaking in. */
  runoffCoefficient: number;
  /** How much the upstream catchment concentrates water onto this road. */
  catchmentGain: number;
  drainCapacityIndex: number;
  /** How much of the arriving water actually stands here versus flowing on. */
  pondingFactor: number;
  /**
   * Learned per-segment depth correction from verified outcomes. It is a model
   * parameter rather than a presentation tweak, because everything downstream —
   * onset timing, the impassable crossing, the curve routing reads — has to be
   * on the same scale as the depth the user is shown.
   */
  depthMultiplier: number;
  /** Gravity drainage rate, per hour. */
  recessionPerHr: number;
  maxDepthCm: number;
}

export function pondingParams(
  segment: RoadSegment,
  wetnessIndex: number,
  lowness: number,
  effectiveDrainCapacity: number,
  depthMultiplier: number,
): PondingParams {
  // Saturated ground stops absorbing, so the same rain produces far more runoff.
  const runoffCoefficient = clamp(
    segment.imperviousIndex * (0.55 + 0.45 * wetnessIndex),
    0.1,
    0.98,
  );

  // A large catchment funnels a whole neighbourhood's rainfall into one dip.
  // Quadratic because concentration rises faster than area near a low point.
  const catchmentGain = 1 + segment.catchmentIndex ** 2 * 9;

  const flatness = clamp(1 - segment.slopePct / 3);
  const basePonding = clamp(0.25 + flatness * 0.45 + lowness * 0.45, 0.15, 1.2);
  const pondingFactor = basePonding * (segment.isUnderpass ? 1.8 : 1);

  // Steep roads clear quickly. An underpass has no downhill to offer, so the
  // only way out is the pump.
  const recessionPerHr = clamp(
    (0.22 + segment.slopePct * 0.55) * (segment.isUnderpass ? 0.25 : 1),
    0.03,
    2,
  );

  return {
    runoffCoefficient,
    catchmentGain,
    drainCapacityIndex: effectiveDrainCapacity,
    pondingFactor,
    depthMultiplier,
    recessionPerHr,
    maxDepthCm: segment.isUnderpass ? MAX_DEPTH_CM_UNDERPASS : MAX_DEPTH_CM_ROAD,
  };
}

export interface Hydrograph {
  points: OnsetPoint[];
  currentDepthCm: number;
  peakDepthCm: number;
  peakAtMin: number | null;
  /** Minutes until depth crosses the action threshold; null if it never does. */
  timeToThresholdMin: number | null;
  /** Minutes until depth falls back below the threshold. */
  clearsAtMin: number | null;
  /** Total water that arrived, in mm. Used for confidence and diagnostics. */
  totalInflowMm: number;
}

/**
 * Step the reservoir through the forecast rainfall curve.
 *
 * The simulation starts an hour *before* now, using current observed intensity,
 * so a road that is already under water starts the forecast wet rather than dry.
 */
export function simulateHydrograph(
  curve: RainPoint[],
  currentRainMmHr: number,
  params: PondingParams,
  thresholdCm: number,
): Hydrograph {
  const dtHr = STEP_MIN / 60;
  const drainagePerStepMm =
    params.drainCapacityIndex * DESIGN_STORM_MM_HR * params.catchmentGain * dtHr;

  let ponded = 0;
  let totalInflowMm = 0;

  const advance = (mmPerHr: number) => {
    const rainMm = mmPerHr * dtHr;
    const inflow = rainMm * params.runoffCoefficient * params.catchmentGain;
    totalInflowMm += inflow;
    ponded = Math.max(0, ponded + inflow - drainagePerStepMm);
    ponded *= Math.exp(-params.recessionPerHr * dtHr);
  };

  // Warm-up: the hour already behind us.
  for (let i = 0; i < 4; i++) advance(currentRainMmHr);

  // Calibration multiplies inside the cap, not after it. A road that can only
  // hold 120 cm still only holds 120 cm however badly past predictions here
  // undershot; scaling the capped depth afterwards would report 240 cm.
  const toDepthCm = (mm: number) =>
    Math.min(
      params.maxDepthCm,
      (mm * params.pondingFactor * params.depthMultiplier) / 10,
    );

  const currentDepthCm = toDepthCm(ponded);

  const points: OnsetPoint[] = [
    { minutesFromNow: 0, value: currentDepthCm, forcing: currentRainMmHr },
  ];

  let peakDepthCm = currentDepthCm;
  let peakAtMin: number | null = currentDepthCm > 0.5 ? 0 : null;
  let timeToThresholdMin: number | null =
    currentDepthCm >= thresholdCm ? 0 : null;
  let clearsAtMin: number | null = null;

  for (const point of curve) {
    if (point.minutesFromNow === 0) continue;
    advance(point.mmPerHr);
    const depthCm = toDepthCm(ponded);

    points.push({
      minutesFromNow: point.minutesFromNow,
      value: depthCm,
      forcing: point.mmPerHr,
    });

    if (depthCm > peakDepthCm) {
      peakDepthCm = depthCm;
      peakAtMin = point.minutesFromNow;
    }
    if (timeToThresholdMin === null && depthCm >= thresholdCm) {
      timeToThresholdMin = point.minutesFromNow;
    }
    if (
      timeToThresholdMin !== null &&
      clearsAtMin === null &&
      point.minutesFromNow > timeToThresholdMin &&
      depthCm < thresholdCm
    ) {
      clearsAtMin = point.minutesFromNow;
    }
  }

  return {
    points,
    currentDepthCm,
    peakDepthCm,
    peakAtMin,
    timeToThresholdMin,
    clearsAtMin,
    totalInflowMm,
  };
}

/**
 * Depth on a segment at a given moment, read off the hydrograph.
 *
 * Routing needs this: a road that is safe now but 40 cm deep by the time you
 * reach it is not a safe road to route someone down.
 */
export function depthAtMinute(points: OnsetPoint[], minutesFromNow: number): number {
  if (points.length === 0) return 0;
  if (minutesFromNow <= points[0].minutesFromNow) return points[0].value;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (minutesFromNow <= b.minutesFromNow) {
      const span = b.minutesFromNow - a.minutesFromNow;
      const k = span === 0 ? 0 : (minutesFromNow - a.minutesFromNow) / span;
      return a.value + (b.value - a.value) * k;
    }
  }

  return points[points.length - 1].value;
}
