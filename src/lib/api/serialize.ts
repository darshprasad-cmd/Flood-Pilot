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
