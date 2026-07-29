import { sigmoid } from "@/lib/core/math";
import type { RawScore, ScoringModel } from "@/lib/hazard/types";
import { FLOOD_FEATURE_SPEC } from "./feature-spec";

/**
 * Hand-tuned logistic model over the flood feature spec.
 *
 * This is deliberately the simplest thing that can be correct: a linear model in
 * log-odds space whose weights were set against known Delhi behaviour — an
 * ordinary monsoon burst should put Minto Bridge and Pul Prahladpur near
 * certainty, a cloudburst should take the Ring Road with them, and the same rain
 * on high, well-drained ground in Vasant Kunj should stay near zero. A Yamuna
 * above danger level should flood the floodplain roads whether or not it is
 * raining on them.
 *
 * Two properties make it a good placeholder rather than a dead end:
 *
 *   1. Contributions are exact. `weight x (value - neutral)` *is* the feature's
 *      effect on the log-odds, so the "Why?" panel is reading the model, not a
 *      narrative bolted on afterwards.
 *   2. It implements `ScoringModel`. A gradient-boosted model trained on the
 *      outcome table returns the same shape — probability plus signed
 *      contributions, which for a tree model is the SHAP vector — so replacing
 *      this file changes nothing else in the codebase.
 */

/** Log-odds weights, keyed by feature. Signs follow `higherIsWorse`. */
const WEIGHTS: Record<string, number> = {
  rain_peak_intensity: 2.2,
  rain_accum_3h: 1.5,
  rain_accum_24h: 0.7,
  antecedent_wetness: 1.0,
  lowness: 1.3,
  flatness: 0.7,
  catchment: 1.2,
  impervious: 0.5,
  // Negative: capacity is the one feature where more is better.
  drain_capacity: -1.5,
  drain_distance: 0.5,
  underpass: 1.0,
  flood_frequency: 1.3,
  river_excess: 0.9,
  report_signal: 2.0,
  traffic_density: 0.25,
  drain_blockage_reports: 0.9,
  // Delhi's two structural mechanisms. River backwater carries the largest
  // single weight in the model because when the Yamuna is over its danger level
  // nothing else about a floodplain road matters.
  floodplain_pressure: 2.6,
  trunk_drain_pressure: 1.6,
  natural_drainage_distance: 0.6,
};

/**
 * Intercept. Tuned so that a road with every feature at its neutral value and no
 * rain sits at roughly a 5% chance — the background rate of a random urban road
 * flooding on a random day in the monsoon.
 */
const BIAS = -3.0;

export class HeuristicFloodModel implements ScoringModel {
  readonly id = "flood-heuristic-1.3.0";
  readonly kind = "heuristic" as const;
  readonly version = "1.3.0";
  readonly spec = FLOOD_FEATURE_SPEC;

  score(vector: number[]): RawScore {
    const contributions: Record<string, number> = {};
    let logit = BIAS;

    this.spec.features.forEach((def, i) => {
      const weight = WEIGHTS[def.key] ?? 0;
      // Attribution against the neutral baseline, so "average" features
      // contribute nothing and only what is unusual about this road shows up.
      const contribution = weight * ((vector[i] ?? def.neutral) - def.neutral);
      contributions[def.key] = contribution;
      logit += contribution;
    });

    return { logit, probability: sigmoid(logit), contributions };
  }
}

export const heuristicFloodModel = new HeuristicFloodModel();

/**
 * Active scoring model.
 *
 * Point this at a `GbdtFloodModel` once one is trained against
 * `FLOOD_FEATURE_SPEC` and the outcome table; nothing downstream needs to know.
 */
export function activeScoringModel(): ScoringModel {
  return heuristicFloodModel;
}
