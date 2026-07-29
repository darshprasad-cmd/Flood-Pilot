import { clamp } from "@/lib/core/math";
import { formatDuration } from "@/lib/core/time";
import {
  buildConfidence,
  type ConfidenceFactor,
  type ConfidenceReport,
} from "@/lib/core/types";
import type { RoadSegment } from "@/lib/graph/types";
import type { SignalBundle } from "@/lib/signals/types";
import type { SegmentCalibration } from "./calibration";

/**
 * Confidence for a flood prediction.
 *
 * The point of this module is that confidence must be *earned* from the actual
 * state of the inputs, not printed as a reassuring number next to the answer. If
 * the rainfall is simulated, if the road has never been observed to flood, or if
 * nobody has ever verified a prediction here, the score has to say so — and the
 * limitation text is what the UI shows when confidence is not high.
 */
export function buildFloodConfidence(
  segment: RoadSegment,
  bundle: SignalBundle,
  calibration: SegmentCalibration,
  timeToOnsetMin: number | null,
  reportCount: number,
  elevationIsSurveyed: boolean,
): ConfidenceReport {
  const factors: ConfidenceFactor[] = [];

  /* Rainfall — by far the biggest term. -------------------------------- */
  const rain = bundle.weather.provenance;
  factors.push({
    key: "rainfall_source",
    label: "Rainfall data",
    score: rain.reliability,
    weight: 0.3,
    note: rain.live
      ? undefined
      : rain.kind === "modelled" && rain.source.startsWith("floodpilot/scenario")
        ? "Rainfall is a simulated scenario, not a live forecast."
        : "The live forecast could not be reached, so rainfall is modelled.",
  });

  /* Lead time — convective rain is barely forecastable beyond a couple of
     hours, so a prediction six hours out deserves less trust. ------------- */
  const leadScore =
    timeToOnsetMin === null ? 0.85 : 1 - clamp(timeToOnsetMin / 720) * 0.45;
  factors.push({
    key: "lead_time",
    label: "Forecast lead time",
    score: leadScore,
    weight: 0.15,
    note:
      timeToOnsetMin !== null && timeToOnsetMin > 180
        ? `Onset is ${formatDuration(timeToOnsetMin)} away; short-duration storms are hard to place accurately that far ahead.`
        : undefined,
  });

  /* Spatial agreement across the rainfall grid. -------------------------- */
  const spread = bundle.weather.spatialVarianceMmHr;
  const spatialScore = 1 - clamp(spread / 35) * 0.5;
  factors.push({
    key: "spatial_agreement",
    label: "Rainfall agreement across the city",
    score: spatialScore,
    weight: 0.12,
    note:
      spread > 14
        ? "Forecast rainfall differs sharply between parts of the city, so the estimate for this specific road is less certain."
        : undefined,
  });

  /* Terrain. ------------------------------------------------------------- */
  factors.push({
    key: "terrain",
    label: "Terrain data",
    score: elevationIsSurveyed ? 0.92 : 0.6,
    weight: 0.15,
    note: elevationIsSurveyed
      ? undefined
      : "Junction heights are seeded from published topography rather than a digital elevation model.",
  });

  /* Drainage — modelled everywhere, and honest about it. ----------------- */
  factors.push({
    key: "drainage",
    label: "Drainage data",
    score: 0.55,
    weight: 0.1,
    note: "Drain positions and silting are modelled; no municipal drainage inventory is connected.",
  });

  /* Historical support. -------------------------------------------------- */
  const historyCount = segment.floodHistory.length;
  factors.push({
    key: "history",
    label: "Flood history",
    score: 0.45 + clamp(historyCount / 4) * 0.5,
    weight: 0.13,
    note:
      historyCount === 0
        ? "No recorded flooding on this stretch, so the estimate rests on terrain and drainage alone."
        : undefined,
  });

  /* Ground truth from citizens. ------------------------------------------ */
  factors.push({
    key: "ground_truth",
    label: "Live ground truth",
    score: 0.5 + clamp(reportCount / 4) * 0.45,
    weight: 0.1,
    note:
      reportCount === 0
        ? "Nobody has reported conditions on this road recently."
        : undefined,
  });

  /* How well the model has done here before. ----------------------------- */
  factors.push({
    key: "calibration",
    label: "Model calibration here",
    score:
      calibration.sampleCount === 0
        ? 0.62
        : clamp(1 - calibration.meanAbsError, 0.2, 0.97),
    weight: 0.1,
    note:
      calibration.sampleCount === 0
        ? "No prediction on this road has been verified against an outcome yet."
        : calibration.meanAbsError > 0.3
          ? `Past predictions here have been off by ${Math.round(calibration.meanAbsError * 100)} percentage points on average.`
          : undefined,
  });

  return buildConfidence(factors);
}
