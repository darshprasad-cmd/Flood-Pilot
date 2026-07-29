/**
 * Core vocabulary shared by every layer of FloodPilot.
 *
 * The important idea here is `AgentEnvelope`: nothing in this system returns a
 * bare number. Every output carries the reasoning that produced it, an honest
 * confidence score, and the provenance of the inputs. The types are written so
 * that an unexplained output does not compile.
 */

/** A list guaranteed to hold at least one element. */
export type NonEmpty<T> = [T, ...T[]];

/** Build a `NonEmpty` from a possibly-empty list, falling back if needed. */
export function nonEmpty<T>(items: T[], fallback: T): NonEmpty<T> {
  return items.length > 0 ? (items as NonEmpty<T>) : [fallback];
}

/* -------------------------------------------------------------------------- */
/*  Risk                                                                      */
/* -------------------------------------------------------------------------- */

export const RISK_LEVELS = [
  "safe",
  "low",
  "moderate",
  "high",
  "severe",
  "critical",
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

/* -------------------------------------------------------------------------- */
/*  Explanation                                                               */
/* -------------------------------------------------------------------------- */

export type ExplanationCategory =
  | "weather"
  | "terrain"
  | "drainage"
  | "history"
  | "traffic"
  | "vehicle"
  | "route"
  | "timing"
  | "reports"
  | "confidence"
  | "policy";

/**
 * How a fact moved the outcome. `blocks` is reserved for hard constraints —
 * things that removed an option entirely rather than merely scoring it down.
 */
export type ExplanationImpact =
  | "increases-risk"
  | "reduces-risk"
  | "blocks"
  | "supports"
  | "neutral";

export interface EvidenceItem {
  label: string;
  value: string;
}

export interface Explanation {
  id: string;
  /** One line, written for a person in a hurry. No jargon, no hedging. */
  text: string;
  category: ExplanationCategory;
  impact: ExplanationImpact;
  /** 0..1 — used to rank reasons so the most important one is shown first. */
  weight: number;
  evidence?: EvidenceItem[];
}

export function sortExplanations(items: Explanation[]): Explanation[] {
  const impactRank: Record<ExplanationImpact, number> = {
    blocks: 0,
    "increases-risk": 1,
    "reduces-risk": 2,
    supports: 3,
    neutral: 4,
  };
  return [...items].sort(
    (a, b) => impactRank[a.impact] - impactRank[b.impact] || b.weight - a.weight,
  );
}

/* -------------------------------------------------------------------------- */
/*  Confidence                                                                */
/* -------------------------------------------------------------------------- */

export type ConfidenceBand = "low" | "moderate" | "high";

export interface ConfidenceFactor {
  key: string;
  label: string;
  /** 0..1 — how good this particular input is right now. */
  score: number;
  /** 0..1 — how much this factor matters to the overall confidence. */
  weight: number;
  /** Filled in when the factor is dragging confidence down. */
  note?: string;
}

export interface ConfidenceReport {
  score: number;
  band: ConfidenceBand;
  factors: ConfidenceFactor[];
  /**
   * Populated whenever confidence is not high. The product requirement is that
   * low confidence always states *why*, so this must not be empty below the
   * high band.
   */
  limitations: string[];
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "moderate";
  return "low";
}

/**
 * Combine weighted factors into a single report. Uses a weighted geometric mean
 * so one badly degraded input meaningfully pulls the whole score down instead of
 * being averaged away.
 */
export function buildConfidence(factors: ConfidenceFactor[]): ConfidenceReport {
  const usable = factors.filter((f) => f.weight > 0);
  if (usable.length === 0) {
    return {
      score: 0.5,
      band: "moderate",
      factors,
      limitations: ["No confidence factors were supplied for this prediction."],
    };
  }

  const totalWeight = usable.reduce((sum, f) => sum + f.weight, 0);
  const logSum = usable.reduce(
    (sum, f) => sum + f.weight * Math.log(Math.max(0.02, Math.min(1, f.score))),
    0,
  );
  const score = Math.max(0, Math.min(1, Math.exp(logSum / totalWeight)));
  const band = confidenceBand(score);

  const limitations = usable
    .filter((f) => f.score < 0.7 && f.note)
    .sort((a, b) => a.score * (1 - a.weight) - b.score * (1 - b.weight))
    .map((f) => f.note as string);

  if (band !== "high" && limitations.length === 0) {
    limitations.push(
      "Several inputs are only moderately reliable at this location.",
    );
  }

  return { score, band, factors, limitations };
}

/* -------------------------------------------------------------------------- */
/*  Provenance                                                                */
/* -------------------------------------------------------------------------- */

export type SignalKind =
  | "measured"
  | "forecast"
  | "modelled"
  | "seeded"
  | "crowdsourced";

export interface SignalProvenance {
  /** e.g. "open-meteo/forecast" */
  source: string;
  kind: SignalKind;
  fetchedAt: string;
  /** 0..1 — how much this source deserves to be trusted. */
  reliability: number;
  /** True only when a real upstream API answered successfully. */
  live: boolean;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/*  Agent envelope                                                            */
/* -------------------------------------------------------------------------- */

export interface AgentMeta {
  agent: string;
  version: string;
  computedAt: string;
  latencyMs: number;
  /** Which signal sources actually contributed to this answer. */
  inputs: SignalProvenance[];
  /** True when any required upstream signal fell back to simulation. */
  degraded: boolean;
}

export interface AgentEnvelope<T> {
  data: T;
  /** Non-optional by construction: no unexplained outputs. */
  explanations: NonEmpty<Explanation>;
  confidence: ConfidenceReport;
  meta: AgentMeta;
}

/* -------------------------------------------------------------------------- */
/*  Geo                                                                       */
/* -------------------------------------------------------------------------- */

export interface LatLng {
  lat: number;
  lng: number;
}
