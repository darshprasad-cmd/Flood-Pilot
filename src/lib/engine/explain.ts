import { clockAt, formatDuration } from "@/lib/core/time";
import { depthLabel, depthReference, distanceLabel } from "@/lib/core/format";
import type { Explanation, NonEmpty } from "@/lib/core/types";
import { nonEmpty, sortExplanations } from "@/lib/core/types";
import type { RoadSegment } from "@/lib/graph/types";
import type { Driver } from "@/lib/hazard/types";
import type { SignalBundle, WeatherCell } from "@/lib/signals/types";
import type { Hydrograph } from "./hydrology";
import { ACTION_THRESHOLD_CM, IMPASSABLE_CM, type WaterloggingAssessment } from "./waterlogging";

/**
 * Turn a prediction into reasons a person can act on.
 *
 * These are generated *from the model*, not written alongside it: each rule fires
 * on a driver the scoring model actually produced, and its weight is that
 * driver's share of the total contribution. When the model changes its mind, the
 * explanation changes with it.
 *
 * The writing target is somebody deciding whether to leave the house in the next
 * ten minutes. One line each, concrete numbers, no hedging.
 */
export function explainFloodPrediction(args: {
  segment: RoadSegment;
  raw: Record<string, number>;
  drivers: Driver[];
  hydrograph: Hydrograph;
  waterlogging: WaterloggingAssessment;
  weather: WeatherCell;
  bundle: SignalBundle;
  timezone: string;
  now: Date;
}): NonEmpty<Explanation> {
  const {
    segment,
    raw,
    drivers,
    hydrograph,
    waterlogging,
    weather,
    bundle,
    timezone,
    now,
  } = args;

  const out: Explanation[] = [];
  const share = (key: string) =>
    drivers.find((d) => d.feature === key)?.share ?? 0;
  const raises = (key: string) =>
    (drivers.find((d) => d.feature === key)?.contribution ?? 0) > 0.02;

  /* ── Rainfall ───────────────────────────────────────────────────────── */

  if (weather.currentRainMmHr > 4) {
    out.push({
      id: "rain_now",
      text: `Rain is falling here now at ${weather.currentRainMmHr.toFixed(0)} mm/hr.`,
      category: "weather",
      impact: "increases-risk",
      weight: 0.9,
      evidence: [
        { label: "Current intensity", value: `${weather.currentRainMmHr.toFixed(1)} mm/hr` },
      ],
    });
  }

  if (weather.peakInMin !== null && weather.peakIntensityMmHr > 6) {
    const timing =
      weather.peakInMin <= 5
        ? "now"
        : `within ${formatDuration(weather.peakInMin)}`;
    out.push({
      id: "rain_peak",
      text: `Rainfall peaks at ${weather.peakIntensityMmHr.toFixed(0)} mm/hr ${timing} — ${clockAt(now, timezone, weather.peakInMin)}.`,
      category: "weather",
      impact: "increases-risk",
      weight: Math.max(0.85, share("rain_peak_intensity")),
      evidence: [
        { label: "Peak intensity", value: `${weather.peakIntensityMmHr.toFixed(0)} mm/hr` },
        { label: "Rain to 3 hr", value: `${weather.accum3hMm.toFixed(0)} mm` },
      ],
    });
  }

  const warning = bundle.warnings[0];
  if (warning && warning.level !== "green") {
    out.push({
      id: "imd_warning",
      text: `${warning.level.toUpperCase()} warning in force: ${warning.headline}.`,
      category: "weather",
      impact: "increases-risk",
      weight: 0.95,
      evidence: [
        { label: "Issued by", value: "India Meteorological Department" },
        { label: "Valid until", value: warning.validTo },
      ],
    });
  }

  /* ── River ──────────────────────────────────────────────────────────── */

  const gauge = bundle.gauges.find((g) => g.floodplainPressure > 0.05);
  if (gauge && segment.floodplainExposure > 0.25) {
    const overDanger = gauge.levelM >= gauge.station.dangerLevelM;
    out.push({
      id: "river_level",
      text: overDanger
        ? `The ${gauge.station.river} is at ${gauge.levelM.toFixed(2)} m — above the ${gauge.station.dangerLevelM} m danger level. This road is inside the floodplain.`
        : `The ${gauge.station.river} is at ${gauge.levelM.toFixed(2)} m, approaching the ${gauge.station.warningLevelM} m warning level, and this road drains into it.`,
      category: "terrain",
      impact: "increases-risk",
      weight: Math.max(0.95, share("floodplain_pressure")),
      evidence: [
        { label: "Gauge", value: gauge.station.name },
        { label: "Danger level", value: `${gauge.station.dangerLevelM} m` },
        { label: "24 hr trend", value: `${gauge.trendM24h >= 0 ? "+" : ""}${gauge.trendM24h.toFixed(2)} m` },
        { label: "Source", value: gauge.station.operator },
      ],
    });

    if (gauge.station.drivenBy && gauge.trendM24h > 0.05) {
      out.push({
        id: "river_upstream",
        text: `The river is still rising — releases from ${gauge.station.drivenBy} reach Delhi about ${gauge.station.upstreamLagHr ?? 48} hours later.`,
        category: "timing",
        impact: "increases-risk",
        weight: 0.7,
      });
    }
  }

  /* ── Drainage ───────────────────────────────────────────────────────── */

  if (segment.majorDrain && raises("trunk_drain_pressure")) {
    out.push({
      id: "trunk_drain",
      text: `The ${segment.majorDrain.name} runs ${distanceLabel(segment.majorDrain.distanceM)} from this road and is ${Math.round(segment.majorDrain.siltationIndex * 100)}% silted against its design section.`,
      category: "drainage",
      impact: "increases-risk",
      weight: Math.max(0.75, share("trunk_drain_pressure")),
      evidence: [
        { label: "Design capacity", value: `${segment.majorDrain.capacityCumecs} cumecs` },
        { label: "Distance", value: distanceLabel(segment.majorDrain.distanceM) },
      ],
    });
  }

  if (waterlogging.drainOverflowLikelihood > 0.45) {
    out.push({
      id: "drain_overflow",
      text: `Drains here are ${Math.round(waterlogging.drainOverflowLikelihood * 100)}% likely to surcharge — water will arrive from the drain, not just from the sky.`,
      category: "drainage",
      impact: "increases-risk",
      weight: 0.85,
    });
  }

  const capacity = raw.drain_capacity ?? 0.5;
  if (capacity < 0.4) {
    out.push({
      id: "drain_capacity",
      text: `Storm drains on this stretch are running at about ${Math.round(capacity * 100)}% of design capacity.`,
      category: "drainage",
      impact: "increases-risk",
      weight: Math.max(0.6, share("drain_capacity")),
    });
  } else if (capacity > 0.72) {
    out.push({
      id: "drain_capacity_good",
      text: `Drainage here is in good condition — about ${Math.round(capacity * 100)}% of design capacity is working.`,
      category: "drainage",
      impact: "reduces-risk",
      weight: 0.45,
    });
  }

  if ((raw.drain_blockage_reports ?? 0) > 0.15) {
    out.push({
      id: "blockage_reports",
      text: "People have reported blocked drains on this stretch in the last few days.",
      category: "reports",
      impact: "increases-risk",
      weight: 0.7,
    });
  }

  /* ── Terrain ────────────────────────────────────────────────────────── */

  if (segment.isUnderpass) {
    out.push({
      id: "underpass",
      text: "This is an underpass — it sits below grade, so water can only leave by being pumped.",
      category: "terrain",
      impact: "increases-risk",
      weight: 0.88,
    });
  }

  if (raises("lowness") && share("lowness") > 0.05) {
    out.push({
      id: "lowness",
      text: `Low ground: ${segment.elevationM.toFixed(0)} m, against a city range of ${segment.elevationM < 210 ? "198–232 m" : "198–232 m"}. Water from the surrounding area collects here.`,
      category: "terrain",
      impact: "increases-risk",
      weight: share("lowness"),
      evidence: [{ label: "Elevation", value: `${segment.elevationM.toFixed(0)} m` }],
    });
  }

  if (raises("catchment") && share("catchment") > 0.05) {
    out.push({
      id: "catchment",
      text: `A large upstream area drains onto this road, concentrating a whole neighbourhood's rainfall into one stretch.`,
      category: "terrain",
      impact: "increases-risk",
      weight: share("catchment"),
    });
  }

  if (segment.slopePct > 1.2) {
    out.push({
      id: "slope",
      text: `The road falls ${segment.slopePct.toFixed(1)}% along its length, so water runs off rather than standing.`,
      category: "terrain",
      impact: "reduces-risk",
      weight: 0.45,
    });
  }

  if ((raw.natural_drainage_distance ?? 0) > 1200) {
    out.push({
      id: "no_natural_drainage",
      text: `The nearest mapped drainage channel is ${distanceLabel(raw.natural_drainage_distance)} away — there is nowhere close for water to go.`,
      category: "drainage",
      impact: "increases-risk",
      weight: Math.max(0.5, share("natural_drainage_distance")),
    });
  }

  /* ── History ────────────────────────────────────────────────────────── */

  if (segment.hotspot) {
    out.push({
      id: "hotspot",
      text: `${segment.hotspot.name} is a ${segment.hotspot.severity} waterlogging point, typically ${segment.hotspot.typicalDepthCm} cm deep for about ${segment.hotspot.typicalDurationHr} hours.`,
      category: "history",
      impact: "increases-risk",
      weight: 0.92,
      evidence: [{ label: "Register", value: segment.hotspot.source }],
    });
  }

  if (segment.floodHistory.length > 0) {
    const deepest = segment.floodHistory.reduce((a, b) =>
      b.depthCm > a.depthCm ? b : a,
    );
    out.push({
      id: "history",
      text: `Flooded ${segment.floodHistory.length} time${segment.floodHistory.length === 1 ? "" : "s"} in the recorded history here — deepest ${depthLabel(deepest.depthCm)} on ${deepest.date}.`,
      category: "history",
      impact: "increases-risk",
      weight: Math.max(0.6, share("flood_frequency")),
      evidence: segment.floodHistory.slice(0, 3).map((h) => ({
        label: h.date,
        value: `${depthLabel(h.depthCm)} for ${h.durationHr} hr`,
      })),
    });
  } else {
    out.push({
      id: "no_history",
      text: "No recorded flooding on this stretch.",
      category: "history",
      impact: "reduces-risk",
      weight: 0.35,
    });
  }

  /* ── Ground saturation ──────────────────────────────────────────────── */

  const wetness = raw.antecedent_wetness ?? 0;
  if (wetness > 0.5) {
    out.push({
      id: "wetness",
      text: `The ground is already saturated — ${(raw.rain_accum_24h ?? 0) > 0 ? "" : ""}${Math.round(bundle.antecedent.cells[0]?.last7dMm ?? 0)} mm fell across the last week, so almost all of this rain becomes runoff.`,
      category: "weather",
      impact: "increases-risk",
      weight: Math.max(0.55, share("antecedent_wetness")),
    });
  }

  /* ── Citizen reports ────────────────────────────────────────────────── */

  const reportSignal = raw.report_signal ?? 0;
  const reading = bundle.reports.bySegment[segment.id];
  if (reportSignal > 0.15 && reading) {
    out.push({
      id: "reports_flooded",
      text: `${reading.reportCount} recent report${reading.reportCount === 1 ? "" : "s"} of flooding on this road${reading.observedDepthCm ? `, around ${depthLabel(reading.observedDepthCm)} deep` : ""}.`,
      category: "reports",
      impact: "increases-risk",
      weight: Math.max(0.8, share("report_signal")),
    });
  } else if (reportSignal < -0.15 && reading) {
    out.push({
      id: "reports_clear",
      text: `${reading.reportCount} recent report${reading.reportCount === 1 ? "" : "s"} that this road is currently clear.`,
      category: "reports",
      impact: "reduces-risk",
      weight: 0.65,
    });
  }

  /* ── Timing and depth ───────────────────────────────────────────────── */

  if (hydrograph.timeToThresholdMin !== null) {
    out.push({
      id: "onset",
      text:
        hydrograph.timeToThresholdMin === 0
          ? `Water is standing here now — around ${depthLabel(hydrograph.currentDepthCm)}, ${depthReference(hydrograph.currentDepthCm)}.`
          : `Water crosses ${ACTION_THRESHOLD_CM} cm in ${formatDuration(hydrograph.timeToThresholdMin)}, at ${clockAt(now, timezone, hydrograph.timeToThresholdMin)}.`,
      category: "timing",
      impact: "increases-risk",
      weight: 0.93,
    });
  }

  if (waterlogging.timeToImpassableMin !== null) {
    out.push({
      id: "impassable",
      text: `Impassable to an ordinary car from ${clockAt(now, timezone, waterlogging.timeToImpassableMin)} — modelled peak ${depthLabel(hydrograph.peakDepthCm)}, ${depthReference(hydrograph.peakDepthCm)}.`,
      category: "timing",
      impact: "blocks",
      weight: 1,
      evidence: [
        { label: "Peak depth", value: depthLabel(hydrograph.peakDepthCm) },
        { label: "Blocks a car above", value: `${IMPASSABLE_CM} cm` },
      ],
    });
  }

  if (waterlogging.recoveryMin !== null && waterlogging.recoveryMin > 60) {
    out.push({
      id: "recovery",
      text: waterlogging.recoveryExceedsHorizon
        ? `Once flooded, this road stays under for an estimated ${formatDuration(waterlogging.recoveryMin)} — the outfall is blocked, so it drains slowly.`
        : `Clears about ${formatDuration(waterlogging.recoveryMin)} from now.`,
      category: "timing",
      impact: waterlogging.recoveryExceedsHorizon ? "increases-risk" : "neutral",
      weight: 0.6,
    });
  }

  /* ── Traffic ────────────────────────────────────────────────────────── */

  const traffic = raw.traffic_density ?? 0;
  if (traffic > 0.68) {
    out.push({
      id: "traffic",
      text: `Traffic here is already at ${Math.round(traffic * 100)}% — in Delhi the gridlock usually arrives before the water does.`,
      category: "traffic",
      impact: "increases-risk",
      weight: 0.5,
    });
  }

  /* ── Fallback ───────────────────────────────────────────────────────── */

  const fallback: Explanation = {
    id: "baseline",
    text: "No rainfall, river pressure or drainage stress of note on this road right now.",
    category: "weather",
    impact: "reduces-risk",
    weight: 0.3,
  };

  return nonEmpty(sortExplanations(out), fallback);
}
