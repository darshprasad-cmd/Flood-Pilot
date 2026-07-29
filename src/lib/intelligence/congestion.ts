import { clamp } from "@/lib/core/math";
import { clockAt, formatDuration } from "@/lib/core/time";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { RoadSegment, SegmentState } from "@/lib/graph/types";
import type { ReportCluster } from "@/lib/community/types";
import type { WeatherCell } from "@/lib/signals/types";

/**
 * Predictive congestion.
 *
 * Showing current traffic is a solved problem that other people solve better.
 * The useful thing is the sentence *"expect congestion here in eighteen
 * minutes"*, because that is early enough to change a decision.
 *
 * In Delhi the forecast is unusually tractable during monsoon, because the
 * dominant driver is not traffic dynamics at all — it is rain. Congestion
 * reliably builds fifteen to twenty-five minutes *before* the peak rainfall,
 * as people leave early to beat it and two-wheelers pull under flyovers.
 */

export interface CongestionPoint {
  minutesFromNow: number;
  density: number;
  confidence: number;
}

export interface CongestionDriver {
  key: string;
  label: string;
  /** Contribution to the forecast rise, 0..1. */
  contribution: number;
  detail: string;
}

export interface CongestionForecast {
  segmentId: string;
  name: string;
  currentDensity: number;
  curve: CongestionPoint[];
  peakDensity: number;
  peakInMin: number;
  /** Minutes until density crosses the "expect congestion" threshold. */
  onsetInMin: number | null;
  drivers: CongestionDriver[];
  /** One sentence a person can act on. */
  headline: string;
  confidence: number;
}

/** Density above which a road is meaningfully congested. */
const CONGESTED = 0.72;

const STEP_MIN = 10;
const HORIZON_MIN = 120;

export interface CongestionInput {
  graph: CityGraph;
  weatherAt: (segment: RoadSegment) => WeatherCell | undefined;
  clusters: ReportCluster[];
  localHour: number;
  timezone: string;
  now: Date;
}

export function forecastCongestion(input: CongestionInput): CongestionForecast[] {
  const { graph, weatherAt, clusters, localHour, timezone, now } = input;

  return graph
    .allSegments()
    .map((segment) => {
      const state = graph.getState(segment.id);
      if (!state) return null;
      return forecastOne(segment, state, {
        weather: weatherAt(segment),
        clusters,
        localHour,
        timezone,
        now,
      });
    })
    .filter((f): f is CongestionForecast => f !== null)
    .sort((a, b) => b.peakDensity - a.peakDensity);
}

function forecastOne(
  segment: RoadSegment,
  state: SegmentState,
  ctx: {
    weather: WeatherCell | undefined;
    clusters: ReportCluster[];
    localHour: number;
    timezone: string;
    now: Date;
  },
): CongestionForecast {
  const drivers: CongestionDriver[] = [];
  const current = state.trafficDensity;

  /* ── Driver: rainfall ─────────────────────────────────────────────────
     The lead indicator. Congestion builds ahead of the rain, not with it. */
  const peakRainInMin = ctx.weather?.peakInMin ?? null;
  const peakRain = ctx.weather?.peakIntensityMmHr ?? 0;
  const rainLead = peakRainInMin !== null ? Math.max(0, peakRainInMin - 20) : null;

  if (peakRain > 6 && rainLead !== null) {
    drivers.push({
      key: "rain",
      label: "Rainfall",
      contribution: clamp(peakRain / 45),
      detail: `${peakRain.toFixed(0)} mm/hr expected at ${clockAt(ctx.now, ctx.timezone, peakRainInMin ?? 0)}. Traffic builds roughly twenty minutes before the peak.`,
    });
  }

  /* ── Driver: flooding on this road ───────────────────────────────────── */
  if (state.timeToFloodMin !== null && state.peakDepthCm > 8) {
    drivers.push({
      key: "flooding",
      label: "Waterlogging",
      contribution: clamp(state.peakDepthCm / 40),
      detail: `Water crosses 8 cm in ${formatDuration(state.timeToFloodMin)}, which will constrict this stretch before it blocks it.`,
    });
  }

  /* ── Driver: community-reported incidents nearby ─────────────────────── */
  const nearby = ctx.clusters.filter(
    (c) => c.segmentIds.includes(segment.id) && c.confidence >= 0.45,
  );
  for (const cluster of nearby) {
    const blocking =
      cluster.inferred.kind === "likely_accident" ||
      cluster.inferred.kind === "road_blocked" ||
      cluster.inferred.kind === "construction_bottleneck";
    if (!blocking) continue;

    drivers.push({
      key: `cluster_${cluster.id}`,
      label: cluster.inferred.label,
      contribution: clamp(cluster.confidence * (cluster.lanesBlocked ?? 1) * 0.4),
      detail: `${cluster.inferred.label} reported at ${cluster.locationName}${
        cluster.lanesBlocked ? `, ${cluster.lanesBlocked} lane(s) blocked` : ""
      }.`,
    });
  }

  /* ── Driver: time of day ─────────────────────────────────────────────── */
  const peakBuild = hoursToNextPeak(ctx.localHour);
  if (peakBuild !== null && peakBuild.minutes <= HORIZON_MIN) {
    drivers.push({
      key: "timeofday",
      label: peakBuild.label,
      contribution: 0.4,
      detail: `${peakBuild.label} begins in ${formatDuration(peakBuild.minutes)}.`,
    });
  }

  /* ── Build the curve ─────────────────────────────────────────────────── */
  const curve: CongestionPoint[] = [];
  let peakDensity = current;
  let peakInMin = 0;
  let onsetInMin: number | null = current >= CONGESTED ? 0 : null;

  for (let m = 0; m <= HORIZON_MIN; m += STEP_MIN) {
    let density = current;

    // Rain-driven build, peaking twenty minutes before the rain does.
    if (rainLead !== null && peakRain > 6) {
      const spread = 35;
      density +=
        clamp(peakRain / 45) * 0.45 * Math.exp(-((m - rainLead) ** 2) / (2 * spread ** 2));
    }

    // Time-of-day build.
    if (peakBuild) {
      const toPeak = Math.abs(m - peakBuild.minutes);
      density += 0.22 * Math.exp(-(toPeak ** 2) / (2 * 45 ** 2));
    }

    // Incidents raise the floor for as long as they last.
    for (const cluster of nearby) {
      density += clamp(cluster.confidence * 0.3 * ((cluster.lanesBlocked ?? 1) / 3));
    }

    // Water on the road eventually stops traffic entirely.
    if (state.timeToFloodMin !== null && m >= state.timeToFloodMin) {
      density += clamp(state.peakDepthCm / 30) * 0.35;
    }

    density = clamp(density);

    // Confidence falls with horizon — this is a forecast, not a schedule.
    const confidence = clamp(0.75 - (m / HORIZON_MIN) * 0.3);
    curve.push({ minutesFromNow: m, density, confidence });

    if (density > peakDensity) {
      peakDensity = density;
      peakInMin = m;
    }
    if (onsetInMin === null && density >= CONGESTED) onsetInMin = m;
  }

  drivers.sort((a, b) => b.contribution - a.contribution);

  return {
    segmentId: segment.id,
    name: segment.name,
    currentDensity: current,
    curve,
    peakDensity,
    peakInMin,
    onsetInMin,
    drivers,
    headline: buildHeadline(segment, current, onsetInMin, peakDensity, drivers),
    confidence: clamp(0.7 - (peakInMin / HORIZON_MIN) * 0.25),
  };
}

function buildHeadline(
  segment: RoadSegment,
  current: number,
  onsetInMin: number | null,
  peakDensity: number,
  drivers: CongestionDriver[],
): string {
  if (onsetInMin === null) {
    return `${segment.name} stays clear over the next two hours.`;
  }
  if (onsetInMin === 0) {
    return `${segment.name} is already congested at ${Math.round(current * 100)}%.`;
  }

  const cause = drivers
    .slice(0, 2)
    .map((d) => d.label.toLowerCase())
    .join(" and ");

  return `Expect congestion on ${segment.name} in ${formatDuration(onsetInMin)}${
    cause ? ` — ${cause}` : ""
  }, peaking at ${Math.round(peakDensity * 100)}%.`;
}

function hoursToNextPeak(
  localHour: number,
): { label: string; minutes: number } | null {
  const peaks: [number, string][] = [
    [9.3, "Morning peak"],
    [18.7, "Evening peak"],
  ];

  for (const [hour, label] of peaks) {
    const delta = (hour - localHour) * 60;
    if (delta > 0 && delta <= HORIZON_MIN) {
      return { label, minutes: Math.round(delta) };
    }
  }
  return null;
}
