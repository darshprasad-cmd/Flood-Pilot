import { clamp, haversineM } from "@/lib/core/math";
import type { RoadSegment, SegmentState } from "@/lib/graph/types";
import type { WeatherCell } from "@/lib/signals/types";
import {
  REPORT_META,
  type CommunityReport,
  type ConfidenceBand,
  type ReportVerification,
  type VerificationSignal,
} from "./types";

/**
 * Report verification.
 *
 * The rule this layer exists to enforce: **do not trust a report because
 * somebody made it.** A single anonymous claim of waterlogging on a dry day
 * with no corroboration is worth almost nothing; twelve independent claims
 * during heavy rain on a known hotspot, with traffic collapsing at the same
 * moment, are worth acting on.
 *
 * Confidence is built from independent signals that can each agree or disagree
 * with the claim. That structure matters more than the exact weights: it means
 * the system can explain *why* it believes a report, and it means spamming one
 * signal (making many reports from one device) cannot on its own reach high
 * confidence.
 */

export interface VerificationContext {
  report: CommunityReport;
  /** Other recent reports on the same segment or nearby. */
  neighbours: CommunityReport[];
  segment: RoadSegment | undefined;
  state: SegmentState | undefined;
  weather: WeatherCell | undefined;
  now: Date;
}

/** Reports further apart than this are not talking about the same thing. */
const NEIGHBOUR_RADIUS_M = 400;

export function verifyReport(ctx: VerificationContext): ReportVerification {
  const { report, segment, state, weather, now } = ctx;
  const meta = REPORT_META[report.type];
  const signals: VerificationSignal[] = [];

  /* ── 1. Corroboration ────────────────────────────────────────────────
     The strongest single signal, and deliberately counted by *distinct
     reporter*, not by report — otherwise one person tapping the button
     twelve times looks like twelve witnesses. */
  const window = meta.halfLifeMin * 2;
  const relevant = ctx.neighbours.filter(
    (n) =>
      n.id !== report.id &&
      haversineM(n.at, report.at) <= NEIGHBOUR_RADIUS_M &&
      ageMin(n, now) <= window,
  );

  const agreeing = new Set(
    relevant.filter((n) => n.type === report.type).map((n) => n.reporterId),
  );
  const contradicting = new Set(
    relevant
      .filter((n) => meta.contradictedBy.includes(n.type))
      .map((n) => n.reporterId),
  );

  const net = agreeing.size - contradicting.size;
  signals.push({
    key: "corroboration",
    label: "Independent reports",
    agrees: net >= 0,
    // Saturating: the second witness matters far more than the twelfth.
    strength: clamp(Math.abs(net) / 6),
    weight: 0.34,
    detail:
      agreeing.size === 0 && contradicting.size === 0
        ? "No other reports from this location."
        : `${agreeing.size} other ${agreeing.size === 1 ? "person reports" : "people report"} the same thing${
            contradicting.size > 0
              ? `, ${contradicting.size} report the opposite`
              : ""
          }.`,
  });

  /* ── 2. Weather consistency ─────────────────────────────────────────
     Only meaningful for claims about water. Someone reporting a pothole on
     a dry day is not suspicious; someone reporting waterlogging is. */
  if (meta.waterRelated) {
    const rain = weather?.currentRainMmHr ?? 0;
    const recentRain = weather?.accum3hMm ?? 0;
    const wet = rain > 1.5 || recentRain > 8;
    signals.push({
      key: "weather",
      label: "Weather consistency",
      agrees: wet,
      strength: wet ? clamp(Math.max(rain / 15, recentRain / 40)) : 0.75,
      weight: 0.24,
      detail: wet
        ? `Rainfall supports this — ${rain.toFixed(0)} mm/hr now, ${recentRain.toFixed(0)} mm over three hours.`
        : "No meaningful rainfall here. Water can still be present from a drain, but the claim is less likely.",
    });
  }

  /* ── 3. Traffic consistency ─────────────────────────────────────────
     A real obstruction shows up as slowed traffic. This is the signal that
     separates "the road is blocked" from "I wish the road were blocked". */
  if (meta.obstruction) {
    const density = state?.trafficDensity ?? 0.4;
    const slowed = density > 0.6;
    signals.push({
      key: "traffic",
      label: "Traffic consistency",
      agrees: slowed,
      strength: slowed ? clamp((density - 0.6) / 0.35) : 0.5,
      weight: 0.18,
      detail: slowed
        ? `Traffic here is at ${Math.round(density * 100)}% — consistent with an obstruction.`
        : `Traffic here is only at ${Math.round(density * 100)}%, which an obstruction would usually raise.`,
    });
  }

  /* ── 4. Historical plausibility ─────────────────────────────────────── */
  if (segment) {
    const hotspot = !!segment.hotspot;
    const history = segment.floodHistory.length;
    const relevantHistory = meta.waterRelated && (hotspot || history > 0);
    signals.push({
      key: "history",
      label: "Historical pattern",
      agrees: relevantHistory || !meta.waterRelated,
      strength: relevantHistory ? clamp(0.5 + history * 0.15) : 0.4,
      weight: 0.12,
      detail: relevantHistory
        ? segment.hotspot
          ? `${segment.hotspot.name} is on the recurring-waterlogging register.`
          : `This stretch has flooded ${history} time${history === 1 ? "" : "s"} before.`
        : meta.waterRelated
          ? "No recorded flooding on this stretch."
          : "No historical pattern applies to this report type.",
    });
  }

  /* ── 5. Model agreement ─────────────────────────────────────────────── */
  if (meta.waterRelated && state) {
    const predicted = state.floodProbability;
    const agrees = predicted > 0.3;
    signals.push({
      key: "model",
      label: "Model agreement",
      agrees,
      strength: agrees ? clamp(predicted) : clamp(1 - predicted) * 0.6,
      weight: 0.12,
      detail: agrees
        ? `The model already puts this road at ${Math.round(predicted * 100)}%.`
        : `The model puts this road at only ${Math.round(predicted * 100)}%. If the report is right, the model is wrong — which is worth knowing either way.`,
    });
  }

  /* ── 6. Reporter standing ───────────────────────────────────────────── */
  signals.push({
    key: "reporter",
    label: "Reporter history",
    agrees: report.reporterTrust >= 0.5,
    strength: clamp(report.reporterTrust),
    weight: 0.1,
    detail:
      report.reporterTrust >= 0.75
        ? "Reports from this account have been reliable."
        : report.reporterTrust <= 0.35
          ? "This account's previous reports have been contradicted."
          : "No established history for this reporter.",
  });

  /* ── Combine ─────────────────────────────────────────────────────────
     Agreeing signals push confidence up from a low prior; disagreeing ones
     pull it down. A report with no supporting evidence should land at low,
     not at "neutral" — the burden of proof is on the claim. */
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = signals.reduce(
    (sum, s) => sum + (s.agrees ? s.strength : -s.strength * 0.8) * s.weight,
    0,
  );

  const confidence = clamp(0.28 + (score / Math.max(0.001, totalWeight)) * 0.72);
  const band = toBand(confidence);

  return {
    confidence,
    band,
    signals,
    verdict: buildVerdict(band, signals, agreeing.size),
    // Below moderate a report is recorded and shown, but is not allowed to move
    // a prediction on its own.
    actionable: confidence >= 0.5,
  };
}

function toBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.82) return "very_high";
  if (confidence >= 0.62) return "high";
  if (confidence >= 0.42) return "moderate";
  return "low";
}

function buildVerdict(
  band: ConfidenceBand,
  signals: VerificationSignal[],
  agreeingCount: number,
): string {
  const supporting = signals.filter((s) => s.agrees && s.strength > 0.4);
  const against = signals.filter((s) => !s.agrees && s.strength > 0.4);

  if (band === "very_high") {
    return `Corroborated by ${agreeingCount} other ${agreeingCount === 1 ? "person" : "people"} and supported by ${supporting
      .map((s) => s.label.toLowerCase())
      .slice(0, 2)
      .join(" and ")}. Treated as confirmed.`;
  }
  if (band === "high") {
    return `Supported by ${supporting.map((s) => s.label.toLowerCase()).slice(0, 2).join(" and ")}. Acted on.`;
  }
  if (band === "moderate") {
    return against.length > 0
      ? `Plausible, but ${against[0].label.toLowerCase()} does not support it. Weighted down.`
      : "Plausible but weakly corroborated. Weighted down.";
  }
  return against.length > 0
    ? `Unverified — ${against[0].label.toLowerCase()} argues against it, and nothing corroborates it. Shown, but not acted on.`
    : "Unverified — nothing corroborates this yet. Shown, but not acted on.";
}

function ageMin(report: CommunityReport, now: Date): number {
  return (now.getTime() - Date.parse(report.createdAt)) / 60_000;
}

/**
 * Weight a verified report carries when it feeds the prediction engine.
 *
 * Combines verification confidence with time decay matched to how fast that
 * particular thing changes — waterlogging in forty minutes, a pothole in a
 * month.
 */
export function reportWeight(
  report: CommunityReport,
  verification: ReportVerification,
  now: Date,
): number {
  const meta = REPORT_META[report.type];
  const decay = 0.5 ** (Math.max(0, ageMin(report, now)) / meta.halfLifeMin);
  const severityLift =
    report.severity === "severe"
      ? 1.25
      : report.severity === "major"
        ? 1.12
        : report.severity === "minor"
          ? 0.85
          : 1;

  return clamp(verification.confidence * decay * severityLift, 0, 1.4);
}
