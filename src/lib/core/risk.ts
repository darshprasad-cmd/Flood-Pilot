import type { RiskLevel } from "./types";

/**
 * Risk level is derived from two things at once: how likely flooding is, and how
 * bad it would be if it happened. A near-certain 3 cm puddle is not "critical",
 * and a 20% chance of 40 cm on an underpass is not "low".
 */
export function riskLevelFrom(probability: number, depthCm: number): RiskLevel {
  const severity = depthSeverity(depthCm);
  const score = probability * 0.55 + severity * 0.45;

  if (score < 0.12) return "safe";
  if (score < 0.28) return "low";
  if (score < 0.45) return "moderate";
  if (score < 0.62) return "high";
  if (score < 0.8) return "severe";
  return "critical";
}

/** Normalise a water depth to 0..1, anchored on what depth means for a vehicle. */
export function depthSeverity(depthCm: number): number {
  // 0 cm  -> 0.00   nothing
  // 8 cm  -> 0.25   nuisance, low cars begin to struggle
  // 20 cm -> 0.50   most hatchbacks are out
  // 35 cm -> 0.75   SUVs are out
  // 60 cm -> 1.00   nothing civilian should be moving
  const stops: [number, number][] = [
    [0, 0],
    [8, 0.25],
    [20, 0.5],
    [35, 0.75],
    [60, 1],
  ];
  if (depthCm <= 0) return 0;
  if (depthCm >= 60) return 1;
  for (let i = 1; i < stops.length; i++) {
    const [x1, y1] = stops[i];
    const [x0, y0] = stops[i - 1];
    if (depthCm <= x1) {
      return y0 + ((depthCm - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}

export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; text: string; rank: number }
> = {
  safe: { label: "Safe", color: "#2fbf6f", text: "#8ff0bb", rank: 0 },
  low: { label: "Low", color: "#8fc93a", text: "#cfeb92", rank: 1 },
  moderate: { label: "Moderate", color: "#e8b62c", text: "#f7dc8c", rank: 2 },
  high: { label: "High", color: "#f08a3c", text: "#fcc79a", rank: 3 },
  severe: { label: "Severe", color: "#e8503a", text: "#ffab9c", rank: 4 },
  critical: { label: "Critical", color: "#b32b1d", text: "#ff9182", rank: 5 },
};

export function riskColor(level: RiskLevel): string {
  return RISK_META[level].color;
}

export function riskRank(level: RiskLevel): number {
  return RISK_META[level].rank;
}

export function worstRisk(levels: RiskLevel[]): RiskLevel {
  if (levels.length === 0) return "safe";
  return levels.reduce((a, b) => (riskRank(b) > riskRank(a) ? b : a));
}

/** Continuous colour along the risk ramp, for heatmaps and road tinting. */
export function rampColor(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [0.0, [47, 191, 111]],
    [0.2, [143, 201, 58]],
    [0.4, [232, 182, 44]],
    [0.6, [240, 138, 60]],
    [0.8, [232, 80, 58]],
    [1.0, [179, 43, 29]],
  ];
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    const [p0, c0] = stops[i - 1];
    if (x <= p1) {
      const k = (x - p0) / (p1 - p0);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}
