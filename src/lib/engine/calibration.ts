import { clamp, logit as toLogit, mean } from "@/lib/core/math";
import { getStore } from "@/lib/db";
import type { OutcomeRecord } from "@/lib/db/types";

/**
 * Live learning.
 *
 * Retraining a model is a batch job that happens on somebody else's schedule.
 * In the meantime, the system should still get better at the specific roads it
 * has been wrong about — so every prediction that later gets a ground-truth
 * observation contributes a residual, and the residuals become a per-segment
 * correction applied on top of the model.
 *
 * This is intentionally the *architecture* for learning rather than a clever
 * learner: a bias term in log-odds space and a multiplier on depth. When enough
 * outcomes accumulate, the same table is the training set for a gradient-boosted
 * model, and this correction shrinks towards zero as the model absorbs it.
 */

export interface SegmentCalibration {
  segmentId: string;
  /** Added to the model's log-odds output. */
  logitBias: number;
  /** Multiplies predicted depth. */
  depthMultiplier: number;
  sampleCount: number;
  /** Mean absolute probability error, which feeds the confidence score. */
  meanAbsError: number;
}

/** How aggressively to move towards observed outcomes. */
const LEARNING_RATE = 0.35;
const MAX_LOGIT_BIAS = 1.2;
const CACHE_TTL_MS = 60_000;

const globalRef = globalThis as typeof globalThis & {
  __floodpilotCalibration?: Map<
    string,
    { at: number; data: Map<string, SegmentCalibration> }
  >;
};

export async function loadCalibration(
  cityId: string,
): Promise<Map<string, SegmentCalibration>> {
  const cache = (globalRef.__floodpilotCalibration ??= new Map());
  const hit = cache.get(cityId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const outcomes = await getStore().listOutcomes(cityId);
  const data = computeCalibration(outcomes);
  cache.set(cityId, { at: Date.now(), data });
  return data;
}

export function computeCalibration(
  outcomes: OutcomeRecord[],
): Map<string, SegmentCalibration> {
  const bySegment = new Map<string, OutcomeRecord[]>();
  for (const o of outcomes) {
    const list = bySegment.get(o.segmentId);
    if (list) list.push(o);
    else bySegment.set(o.segmentId, [o]);
  }

  const result = new Map<string, SegmentCalibration>();

  for (const [segmentId, records] of bySegment) {
    // Newest first from the store; weight recent outcomes more heavily, because
    // drains get cleared and roads get resurfaced.
    const weighted = records.slice(0, 40);

    const residuals: number[] = [];
    const depthRatios: number[] = [];
    const absErrors: number[] = [];

    weighted.forEach((r, i) => {
      const recency = 0.94 ** i;

      // Observations are not certainties: a report of flooding means "very
      // likely", not "probability exactly 1".
      const observedProbability = r.observedFlooded ? 0.92 : 0.08;
      residuals.push(
        recency * (toLogit(observedProbability) - toLogit(r.predictedProbability)),
      );
      absErrors.push(Math.abs(observedProbability - r.predictedProbability));

      if (r.observedDepthCm !== null && r.predictedDepthCm > 1) {
        depthRatios.push(r.observedDepthCm / r.predictedDepthCm);
      }
    });

    const logitBias = clamp(
      mean(residuals) * LEARNING_RATE,
      -MAX_LOGIT_BIAS,
      MAX_LOGIT_BIAS,
    );

    const depthMultiplier =
      depthRatios.length > 0
        ? clamp(1 + (mean(depthRatios) - 1) * LEARNING_RATE, 0.5, 2)
        : 1;

    result.set(segmentId, {
      segmentId,
      logitBias,
      depthMultiplier,
      sampleCount: weighted.length,
      meanAbsError: mean(absErrors),
    });
  }

  return result;
}

export const NEUTRAL_CALIBRATION: SegmentCalibration = {
  segmentId: "",
  logitBias: 0,
  depthMultiplier: 1,
  sampleCount: 0,
  meanAbsError: 0,
};
