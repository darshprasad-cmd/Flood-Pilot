import { clamp, invLerp } from "@/lib/core/math";
import type { FeatureDef, FeatureSpec, FeatureVector } from "@/lib/hazard/types";

/**
 * The flood feature contract.
 *
 * **Order is load-bearing.** A trained model's input columns line up with this
 * array index-for-index, so features may be appended but never reordered or
 * removed without bumping `version` — and a model declares which spec version it
 * was fitted against.
 */
export const FLOOD_FEATURE_SPEC: FeatureSpec = {
  hazard: "flood",
  version: "flood-features-1.1.0",
  features: [
    {
      key: "rain_peak_intensity",
      label: "Peak rainfall intensity",
      unit: "mm/hr",
      min: 0,
      max: 100,
      neutral: 0.08,
      higherIsWorse: true,
      description:
        "Strongest rainfall rate forecast over the horizon. Intensity, not total, is what overwhelms a drain.",
    },
    {
      key: "rain_accum_3h",
      label: "Rainfall, next 3 hours",
      unit: "mm",
      min: 0,
      max: 120,
      neutral: 0.08,
      higherIsWorse: true,
      description: "Total volume arriving in the window where ponding builds.",
    },
    {
      key: "rain_accum_24h",
      label: "Rainfall, next 24 hours",
      unit: "mm",
      min: 0,
      max: 250,
      neutral: 0.08,
      higherIsWorse: true,
      description: "Longer-horizon volume, which governs how long water stays.",
    },
    {
      key: "antecedent_wetness",
      label: "Ground saturation",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.35,
      higherIsWorse: true,
      description:
        "How saturated the ground already is from recent rain. Dry soil absorbs; wet soil sends everything to the drains.",
    },
    {
      key: "lowness",
      label: "Low-lying position",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.5,
      higherIsWorse: true,
      description: "Where this road sits between the city's lowest and highest ground.",
    },
    {
      key: "flatness",
      label: "Flatness",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.6,
      higherIsWorse: true,
      description: "Flat roads pond; sloped roads shed water downhill.",
    },
    {
      key: "catchment",
      label: "Upstream catchment",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.55,
      higherIsWorse: true,
      description:
        "Size of the area draining onto this road. A big catchment concentrates a whole neighbourhood's rain into one dip.",
    },
    {
      key: "impervious",
      label: "Sealed surface",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.8,
      higherIsWorse: true,
      description: "Fraction of the catchment that is concrete rather than soil.",
    },
    {
      key: "drain_capacity",
      label: "Drain capacity",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.55,
      higherIsWorse: false,
      description:
        "Effective storm-drain capacity after silting — design capacity is not working capacity.",
    },
    {
      key: "drain_distance",
      label: "Distance to nearest drain",
      unit: "m",
      min: 0,
      max: 600,
      neutral: 0.35,
      higherIsWorse: true,
      description: "A functioning drain 400 m away does not help this road.",
    },
    {
      key: "underpass",
      label: "Underpass",
      unit: "0/1",
      min: 0,
      max: 1,
      neutral: 0,
      higherIsWorse: true,
      description:
        "Sunk below grade, so water can only leave by being pumped or by evaporating.",
    },
    {
      key: "flood_frequency",
      label: "Historical flood frequency",
      unit: "events/yr",
      min: 0,
      max: 2,
      neutral: 0.15,
      higherIsWorse: true,
      description:
        "How often this stretch has flooded before. The best single predictor of whether it will flood again.",
    },
    {
      key: "river_excess",
      label: "River level above normal",
      unit: "ratio",
      min: 0,
      max: 2,
      neutral: 0,
      higherIsWorse: true,
      description:
        "Modelled river discharge above its long-run mean, where a river reach is nearby.",
    },
    {
      key: "report_signal",
      label: "Citizen reports",
      unit: "signal",
      min: -1,
      max: 1,
      neutral: 0.5,
      higherIsWorse: true,
      description:
        "Time-decayed balance of people reporting this road flooded versus clear.",
    },
    {
      key: "traffic_density",
      label: "Traffic density",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.5,
      higherIsWorse: true,
      description:
        "Congestion does not cause flooding, but it decides how many people are caught by it.",
    },
    {
      key: "drain_blockage_reports",
      label: "Reported drain blockages",
      unit: "signal",
      min: 0,
      max: 1,
      neutral: 0,
      higherIsWorse: true,
      description: "Citizen-reported blockages, decayed over days rather than minutes.",
    },
    {
      key: "floodplain_pressure",
      label: "River backwater pressure",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0,
      higherIsWorse: true,
      description:
        "River stage against its warning thresholds, weighted by how exposed this road is to the floodplain. When the Yamuna passes 205.33 m at Old Railway Bridge, Delhi's outfalls reverse and drains start pushing water onto roads.",
    },
    {
      key: "trunk_drain_pressure",
      label: "Trunk drain pressure",
      unit: "index",
      min: 0,
      max: 1,
      neutral: 0.18,
      higherIsWorse: true,
      description:
        "How much this road depends on a nearby trunk drain that is silted or already loaded. A road 70 m from a choked Najafgarh drain floods from the drain, not from the sky.",
    },
    {
      key: "natural_drainage_distance",
      label: "Distance to natural drainage",
      unit: "m",
      min: 0,
      max: 2000,
      neutral: 0.4,
      higherIsWorse: true,
      description:
        "Metres to the nearest mapped drainage channel. Roads far from any channel have nowhere to shed water once local inlets are overwhelmed.",
    },
  ],
};

export const FEATURE_INDEX: Record<string, number> = Object.fromEntries(
  FLOOD_FEATURE_SPEC.features.map((f, i) => [f.key, i]),
);

export function featureDef(key: string): FeatureDef {
  const def = FLOOD_FEATURE_SPEC.features[FEATURE_INDEX[key]];
  if (!def) throw new Error(`Unknown feature "${key}" for ${FLOOD_FEATURE_SPEC.version}`);
  return def;
}

/** Map raw values onto the normalised 0..1 vector a model consumes. */
export function buildFeatureVector(raw: Record<string, number>): FeatureVector {
  const values = FLOOD_FEATURE_SPEC.features.map((def) =>
    clamp(invLerp(def.min, def.max, raw[def.key] ?? def.min)),
  );
  return { spec: FLOOD_FEATURE_SPEC, values, raw };
}
