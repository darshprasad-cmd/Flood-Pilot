import { confidenceBand } from "@/lib/core/types";
import { getCityPlugin } from "@/lib/cities/registry";
import { ensureRealElevations, getCityGraphAsync } from "@/lib/graph";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { SegmentState } from "@/lib/graph/types";
import { floodModel, type FloodSignals } from "@/lib/hazard/models/flood";
import type { HazardPrediction } from "@/lib/hazard/types";
import { collectSignals, HORIZON_MIN } from "@/lib/signals";
import {
  enrichSegmentFromOsm,
  loadOsmLayer,
  sourceStatuses,
  type OsmSegmentEnrichment,
  type ProviderStatus,
} from "@/lib/signals/providers";
import type { ScenarioId } from "@/lib/signals/scenarios";
import type { SignalBundle } from "@/lib/signals/types";
import { loadCalibration, NEUTRAL_CALIBRATION } from "./calibration";
import { waterloggingFor } from "@/lib/hazard/models/flood";

/**
 * The intelligence engine.
 *
 * One pass over the city: gather signals, score every road segment, and write the
 * dynamic layer back onto the graph so routing, the dashboards and the agents all
 * read the same numbers. Results are cached briefly, because a single page view
 * touches several API routes and they must not each rebuild the city.
 */

export interface EngineResult {
  graph: CityGraph;
  bundle: SignalBundle;
  predictions: Map<string, HazardPrediction>;
  states: SegmentState[];
  sources: ProviderStatus[];
  scenario: ScenarioId;
  computedAt: string;
  elevationSurveyed: boolean;
  computeMs: number;
}

const CACHE_TTL_MS = 45_000;

const globalRef = globalThis as typeof globalThis & {
  __floodpilotEngine?: Map<string, { at: number; result: EngineResult }>;
  __floodpilotOsmSegments?: Map<string, Map<string, OsmSegmentEnrichment>>;
};

export async function runFloodEngine(
  cityId: string,
  scenario: ScenarioId,
  now: Date = new Date(),
): Promise<EngineResult> {
  const cacheKey = `${cityId}:${scenario}`;
  const cache = (globalRef.__floodpilotEngine ??= new Map());
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const started = Date.now();
  const graph = await getCityGraphAsync(cityId);

  const [elevationSurveyed, osmLayer, bundle, calibration] = await Promise.all([
    ensureRealElevations(graph),
    loadOsmLayer(cityId),
    collectSignals(graph, scenario, now),
    loadCalibration(cityId),
  ]);

  // Match every road against the OSM drainage layer once per process — it is
  // pure geometry over a static network, so there is no reason to redo it.
  let osmBySegment = globalRef.__floodpilotOsmSegments?.get(cityId);
  if (!osmBySegment && osmLayer) {
    osmBySegment = new Map();
    for (const segment of graph.allSegments()) {
      osmBySegment.set(
        segment.id,
        enrichSegmentFromOsm(segment.midpoint, segment.geometry, osmLayer),
      );
    }
    (globalRef.__floodpilotOsmSegments ??= new Map()).set(cityId, osmBySegment);
  }

  const predictions = new Map<string, HazardPrediction>();
  const states: SegmentState[] = [];

  for (const segment of graph.allSegments()) {
    const signals: FloodSignals = {
      bundle,
      calibration: calibration.get(segment.id) ?? NEUTRAL_CALIBRATION,
      osm: osmBySegment?.get(segment.id) ?? null,
      timezone: graph.city.timezone,
      elevationSurveyed,
      elevationRange: graph.city.elevationRangeM,
    };

    const ctx = {
      subject: segment,
      subjectId: segment.id,
      signals,
      now,
      horizonMin: HORIZON_MIN,
    };

    const vector = floodModel.extract(ctx);
    const prediction = floodModel.predict(vector, ctx);
    const waterlogging = waterloggingFor(vector);

    predictions.set(segment.id, prediction);

    const state: SegmentState = {
      segmentId: segment.id,
      floodProbability: prediction.probability,
      depthCm: prediction.magnitude.value,
      riskLevel: prediction.severity,
      timeToFloodMin: prediction.timeToOnsetMin,
      peakAtMin: prediction.peakAtMin,
      peakDepthCm: prediction.peak.value,
      drainOverflowLikelihood: waterlogging?.drainOverflowLikelihood ?? 0,
      timeToImpassableMin: waterlogging?.timeToImpassableMin ?? null,
      recoveryMin: waterlogging?.recoveryMin ?? null,
      blockages: waterlogging?.blockages ?? [],
      confidence: prediction.confidence.score,
      confidenceBand: confidenceBand(prediction.confidence.score),
      trafficDensity: bundle.traffic.bySegment[segment.id]?.density ?? 0.4,
      drainCapacity: vector.raw.drain_capacity ?? 0.5,
      drivers: prediction.drivers,
      modelId: prediction.model.id,
      updatedAt: now.toISOString(),
    };

    graph.setState(state);
    states.push(state);
  }

  const result: EngineResult = {
    graph,
    bundle,
    predictions,
    states,
    sources: sourceStatuses(getCityPlugin(cityId), osmLayer),
    scenario,
    computedAt: now.toISOString(),
    elevationSurveyed,
    computeMs: Date.now() - started,
  };

  cache.set(cacheKey, { at: Date.now(), result });
  return result;
}

/** Drop cached results — used after a citizen report changes the picture. */
export function invalidateEngineCache(cityId?: string): void {
  const cache = globalRef.__floodpilotEngine;
  if (!cache) return;
  if (!cityId) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${cityId}:`)) cache.delete(key);
  }
}

export { ACTION_THRESHOLD_CM, IMPASSABLE_CM } from "./waterlogging";
export type { WaterloggingAssessment } from "./waterlogging";
export { loadCalibration, computeCalibration } from "./calibration";
export type { SegmentCalibration } from "./calibration";
export { FLOOD_FEATURE_SPEC } from "./feature-spec";
export { activeScoringModel, heuristicFloodModel } from "./heuristic-model";
