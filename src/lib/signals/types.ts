import type { LatLng, SignalProvenance } from "@/lib/core/types";

/** A point on the rainfall curve, expressed relative to "now". */
export interface RainPoint {
  minutesFromNow: number;
  /** Intensity in mm/hr over the interval starting at this point. */
  mmPerHr: number;
  /** 0..1 forecast probability of precipitation. */
  probability: number;
}

/**
 * One cell of the rainfall field.
 *
 * A city the size of Bengaluru routinely has 40 mm falling on one side and
 * nothing on the other, so a single centroid reading would be misleading. We
 * sample a coarse grid and interpolate between cells.
 */
export interface WeatherCell {
  at: LatLng;
  tempC: number;
  humidity: number;
  currentRainMmHr: number;
  /** Forecast curve, ~15-minute resolution near-term, hourly further out. */
  curve: RainPoint[];
  accum1hMm: number;
  accum3hMm: number;
  accum6hMm: number;
  accum24hMm: number;
  past24hMm: number;
  peakIntensityMmHr: number;
  peakInMin: number | null;
  /** Total rainfall across the modelled event. */
  eventTotalMm: number;
}

export interface WeatherField {
  provenance: SignalProvenance;
  issuedAt: string;
  cells: WeatherCell[];
  /** Spread of forecast intensity across cells — high spread lowers confidence. */
  spatialVarianceMmHr: number;
}

/** Recent rainfall history, which governs how saturated the ground already is. */
export interface AntecedentCell {
  at: LatLng;
  last3dMm: number;
  last7dMm: number;
  last30dMm: number;
  /** 0..1 soil-saturation proxy. Saturated ground means runoff, not soak-away. */
  wetnessIndex: number;
  consecutiveWetDays: number;
}

export interface AntecedentField {
  provenance: SignalProvenance;
  cells: AntecedentCell[];
  /** Long-run mean rainfall for this month, from the reanalysis archive. */
  climatologyMonthlyMm: number;
  /** How this month compares with the long-run mean. 1.0 = normal. */
  seasonalAnomaly: number;
}

export interface ElevationSample {
  at: LatLng;
  elevationM: number;
}

export interface ElevationField {
  provenance: SignalProvenance;
  samples: ElevationSample[];
}

/**
 * River discharge from the Open-Meteo global flood model.
 *
 * Bengaluru's flooding is overwhelmingly pluvial rather than fluvial, so this is
 * a secondary signal today — but the plumbing is real, so cities where river
 * levels dominate are already supported.
 */
export interface RiverCell {
  at: LatLng;
  dischargeM3s: number;
  /** Ratio against the long-run mean discharge. */
  ratioToMean: number;
  /** Change over the forecast window, m3/s per day. */
  risingRate: number;
  available: boolean;
}

export interface RiverField {
  provenance: SignalProvenance;
  cells: RiverCell[];
}

export interface TrafficReading {
  segmentId: string;
  /** 0..1, where 1 is gridlock. */
  density: number;
  /** Multiplier applied to free-flow travel time. */
  delayFactor: number;
  meanSpeedKph: number;
}

export interface TrafficField {
  provenance: SignalProvenance;
  bySegment: Record<string, TrafficReading>;
}

/** Aggregated, time-decayed citizen reports for one segment. */
export interface ReportSignalReading {
  segmentId: string;
  /** -1..1 — negative means people report it clear, positive means flooded. */
  netFloodSignal: number;
  /** 0..1 — evidence that drains here are blocked. */
  drainBlockageSignal: number;
  observedDepthCm: number | null;
  stalledVehicles: number;
  reportCount: number;
  latestAt: string | null;
}

export interface ReportField {
  provenance: SignalProvenance;
  bySegment: Record<string, ReportSignalReading>;
}

/** Everything a hazard model is given for one tick over one city. */
export interface SignalBundle {
  cityId: string;
  now: Date;
  weather: WeatherField;
  antecedent: AntecedentField;
  elevation: ElevationField | null;
  river: RiverField;
  traffic: TrafficField;
  reports: ReportField;
  provenances: SignalProvenance[];
  /** True when any signal fell back to simulation. */
  degraded: boolean;
}
