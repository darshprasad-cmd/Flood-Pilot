import { clamp, invLerp, sigmoid } from "@/lib/core/math";
import { riskLevelFrom } from "@/lib/core/risk";
import type { RoadSegment } from "@/lib/graph/types";
import type { SegmentCalibration } from "@/lib/engine/calibration";
import { buildFloodConfidence } from "@/lib/engine/confidence";
import { explainFloodPrediction } from "@/lib/engine/explain";
import { buildFeatureVector, FLOOD_FEATURE_SPEC } from "@/lib/engine/feature-spec";
import { activeScoringModel } from "@/lib/engine/heuristic-model";
import { pondingParams, simulateHydrograph, type Hydrograph } from "@/lib/engine/hydrology";
import {
  ACTION_THRESHOLD_CM,
  assessWaterlogging,
  type WaterloggingAssessment,
} from "@/lib/engine/waterlogging";
import { warningRiskFloor } from "@/lib/signals/providers/imd";
import type { OsmSegmentEnrichment } from "@/lib/signals/providers/osm";
import { sampleAntecedent, sampleRiverDischarge, sampleWeather } from "@/lib/signals";
import type { SignalBundle } from "@/lib/signals/types";
import { registerHazardModel } from "../registry";
import type {
  Driver,
  FeatureVector,
  HazardContext,
  HazardModel,
  HazardPrediction,
} from "../types";

/**
 * The flood hazard model.
 *
 * Registers through the generic `HazardModel` contract, so nothing above it —
 * routing, the agents, the API, the UI — knows that flooding is special. What is
 * Delhi-specific lives in the *data* (trunk drains, gauge thresholds, the
 * waterlogging register) and in the feature weights, not in the plumbing.
 */

export interface FloodSignals {
  bundle: SignalBundle;
  calibration: SegmentCalibration;
  osm: OsmSegmentEnrichment | null;
  timezone: string;
  elevationSurveyed: boolean;
  elevationRange: [number, number];
}

export type FloodContext = HazardContext<RoadSegment, FloodSignals>;

/** Extras computed during extraction that `predict` needs again. */
const derivedCache = new WeakMap<
  FeatureVector,
  {
    effectiveDrainCapacity: number;
    trunkDrainPressure: number;
    floodplainPressure: number;
    hydrograph: Hydrograph;
    waterlogging: WaterloggingAssessment;
  }
>();

export class FloodModel implements HazardModel<RoadSegment, FloodSignals> {
  readonly kind = "flood" as const;
  readonly label = "Urban flooding and waterlogging";
  readonly version = "1.3.0";
  readonly spec = FLOOD_FEATURE_SPEC;
  readonly requiredSignals = ["rainfall", "elevation", "drainage", "river"];
  readonly actionThreshold = {
    value: ACTION_THRESHOLD_CM,
    unit: "cm",
    label: "Standing water",
  };

  extract(ctx: FloodContext): FeatureVector {
    const segment = ctx.subject;
    const { bundle, calibration, osm, elevationRange } = ctx.signals;

    const weather = sampleWeather(bundle, segment.midpoint);
    const antecedent = sampleAntecedent(bundle, segment.midpoint);
    const reports = bundle.reports.bySegment[segment.id];
    const traffic = bundle.traffic.bySegment[segment.id];

    const lowness = 1 - invLerp(elevationRange[0], elevationRange[1], segment.elevationM);
    const flatness = clamp(1 - segment.slopePct / 3);

    // Local drain capacity, adjusted by what OSM knows about real drainage
    // geography and by what people have reported about blockages.
    const osmAdjust = osm ? osmDrainageBonus(osm) : 0;
    const blockageReports = reports?.drainBlockageSignal ?? 0;
    const effectiveDrainCapacity = clamp(
      segment.drainCapacityIndex + osmAdjust - blockageReports * 0.35,
      0.03,
      1,
    );

    // How hard the trunk drain is pressing on this road: how close it is, how
    // silted, and how much rain is currently loading its catchment.
    const drain = segment.majorDrain;
    const proximity = drain ? clamp(1 - drain.distanceM / 1200) : 0;
    const rainLoad = clamp(weather.accum3hMm / 60);
    const trunkDrainPressure = drain
      ? clamp(proximity * (0.35 + 0.65 * drain.siltationIndex) * (0.45 + 0.55 * rainLoad))
      : 0;

    // River backwater, weighted by this road's exposure to the floodplain.
    const floodplainPressure = clamp(
      bundle.floodplainPressure * segment.floodplainExposure,
    );

    const naturalDrainageM =
      osm?.distanceToNaturalDrainageM ?? drain?.distanceM ?? 1800;

    const raw: Record<string, number> = {
      rain_peak_intensity: weather.peakIntensityMmHr,
      rain_accum_3h: weather.accum3hMm,
      rain_accum_24h: weather.accum24hMm,
      antecedent_wetness: antecedent.wetnessIndex,
      lowness,
      flatness,
      catchment: segment.catchmentIndex,
      impervious: segment.imperviousIndex,
      drain_capacity: effectiveDrainCapacity,
      drain_distance: segment.distToDrainM,
      underpass: segment.isUnderpass || osm?.osmUnderpass ? 1 : 0,
      flood_frequency: segment.floodFrequencyPerYear,
      river_excess: sampleRiverDischarge(bundle, segment.midpoint),
      report_signal: reports?.netFloodSignal ?? 0,
      traffic_density: traffic?.density ?? 0.4,
      drain_blockage_reports: blockageReports,
      floodplain_pressure: floodplainPressure,
      trunk_drain_pressure: trunkDrainPressure,
      natural_drainage_distance: naturalDrainageM,
    };

    const vector = buildFeatureVector(raw);

    // Run the depth model here so `predict` and the waterlogging assessment
    // share one hydrograph rather than simulating twice. The learned depth
    // correction goes in as a model parameter rather than onto the reported
    // number afterwards: routing decides `impassable` off the onset curve, so a
    // curve on a different scale from the displayed depth would send a car
    // through water the screen had already called too deep.
    const params = pondingParams(
      segment,
      antecedent.wetnessIndex,
      lowness,
      effectiveDrainCapacity,
      calibration.depthMultiplier,
    );

    // River backwater and a surcharged trunk drain both suppress recession —
    // this is what turns a two-hour closure into a two-day one.
    params.recessionPerHr *= clamp(
      1 - floodplainPressure * 0.8 - trunkDrainPressure * 0.35,
      0.08,
      1,
    );

    const hydrograph = simulateHydrograph(
      weather.curve,
      weather.currentRainMmHr,
      params,
      ACTION_THRESHOLD_CM,
    );

    const waterlogging = assessWaterlogging({
      segment,
      hydrograph,
      floodProbability: 0, // filled by predict; blockage ranking re-runs there
      floodplainPressure,
      trunkDrainPressure,
      effectiveDrainCapacity,
      blockageReports,
      trafficDensity: traffic?.density ?? 0.4,
      peakRainMmPerHr: weather.peakIntensityMmHr,
      horizonMin: ctx.horizonMin,
    });

    derivedCache.set(vector, {
      effectiveDrainCapacity,
      trunkDrainPressure,
      floodplainPressure,
      hydrograph,
      waterlogging,
    });

    return vector;
  }

  predict(vector: FeatureVector, ctx: FloodContext): HazardPrediction {
    const segment = ctx.subject;
    const { bundle, calibration, timezone, elevationSurveyed } = ctx.signals;
    const derived = derivedCache.get(vector);
    if (!derived) {
      throw new Error(
        "FloodModel.predict called with a vector that did not come from FloodModel.extract",
      );
    }

    const model = activeScoringModel();
    const score = model.score(vector.values);

    // Live learning: a per-segment correction fitted from verified outcomes.
    const adjustedLogit = score.logit + calibration.logitBias;
    let probability = sigmoid(adjustedLogit);

    // A colour-coded meteorological warning sets a floor. The met office issuing
    // an orange warning is information the model does not otherwise have.
    const warningFloor = Math.max(
      0,
      ...bundle.warnings.map((w) => warningRiskFloor(w.level)),
    );
    if (warningFloor > 0 && segment.floodFrequencyPerYear > 0.2) {
      probability = Math.max(probability, warningFloor * 0.8);
    }

    const drivers = buildDrivers(vector, score.contributions);

    const weather = sampleWeather(bundle, segment.midpoint);

    // Already on the calibrated scale — `extract` fed the learned multiplier
    // into the ponding model. Nothing here may scale depth again.
    const hydrograph = derived.hydrograph;

    // Re-run the blockage ranking now that probability is known.
    const waterlogging = assessWaterlogging({
      segment,
      hydrograph,
      floodProbability: probability,
      floodplainPressure: derived.floodplainPressure,
      trunkDrainPressure: derived.trunkDrainPressure,
      effectiveDrainCapacity: derived.effectiveDrainCapacity,
      blockageReports: vector.raw.drain_blockage_reports ?? 0,
      trafficDensity: vector.raw.traffic_density ?? 0.4,
      peakRainMmPerHr: weather.peakIntensityMmHr,
      horizonMin: ctx.horizonMin,
    });
    derived.waterlogging = waterlogging;

    const reportCount = bundle.reports.bySegment[segment.id]?.reportCount ?? 0;

    const confidence = buildFloodConfidence(
      segment,
      bundle,
      calibration,
      hydrograph.timeToThresholdMin,
      reportCount,
      elevationSurveyed,
    );

    const explanations = explainFloodPrediction({
      segment,
      raw: vector.raw,
      drivers,
      hydrograph,
      waterlogging,
      weather,
      bundle,
      timezone,
      now: ctx.now,
    });

    return {
      hazard: "flood",
      subjectId: segment.id,
      probability,
      magnitude: {
        value: hydrograph.currentDepthCm,
        unit: "cm",
        label: "Water depth",
      },
      peak: {
        value: hydrograph.peakDepthCm,
        unit: "cm",
        label: "Peak water depth",
      },
      severity: riskLevelFrom(probability, hydrograph.peakDepthCm),
      timeToOnsetMin: hydrograph.timeToThresholdMin,
      peakAtMin: hydrograph.peakAtMin,
      onsetCurve: hydrograph.points,
      confidence,
      drivers,
      explanations,
      model: {
        id: model.id,
        kind: model.kind,
        version: model.version,
        specVersion: this.spec.version,
      },
      inputs: bundle.provenances,
      computedAt: ctx.now.toISOString(),
      validForMin: 15,
    };
  }
}

/** Waterlogging outputs for a vector produced by `extract`. */
export function waterloggingFor(vector: FeatureVector): WaterloggingAssessment | null {
  return derivedCache.get(vector)?.waterlogging ?? null;
}

export function effectiveDrainCapacityFor(vector: FeatureVector): number {
  return derivedCache.get(vector)?.effectiveDrainCapacity ?? 0.5;
}

/* -------------------------------------------------------------------------- */

function osmDrainageBonus(osm: OsmSegmentEnrichment): number {
  const proximity = clamp(1 - osm.distanceToNaturalDrainageM / 1500);
  const culverts = clamp(osm.culvertCount / 4);
  return clamp(proximity * 0.16 + culverts * 0.08, -0.1, 0.22);
}

function buildDrivers(
  vector: FeatureVector,
  contributions: Record<string, number>,
): Driver[] {
  const total = Object.values(contributions).reduce(
    (sum, c) => sum + Math.abs(c),
    0,
  );

  return vector.spec.features
    .map((def) => {
      const contribution = contributions[def.key] ?? 0;
      return {
        feature: def.key,
        label: def.label,
        value: vector.raw[def.key] ?? 0,
        unit: def.unit,
        contribution,
        share: total === 0 ? 0 : Math.abs(contribution) / total,
        direction: contribution >= 0 ? ("raises" as const) : ("lowers" as const),
      };
    })
    .filter((d) => Math.abs(d.contribution) > 0.005)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

export const floodModel = new FloodModel();

registerHazardModel(floodModel);
