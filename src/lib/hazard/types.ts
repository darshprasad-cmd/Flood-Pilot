import type {
  ConfidenceReport,
  Explanation,
  NonEmpty,
  RiskLevel,
  SignalProvenance,
} from "@/lib/core/types";

/**
 * Hazards FloodPilot can reason about.
 *
 * Flooding is the one that is implemented, but nothing in this module is
 * flood-specific — a heatwave or an air-quality model registers through exactly
 * the same contract and the engine, graph and agents are unchanged.
 */
export const HAZARD_KINDS = [
  "flood",
  "heatwave",
  "dust_storm",
  "air_quality",
  "power_outage",
  "water_shortage",
] as const;

export type HazardKind = (typeof HAZARD_KINDS)[number];

/* -------------------------------------------------------------------------- */
/*  Feature contract                                                          */
/* -------------------------------------------------------------------------- */

/**
 * One input to a hazard model.
 *
 * `min`/`max` define the normalisation window: the engine maps a raw value into
 * 0..1 before scoring. This is what makes models interchangeable — a heuristic
 * and a gradient-boosted model consume the identical normalised vector.
 */
export interface FeatureDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  /**
   * The normalised value treated as "unremarkable" for this feature.
   *
   * Attribution is measured against this baseline, so a driver reads as "this
   * road is lower than most" rather than "this road has an elevation". It plays
   * exactly the role of a SHAP base value, which is why the explanation layer
   * does not change when a gradient-boosted model replaces the heuristic.
   */
  neutral: number;
  higherIsWorse: boolean;
  description: string;
}

/**
 * The ordered feature layout for a hazard. **Order is a contract**: a trained
 * model's input columns must match `features` index-for-index, so a new model
 * version must ship a new spec version rather than reordering this list.
 */
export interface FeatureSpec {
  hazard: HazardKind;
  version: string;
  features: FeatureDef[];
}

export interface FeatureVector {
  spec: FeatureSpec;
  /** Normalised 0..1 values, in spec order. This is what a model consumes. */
  values: number[];
  /** Raw, human-meaningful values keyed by feature. For explanation text. */
  raw: Record<string, number>;
}

/* -------------------------------------------------------------------------- */
/*  Scoring models                                                            */
/* -------------------------------------------------------------------------- */

export interface Driver {
  feature: string;
  label: string;
  value: number;
  unit: string;
  /** Signed contribution in log-odds space. */
  contribution: number;
  /** 0..1 share of the total absolute contribution. */
  share: number;
  direction: "raises" | "lowers";
}

export interface RawScore {
  logit: number;
  probability: number;
  /**
   * Signed per-feature contributions in log-odds space.
   *
   * For the heuristic this is `weight x value`; for a gradient-boosted model it
   * is the SHAP vector. Either way the explanation layer reads the same shape,
   * which is why swapping models does not change any downstream code.
   */
  contributions: Record<string, number>;
}

/**
 * The replaceable part of the intelligence engine.
 *
 * To move from heuristics to XGBoost/LightGBM, implement this interface against
 * the same `FeatureSpec` and register it. Nothing else changes.
 */
export interface ScoringModel {
  id: string;
  kind: "heuristic" | "gbdt" | "remote";
  version: string;
  spec: FeatureSpec;
  score(vector: number[]): RawScore;
}

/* -------------------------------------------------------------------------- */
/*  Predictions                                                               */
/* -------------------------------------------------------------------------- */

export interface HazardMagnitude {
  value: number;
  unit: string;
  label: string;
}

/** A single step of the modelled onset curve, used to draw the timeline. */
export interface OnsetPoint {
  minutesFromNow: number;
  /** Hazard magnitude at this moment, in the magnitude's unit. */
  value: number;
  /** Rate of the driving input (e.g. rainfall mm/hr) at this moment. */
  forcing: number;
}

export interface HazardPrediction {
  hazard: HazardKind;
  subjectId: string;
  probability: number;
  magnitude: HazardMagnitude;
  peak: HazardMagnitude;
  severity: RiskLevel;
  /** Minutes until the hazard crosses its action threshold. */
  timeToOnsetMin: number | null;
  peakAtMin: number | null;
  onsetCurve: OnsetPoint[];
  confidence: ConfidenceReport;
  drivers: Driver[];
  explanations: NonEmpty<Explanation>;
  model: { id: string; kind: string; version: string; specVersion: string };
  inputs: SignalProvenance[];
  computedAt: string;
  validForMin: number;
}

/* -------------------------------------------------------------------------- */
/*  Hazard model contract                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The context a hazard model receives. Deliberately loose (`unknown` subject +
 * a signal bag) so a non-flood hazard whose subject is a ward or a substation
 * rather than a road segment still fits.
 */
export interface HazardContext<TSubject = unknown, TSignals = unknown> {
  subject: TSubject;
  subjectId: string;
  signals: TSignals;
  now: Date;
  horizonMin: number;
}

export interface HazardModel<TSubject = unknown, TSignals = unknown> {
  kind: HazardKind;
  label: string;
  version: string;
  spec: FeatureSpec;
  /** Signal keys this model needs; used to report degraded operation. */
  requiredSignals: string[];
  /** Action threshold in the magnitude's unit (e.g. 8 cm of standing water). */
  actionThreshold: HazardMagnitude;
  extract(ctx: HazardContext<TSubject, TSignals>): FeatureVector;
  predict(
    vector: FeatureVector,
    ctx: HazardContext<TSubject, TSignals>,
  ): HazardPrediction;
}
