import { clockAt, formatDuration } from "@/lib/core/time";
import { depthLabel } from "@/lib/core/format";
import type { RiskLevel } from "@/lib/core/types";
import { riskLevelFrom } from "@/lib/core/risk";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { HazardPrediction } from "@/lib/hazard/types";
import type { SignalBundle } from "@/lib/signals/types";
import { sampleWeather } from "@/lib/signals";
import type { RouteResult } from "@/lib/routing/types";

/**
 * Prediction timeline.
 *
 * A probability tells you what might happen; a timeline tells you what to do
 * about it. The single most useful output of this whole system is a departure
 * time — the moment after which the journey stops being safe — and that only
 * exists if you model how the situation evolves rather than just its state now.
 */

export type TimelineKind =
  | "rain"
  | "traffic"
  | "flood"
  | "route"
  | "river"
  | "recovery"
  | "departure";

export interface TimelineEvent {
  minutesFromNow: number;
  clock: string;
  title: string;
  detail: string;
  kind: TimelineKind;
  severity: RiskLevel;
}

export interface PredictionTimeline {
  events: TimelineEvent[];
  /** Latest departure that still gets you there on a safe route. */
  latestSafeDepartureMin: number | null;
  /** What we actually advise — a few minutes of margin before the deadline. */
  recommendedDepartureMin: number | null;
  recommendedDepartureClock: string | null;
  /** When the safe window shuts. */
  windowClosesAtMin: number | null;
  /** True when the journey is already unsafe at every departure time. */
  noSafeWindow: boolean;
}

export interface TimelineInput {
  graph: CityGraph;
  bundle: SignalBundle;
  predictions: Map<string, HazardPrediction>;
  /** The route the timeline is about, when there is one. */
  route: RouteResult | null;
  /** Called for a candidate departure time; returns that route's score. */
  evaluateDeparture?: (departInMin: number) => {
    score: number;
    impassable: number;
  } | null;
  now: Date;
  horizonMin: number;
}

export function buildTimeline(input: TimelineInput): PredictionTimeline {
  const { graph, bundle, predictions, route, now, horizonMin } = input;
  const tz = graph.city.timezone;
  const events: TimelineEvent[] = [];

  const at = (minutesFromNow: number) => clockAt(now, tz, minutesFromNow);

  /* ── Rainfall ───────────────────────────────────────────────────────── */

  const focus = route?.legs[0]
    ? graph.getSegment(route.legs[0].segmentId)?.midpoint
    : graph.city.center;
  const weather = sampleWeather(bundle, focus ?? graph.city.center);

  const rainStart = weather.curve.find((p) => p.mmPerHr >= 2.5);
  if (rainStart && rainStart.minutesFromNow > 0) {
    events.push({
      minutesFromNow: rainStart.minutesFromNow,
      clock: at(rainStart.minutesFromNow),
      title: "Rain begins",
      detail: `Rainfall reaches ${rainStart.mmPerHr.toFixed(0)} mm/hr.`,
      kind: "rain",
      severity: "low",
    });
  } else if (weather.currentRainMmHr >= 2.5) {
    events.push({
      minutesFromNow: 0,
      clock: at(0),
      title: "Rain falling now",
      detail: `${weather.currentRainMmHr.toFixed(0)} mm/hr at this location.`,
      kind: "rain",
      severity: "low",
    });
  }

  if (weather.peakInMin !== null && weather.peakIntensityMmHr >= 6) {
    events.push({
      minutesFromNow: weather.peakInMin,
      clock: at(weather.peakInMin),
      title: "Rainfall peaks",
      detail: `${weather.peakIntensityMmHr.toFixed(0)} mm/hr — this is when the drains are overwhelmed.`,
      kind: "rain",
      severity: weather.peakIntensityMmHr > 40 ? "severe" : "moderate",
    });
  }

  const rainEnd = weather.curve.find(
    (p) =>
      weather.peakInMin !== null &&
      p.minutesFromNow > weather.peakInMin &&
      p.mmPerHr < 1.5,
  );
  if (rainEnd) {
    events.push({
      minutesFromNow: rainEnd.minutesFromNow,
      clock: at(rainEnd.minutesFromNow),
      title: "Rain eases",
      detail: "Rainfall drops below 1.5 mm/hr. Water already on the ground stays.",
      kind: "rain",
      severity: "low",
    });
  }

  /* ── Traffic ────────────────────────────────────────────────────────── */

  if (weather.peakInMin !== null && weather.peakIntensityMmHr >= 8) {
    const trafficAt = Math.max(5, weather.peakInMin - 20);
    events.push({
      minutesFromNow: trafficAt,
      clock: at(trafficAt),
      title: "Traffic builds",
      detail:
        "Delhi gridlocks well before roads become impassable. Congestion is usually the first thing you notice.",
      kind: "traffic",
      severity: "moderate",
    });
  }

  /* ── Road-level onsets ──────────────────────────────────────────────── */

  const onsets: { minutes: number; name: string; depthCm: number; risk: RiskLevel }[] =
    [];

  const relevantSegments = route
    ? route.legs.map((l) => l.segmentId)
    : graph.allSegments().map((s) => s.id);

  for (const segmentId of relevantSegments) {
    const prediction = predictions.get(segmentId);
    const segment = graph.getSegment(segmentId);
    const state = graph.getState(segmentId);
    if (!prediction || !segment || !state) continue;
    if (prediction.timeToOnsetMin === null) continue;
    if (prediction.probability < 0.4) continue;

    onsets.push({
      minutes: prediction.timeToOnsetMin,
      name: segment.name,
      depthCm: state.peakDepthCm,
      risk: riskLevelFrom(prediction.probability, state.peakDepthCm),
    });
  }

  onsets
    .sort((a, b) => a.minutes - b.minutes || b.depthCm - a.depthCm)
    .slice(0, route ? 6 : 5)
    .forEach((onset) => {
      events.push({
        minutesFromNow: onset.minutes,
        clock: at(onset.minutes),
        title: `${onset.name} floods`,
        detail: `Water crosses 8 cm, peaking around ${depthLabel(onset.depthCm)}.`,
        kind: "flood",
        severity: onset.risk,
      });
    });

  /* ── River ──────────────────────────────────────────────────────────── */

  for (const gauge of bundle.gauges) {
    if (gauge.status === "normal") continue;
    events.push({
      minutesFromNow: 0,
      clock: at(0),
      title: `${gauge.station.river} at ${gauge.status.replace("_", " ")}`,
      detail: `${gauge.levelM.toFixed(2)} m at ${gauge.station.name}; danger level is ${gauge.station.dangerLevelM} m.`,
      kind: "river",
      severity:
        gauge.status === "evacuation"
          ? "critical"
          : gauge.status === "danger"
            ? "severe"
            : "high",
    });

    if (gauge.forecastPeakInHr !== null && gauge.forecastPeakM !== null) {
      const min = gauge.forecastPeakInHr * 60;
      if (min <= horizonMin * 4) {
        events.push({
          minutesFromNow: min,
          clock: at(min),
          title: "River peaks",
          detail: `Forecast peak of ${gauge.forecastPeakM.toFixed(2)} m.`,
          kind: "river",
          severity: "severe",
        });
      }
    }
  }

  /* ── Departure window ───────────────────────────────────────────────── */

  const window = findDepartureWindow(input);

  if (window.latestSafeDepartureMin !== null) {
    events.push({
      minutesFromNow: window.latestSafeDepartureMin,
      clock: at(window.latestSafeDepartureMin),
      title: "Safe window closes",
      detail:
        "Leaving after this means the route is no longer passable in your vehicle.",
      kind: "route",
      severity: "severe",
    });
  }

  if (window.recommendedDepartureMin !== null) {
    events.push({
      minutesFromNow: window.recommendedDepartureMin,
      clock: at(window.recommendedDepartureMin),
      title: "Recommended departure",
      detail: window.safeThroughout
        ? "This route stays passable across the whole forecast window — there is no rush."
        : window.recommendedDepartureMin === 0
          ? "Leave now. The window is already closing, and waiting makes this journey worse."
          : `Leaving by ${at(window.recommendedDepartureMin)} keeps margin against the forecast.`,
      kind: "departure",
      severity: "safe",
    });
  }

  /* ── Recovery ───────────────────────────────────────────────────────── */

  if (route) {
    const recoveries = route.legs
      .map((leg) => graph.getState(leg.segmentId)?.recoveryMin ?? null)
      .filter((v): v is number => v !== null && v > 60);

    if (recoveries.length > 0) {
      const worst = Math.max(...recoveries);
      events.push({
        minutesFromNow: Math.min(worst, horizonMin * 3),
        clock: at(worst),
        title: "Route clears",
        detail: `The slowest stretch on this route takes about ${formatDuration(worst)} to drain.`,
        kind: "recovery",
        severity: "low",
      });
    }
  }

  events.sort((a, b) => a.minutesFromNow - b.minutesFromNow);

  return {
    events,
    latestSafeDepartureMin: window.latestSafeDepartureMin,
    recommendedDepartureMin: window.recommendedDepartureMin,
    recommendedDepartureClock:
      window.recommendedDepartureMin === null
        ? null
        : at(window.recommendedDepartureMin),
    windowClosesAtMin: window.latestSafeDepartureMin,
    noSafeWindow: window.noSafeWindow,
  };
}

/**
 * Search departure times for the last one that still works.
 *
 * Sweeps forward in five-minute steps and re-plans at each, because the answer
 * is genuinely time-dependent: a route can be fine at 07:20, unusable at 07:40,
 * and fine again three hours later once the water drains.
 */
function findDepartureWindow(input: TimelineInput): {
  latestSafeDepartureMin: number | null;
  recommendedDepartureMin: number | null;
  noSafeWindow: boolean;
  safeThroughout: boolean;
} {
  const { evaluateDeparture, horizonMin } = input;
  if (!evaluateDeparture) {
    return {
      latestSafeDepartureMin: null,
      recommendedDepartureMin: null,
      noSafeWindow: false,
      safeThroughout: false,
    };
  }

  const STEP = 5;
  const LIMIT = Math.min(horizonMin, 240);

  const now = evaluateDeparture(0);
  const safeNow = !!now && now.impassable === 0 && now.score >= 55;

  if (!safeNow) {
    // Not safe now — find the first departure that is, if any.
    for (let m = STEP; m <= LIMIT; m += STEP) {
      const result = evaluateDeparture(m);
      if (result && result.impassable === 0 && result.score >= 55) {
        return {
          latestSafeDepartureMin: null,
          recommendedDepartureMin: m,
          noSafeWindow: false,
          safeThroughout: false,
        };
      }
    }
    return {
      latestSafeDepartureMin: null,
      recommendedDepartureMin: null,
      noSafeWindow: true,
      safeThroughout: false,
    };
  }

  // Safe now — find when it stops being safe.
  let latest: number | null = null;
  for (let m = STEP; m <= LIMIT; m += STEP) {
    const result = evaluateDeparture(m);
    if (!result || result.impassable > 0 || result.score < 55) {
      latest = m - STEP;
      break;
    }
  }

  if (latest === null) {
    // Safe across the whole window — worth saying so rather than implying urgency.
    return {
      latestSafeDepartureMin: null,
      recommendedDepartureMin: 0,
      noSafeWindow: false,
      safeThroughout: true,
    };
  }

  // Advise leaving with a margin, because the forecast is not exact and neither
  // is the drive to the first junction.
  const margin = Math.max(5, Math.round(latest * 0.2));
  return {
    latestSafeDepartureMin: latest,
    recommendedDepartureMin: Math.max(0, latest - margin),
    noSafeWindow: false,
    safeThroughout: false,
  };
}
