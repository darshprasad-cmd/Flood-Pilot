import { depthLabel } from "@/lib/core/format";
import { clockAt, formatDuration } from "@/lib/core/time";
import type { Explanation, RiskLevel } from "@/lib/core/types";
import type { EngineResult } from "@/lib/engine";
import type { PredictionTimeline } from "@/lib/engine/timeline";
import type { RouteComparison } from "@/lib/routing/types";
import type { SurvivabilityAssessment, VehicleProfile } from "@/lib/vehicles/types";
import { envelope, type Agent } from "./base";
import type { DecisionResult } from "./decision-agent";

/**
 * Citizen agent.
 *
 * The city-wide picture is not what a person needs. This narrows it to the four
 * things that actually concern one individual — their route, their vehicle,
 * where their car is parked, and when they have to leave — and writes them as
 * alerts somebody can act on without reading a dashboard.
 */

export interface CitizenAlert {
  id: string;
  kind: "route" | "vehicle" | "parking" | "timing" | "area" | "river";
  severity: RiskLevel;
  title: string;
  body: string;
  actionLabel: string | null;
}

export interface CitizenInput {
  result: EngineResult;
  comparison: RouteComparison | null;
  timeline: PredictionTimeline;
  decision: DecisionResult;
  vehicle: VehicleProfile | null;
  survivability: SurvivabilityAssessment | null;
  now: Date;
}

export class CitizenAgent implements Agent<CitizenInput, CitizenAlert[]> {
  readonly id = "citizen";
  readonly name = "Citizen Agent";
  readonly version = "1.0.0";
  readonly description =
    "Narrows the city-wide picture to what matters for one person's journey.";

  async run(input: CitizenInput) {
    const startedAt = Date.now();
    const { result, comparison, timeline, decision, vehicle, survivability, now } =
      input;
    const tz = result.graph.city.timezone;
    const alerts: CitizenAlert[] = [];

    /* ── The decision itself ─────────────────────────────────────────── */

    alerts.push({
      id: "alert_decision",
      kind: "route",
      severity: decision.primary.riskLevel,
      title: decision.primary.label,
      body: decision.primary.headline,
      actionLabel: null,
    });

    /* ── Departure window ────────────────────────────────────────────── */

    if (timeline.latestSafeDepartureMin !== null) {
      alerts.push({
        id: "alert_window",
        kind: "timing",
        severity: timeline.latestSafeDepartureMin < 30 ? "severe" : "high",
        title: `Safe window closes at ${clockAt(now, tz, timeline.latestSafeDepartureMin)}`,
        body: `You have about ${formatDuration(timeline.latestSafeDepartureMin)} before this route stops being passable in your vehicle.`,
        actionLabel: "See timeline",
      });
    } else if (timeline.noSafeWindow) {
      alerts.push({
        id: "alert_nowindow",
        kind: "timing",
        severity: "critical",
        title: "No safe departure time in the next few hours",
        body: "Every departure we modelled between now and the end of the forecast crosses water your vehicle cannot handle.",
        actionLabel: null,
      });
    }

    /* ── Vehicle ─────────────────────────────────────────────────────── */

    if (vehicle && survivability && comparison) {
      if (survivability.band !== "safe") {
        alerts.push({
          id: "alert_vehicle",
          kind: "vehicle",
          severity: survivability.band === "unsafe" ? "severe" : "high",
          title: `Your ${vehicle.manufacturer} ${vehicle.model} rates ${survivability.band}`,
          body: `The deepest water on the recommended route is ${depthLabel(comparison.safest.maxDepthCm)}, against a safe wading depth of ${depthLabel(survivability.maxSafeWadeCm)}.`,
          actionLabel: "Why?",
        });
      }
      if (survivability.flowWarning) {
        alerts.push({
          id: "alert_flow",
          kind: "vehicle",
          severity: "severe",
          title: "Moving water on this route",
          body: survivability.flowWarning,
          actionLabel: null,
        });
      }
    }

    /* ── Parking ─────────────────────────────────────────────────────── */

    for (const parallel of decision.parallel) {
      alerts.push({
        id: `alert_${parallel.action}`,
        kind: "parking",
        severity: parallel.riskLevel,
        title: parallel.label,
        body: parallel.headline,
        actionLabel: null,
      });
    }

    /* ── River ───────────────────────────────────────────────────────── */

    for (const gauge of result.bundle.gauges) {
      if (gauge.status === "normal") continue;
      alerts.push({
        id: `alert_river_${gauge.station.id}`,
        kind: "river",
        severity:
          gauge.status === "evacuation"
            ? "critical"
            : gauge.status === "danger"
              ? "severe"
              : "high",
        title: `${gauge.station.river} at ${gauge.levelM.toFixed(2)} m`,
        body: `${gauge.station.name}. Danger level is ${gauge.station.dangerLevelM} m. Floodplain roads flood from the river regardless of local rain.`,
        actionLabel: null,
      });
    }

    /* ── Area conditions ─────────────────────────────────────────────── */

    const worst = [...result.states].sort((a, b) => b.peakDepthCm - a.peakDepthCm)[0];
    if (worst && worst.peakDepthCm > 25) {
      const segment = result.graph.getSegment(worst.segmentId);
      if (segment) {
        alerts.push({
          id: "alert_area",
          kind: "area",
          severity: worst.riskLevel,
          title: `Worst point in the city: ${segment.name}`,
          body: `${Math.round(worst.floodProbability * 100)}% chance of flooding, peaking at ${depthLabel(worst.peakDepthCm)}${
            worst.recoveryMin ? `, clearing in about ${formatDuration(worst.recoveryMin)}` : ""
          }.`,
          actionLabel: null,
        });
      }
    }

    const explanations: Explanation[] = alerts.slice(0, 4).map((alert, i) => ({
      id: `cit_${i}`,
      text: `${alert.title} — ${alert.body}`,
      category: "policy" as const,
      impact:
        alert.severity === "safe" || alert.severity === "low"
          ? ("reduces-risk" as const)
          : ("increases-risk" as const),
      weight: 1 - i * 0.1,
    }));

    return envelope({
      data: alerts,
      explanations,
      fallbackExplanation: {
        id: "cit_quiet",
        text: "Nothing about current conditions affects this journey.",
        category: "policy",
        impact: "reduces-risk",
        weight: 0.3,
      },
      confidence: 0.82,
      agent: this.id,
      version: this.version,
      startedAt,
    });
  }
}

export const citizenAgent = new CitizenAgent();
