import { RISK_META } from "@/lib/core/risk";
import type { EngineResult } from "@/lib/engine";
import type { RoadSegment, SegmentState } from "@/lib/graph/types";
import type { HazardPrediction } from "@/lib/hazard/types";

/**
 * Wire formats.
 *
 * Kept explicit rather than serialising domain objects wholesale: the map view
 * needs 88 segments at once and must stay light, while the detail view needs
 * every explanation and driver for exactly one. Those are different payloads and
 * pretending otherwise makes both worse.
 */

export interface SegmentSummaryDto {
  id: string;
  name: string;
  corridor: string;
  geometry: { lat: number; lng: number }[];
  midpoint: { lat: number; lng: number };
  lengthM: number;
  roadClass: string;
  lanes: number;
  isUnderpass: boolean;
  elevationM: number;
  slopePct: number;
  populationExposure: number;
  basementParking: number;
  pumpStations: number;
  criticalFacilities: string[];
  hotspot: RoadSegment["hotspot"];
  majorDrain: RoadSegment["majorDrain"];
  floodplainExposure: number;
  floodHistoryCount: number;
  state: {
    probability: number;
    depthCm: number;
    peakDepthCm: number;
    riskLevel: string;
    riskColor: string;
    timeToFloodMin: number | null;
    /** Minutes to the crest. The forecast band marks it. */
    peakAtMin: number | null;
    timeToImpassableMin: number | null;
    recoveryMin: number | null;
    drainOverflowLikelihood: number;
    confidence: number;
    confidenceBand: string;
    trafficDensity: number;
    drainCapacity: number;
    topBlockages: {
      kind: string;
      label: string;
      likelihood: number;
      basis: string;
      consequence: string;
    }[];
    topDrivers: {
      feature: string;
      label: string;
      value: number;
      unit: string;
      share: number;
      direction: string;
    }[];
  };
}

export function serializeSegment(
  segment: RoadSegment,
  state: SegmentState,
): SegmentSummaryDto {
  return {
    id: segment.id,
    name: segment.name,
    corridor: segment.corridor,
    geometry: segment.geometry,
    midpoint: segment.midpoint,
    lengthM: Math.round(segment.lengthM),
    roadClass: segment.roadClass,
    // Needed client-side so the report form can bound "lanes blocked".
    lanes: segment.lanes,
    isUnderpass: segment.isUnderpass,
    elevationM: Math.round(segment.elevationM * 10) / 10,
    slopePct: Math.round(segment.slopePct * 100) / 100,
    populationExposure: segment.populationExposure,
    basementParking: segment.basementParking,
    pumpStations: segment.pumpStations,
    criticalFacilities: segment.criticalFacilities,
    hotspot: segment.hotspot,
    majorDrain: segment.majorDrain
      ? {
          ...segment.majorDrain,
          distanceM: Math.round(segment.majorDrain.distanceM),
        }
      : null,
    floodplainExposure: round2(segment.floodplainExposure),
    floodHistoryCount: segment.floodHistory.length,
    state: {
      probability: round3(state.floodProbability),
      depthCm: round1(state.depthCm),
      peakDepthCm: round1(state.peakDepthCm),
      riskLevel: state.riskLevel,
      riskColor: RISK_META[state.riskLevel].color,
      timeToFloodMin: state.timeToFloodMin,
      peakAtMin: state.peakAtMin,
      timeToImpassableMin: state.timeToImpassableMin,
      recoveryMin: state.recoveryMin,
      drainOverflowLikelihood: round3(state.drainOverflowLikelihood),
      confidence: round3(state.confidence),
      confidenceBand: state.confidenceBand,
      trafficDensity: round3(state.trafficDensity),
      drainCapacity: round3(state.drainCapacity),
      topBlockages: state.blockages.slice(0, 4).map((b) => ({
        kind: b.kind,
        label: b.label,
        likelihood: round3(b.likelihood),
        basis: b.basis,
        consequence: b.consequence,
      })),
      topDrivers: state.drivers.slice(0, 6).map((d) => ({
        feature: d.feature,
        label: d.label,
        value: round2(d.value),
        unit: d.unit,
        share: round3(d.share),
        direction: d.direction,
      })),
    },
  };
}

export interface CitySummaryDto {
  segmentsAtRisk: number;
  segmentsImpassable: number;
  peakDepthCm: number;
  peakProbability: number;
  meanConfidence: number;
  peopleExposed: number;
  underpassesAtRisk: number;
  hotspotsActive: number;
  nextOnsetMin: number | null;
  worstSegment: { id: string; name: string; depthCm: number } | null;
}

export function summarise(result: EngineResult): CitySummaryDto {
  const { graph, states } = result;

  let peopleExposed = 0;
  let atRisk = 0;
  let impassable = 0;
  let underpassesAtRisk = 0;
  let hotspotsActive = 0;
  let peakDepthCm = 0;
  let peakProbability = 0;
  let nextOnsetMin: number | null = null;
  let worst: { id: string; name: string; depthCm: number } | null = null;

  for (const state of states) {
    const segment = graph.getSegment(state.segmentId);
    if (!segment) continue;

    const risky = state.peakDepthCm >= 8 && state.floodProbability >= 0.35;
    if (risky) {
      atRisk++;
      peopleExposed += segment.populationExposure;
      if (segment.isUnderpass) underpassesAtRisk++;
      if (segment.hotspot) hotspotsActive++;
    }
    if (state.timeToImpassableMin !== null) impassable++;

    if (state.peakDepthCm > peakDepthCm) {
      peakDepthCm = state.peakDepthCm;
      worst = {
        id: segment.id,
        name: segment.name,
        depthCm: round1(state.peakDepthCm),
      };
    }
    peakProbability = Math.max(peakProbability, state.floodProbability);

    if (
      state.timeToFloodMin !== null &&
      (nextOnsetMin === null || state.timeToFloodMin < nextOnsetMin)
    ) {
      nextOnsetMin = state.timeToFloodMin;
    }
  }

  const meanConfidence =
    states.reduce((sum, s) => sum + s.confidence, 0) / Math.max(1, states.length);

  return {
    segmentsAtRisk: atRisk,
    segmentsImpassable: impassable,
    peakDepthCm: round1(peakDepthCm),
    peakProbability: round3(peakProbability),
    meanConfidence: round3(meanConfidence),
    peopleExposed,
    underpassesAtRisk,
    hotspotsActive,
    nextOnsetMin,
    worstSegment: worst,
  };
}

export interface ForecastDto {
  issuedAt: string;
  /** Hourly, out to twelve hours. */
  rain: { minutesFromNow: number; mmPerHr: number; peakMmPerHr: number; probability: number }[];
  /** Highest intensity anywhere in the city, and when. */
  peakMmPerHr: number;
  peakInMin: number | null;
  eventTotalMm: number;
  /**
   * What the flood model makes of that rain.
   *
   * Rainfall is the input; this is the output, on the same time axis so the two
   * can be read against each other. Delhi's whole problem is that the second
   * curve does not follow the shape of the first — the trunk drains keep
   * surcharging for hours after the sky clears.
   */
  model: {
    id: string;
    /** Mean confidence across every road, 0..1. */
    confidence: number;
    /**
     * Deepest water the model expects anywhere, at any time in the window.
     *
     * Taken from the raw curves rather than from the sampled points below. A
     * crest that falls between two samples is still a crest, and reporting the
     * sampled value here made the headline figure disagree with the per-road
     * numbers on the same screen by several centimetres.
     */
    peakDepthCm: number;
    peakAtMin: number | null;
    curve: {
      minutesFromNow: number;
      /** Deepest water modelled anywhere in the city at this time, cm. */
      maxDepthCm: number;
      /** Mean across roads that have any water at all, cm. */
      meanDepthCm: number;
      /** Roads at or over the action threshold at this time. */
      roadsAtRisk: number;
      /** Roads an ordinary car cannot cross at this time. */
      roadsImpassable: number;
    }[];
  } | null;
}

/** Depth in cm at an arbitrary minute, interpolated along the model's curve. */
function depthAt(
  curve: { minutesFromNow: number; value: number }[],
  minute: number,
): number {
  if (curve.length === 0) return 0;
  if (minute <= curve[0].minutesFromNow) return curve[0].value;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (minute <= b.minutesFromNow) {
      const span = b.minutesFromNow - a.minutesFromNow;
      const k = span === 0 ? 0 : (minute - a.minutesFromNow) / span;
      return a.value + (b.value - a.value) * k;
    }
  }
  return curve[curve.length - 1].value;
}

/** Vehicle-relevant depths, matching the waterlogging engine's thresholds. */
const ACTION_CM = 8;
const IMPASSABLE_CM = 30;

/**
 * The rainfall the city is about to get.
 *
 * Averaged across the sampled grid, with the peak carried alongside rather
 * than folded in. Delhi routinely has 40 mm falling on one side of the city
 * and nothing on the other, so a single averaged number would understate the
 * risk to whoever is standing under the cell that is actually raining.
 */
export function summariseForecast(
  weather: {
    issuedAt: string;
    cells: {
      curve: { minutesFromNow: number; mmPerHr: number; probability: number }[];
      peakIntensityMmHr: number;
      peakInMin: number | null;
      eventTotalMm: number;
    }[];
  },
  predictions?: Iterable<HazardPrediction>,
): ForecastDto {
  const cells = weather.cells;
  const rain: ForecastDto["rain"] = [];

  for (let hour = 0; hour <= 12; hour++) {
    const minute = hour * 60;
    let sum = 0;
    let peak = 0;
    let prob = 0;
    let counted = 0;

    for (const cell of cells) {
      const point = nearestPoint(cell.curve, minute);
      if (!point) continue;
      sum += point.mmPerHr;
      peak = Math.max(peak, point.mmPerHr);
      prob = Math.max(prob, point.probability);
      counted++;
    }
    if (counted === 0) continue;

    rain.push({
      minutesFromNow: minute,
      mmPerHr: round1(sum / counted),
      peakMmPerHr: round1(peak),
      probability: round2(prob),
    });
  }

  let peakMmPerHr = 0;
  let peakInMin: number | null = null;
  let eventTotalMm = 0;
  for (const cell of cells) {
    if (cell.peakIntensityMmHr > peakMmPerHr) {
      peakMmPerHr = cell.peakIntensityMmHr;
      peakInMin = cell.peakInMin;
    }
    eventTotalMm = Math.max(eventTotalMm, cell.eventTotalMm);
  }

  return {
    issuedAt: weather.issuedAt,
    rain,
    peakMmPerHr: round1(peakMmPerHr),
    peakInMin,
    eventTotalMm: round1(eventTotalMm),
    model: summariseModelCurve(predictions),
  };
}

/**
 * The model's own twelve hours, aggregated over every road.
 *
 * Read off each road's `onsetCurve` — the depth series the hazard model already
 * produced — rather than re-deriving anything. If this disagrees with the road
 * bands on the same screen, the engine is inconsistent with itself, which is
 * worth knowing.
 */
function summariseModelCurve(
  predictions?: Iterable<HazardPrediction>,
): ForecastDto["model"] {
  if (!predictions) return null;

  const list = [...predictions];
  if (list.length === 0) return null;

  const curve: NonNullable<ForecastDto["model"]>["curve"] = [];

  // The true crest, read off the raw curves. Delhi's underpasses fill and drain
  // fast enough that an hourly grid can miss a two-metre peak entirely.
  let peakDepthCm = 0;
  let peakAtMin: number | null = null;
  for (const prediction of list) {
    for (const point of prediction.onsetCurve) {
      if (point.value > peakDepthCm) {
        peakDepthCm = point.value;
        peakAtMin = point.minutesFromNow;
      }
    }
  }

  // Half-hourly. Twenty-five points is still a trivial payload and the shape of
  // a flash-flood curve is lost at hourly resolution.
  for (let step = 0; step <= 24; step++) {
    const minute = step * 30;
    let max = 0;
    let sum = 0;
    let wet = 0;
    let atRisk = 0;
    let impassable = 0;

    for (const prediction of list) {
      const depth = depthAt(prediction.onsetCurve, minute);
      if (depth > max) max = depth;
      // Averaged over roads with water on them, not over all 120 — otherwise
      // a genuine emergency on eight roads averages down to nothing.
      if (depth > 0.5) {
        sum += depth;
        wet++;
      }
      if (depth >= ACTION_CM) atRisk++;
      if (depth >= IMPASSABLE_CM) impassable++;
    }

    curve.push({
      minutesFromNow: minute,
      maxDepthCm: round1(max),
      meanDepthCm: wet === 0 ? 0 : round1(sum / wet),
      roadsAtRisk: atRisk,
      roadsImpassable: impassable,
    });
  }

  const confidence =
    list.reduce((n, p) => n + (p.confidence?.score ?? 0), 0) / list.length;

  return {
    id: list[0].model?.id ?? "unknown",
    confidence: round3(confidence),
    peakDepthCm: round1(peakDepthCm),
    peakAtMin,
    curve,
  };
}

/** The curve is denser near-term than later, so pick rather than index. */
function nearestPoint<T extends { minutesFromNow: number }>(
  curve: T[],
  minute: number,
): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const point of curve) {
    const gap = Math.abs(point.minutesFromNow - minute);
    if (gap < bestGap) {
      bestGap = gap;
      best = point;
    }
  }
  // Beyond the end of the curve there is no forecast, only extrapolation.
  return bestGap <= 90 ? best : null;
}

export function serializePrediction(prediction: HazardPrediction) {
  return {
    probability: round3(prediction.probability),
    magnitude: prediction.magnitude,
    peak: prediction.peak,
    severity: prediction.severity,
    timeToOnsetMin: prediction.timeToOnsetMin,
    peakAtMin: prediction.peakAtMin,
    onsetCurve: prediction.onsetCurve.map((p) => ({
      minutesFromNow: p.minutesFromNow,
      value: round1(p.value),
      forcing: round1(p.forcing),
    })),
    confidence: prediction.confidence,
    drivers: prediction.drivers,
    explanations: prediction.explanations,
    model: prediction.model,
    computedAt: prediction.computedAt,
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
