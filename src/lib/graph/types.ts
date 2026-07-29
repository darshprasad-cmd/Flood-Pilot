import type {
  ConfidenceBand,
  LatLng,
  RiskLevel,
  SignalProvenance,
} from "@/lib/core/types";
import type { Driver } from "@/lib/hazard/types";

export type RoadClass =
  | "highway"
  | "ring"
  | "arterial"
  | "collector"
  | "local"
  | "service";

export type DrainType =
  | "storm_inlet"
  | "box_drain"
  | "culvert"
  | "canal"
  | "pump_station";

export interface Drain {
  id: string;
  at: LatLng;
  type: DrainType;
  /** Litres per second the drain was designed to carry. */
  designCapacityLps: number;
  /** 0..1 — how choked with silt and debris the drain currently is. */
  siltingIndex: number;
  lastCleanedDaysAgo: number;
}

export interface FloodRecord {
  date: string;
  depthCm: number;
  durationHr: number;
  source: string;
}

export interface RoadNode {
  id: string;
  name: string;
  at: LatLng;
  /** Metres above sea level. */
  elevationM: number;
  ward?: string;
  /** Nearest metro station, when one is within walking distance. */
  metro?: { station: string; line: string; walkM: number };
}

/**
 * A directed stretch of road between two junctions. Static attributes describe
 * the physical world; `SegmentState` holds everything the intelligence engine
 * writes back.
 */
export interface RoadSegment {
  id: string;
  name: string;
  corridor: string;
  from: string;
  to: string;
  geometry: LatLng[];
  lengthM: number;
  midpoint: LatLng;

  roadClass: RoadClass;
  lanes: number;
  speedLimitKph: number;

  /* Terrain -------------------------------------------------------------- */
  /** Lowest elevation along the segment — water collects at the low point. */
  elevationM: number;
  /** Rise over run, as a percentage. Flat roads pond; steep roads shed. */
  slopePct: number;
  /** 0..1 — size of the upstream area that drains onto this road. */
  catchmentIndex: number;
  /** 0..1 — how much of the catchment is sealed surface. */
  imperviousIndex: number;
  isUnderpass: boolean;

  /* Drainage ------------------------------------------------------------- */
  drains: Drain[];
  /** Metres from the segment midpoint to the nearest drain. */
  distToDrainM: number;
  /** Drains per kilometre. */
  drainDensityPerKm: number;
  /** 0..1 — design capacity discounted by silting. */
  drainCapacityIndex: number;

  /* History and exposure ------------------------------------------------- */
  floodHistory: FloodRecord[];
  /** Recorded flood events per year. */
  floodFrequencyPerYear: number;
  /** People directly affected when this segment floods. */
  populationExposure: number;
  criticalFacilities: string[];

  provenance: SignalProvenance;
}

/**
 * Everything the engine recomputes on every tick. Kept separate from the static
 * segment so the road network can be cached and only the dynamics refreshed.
 */
export interface SegmentState {
  segmentId: string;
  floodProbability: number;
  depthCm: number;
  riskLevel: RiskLevel;
  /** Minutes until water crosses the vehicle-relevant threshold; null if never. */
  timeToFloodMin: number | null;
  peakAtMin: number | null;
  peakDepthCm: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** 0..1 congestion. */
  trafficDensity: number;
  /** 0..1 effective drain capacity right now, after blockage reports. */
  drainCapacity: number;
  /** Ranked feature contributions behind this prediction. */
  drivers: Driver[];
  modelId: string;
  updatedAt: string;
}

export interface CityMeta {
  id: string;
  name: string;
  country: string;
  center: LatLng;
  /** [south, west, north, east] */
  bounds: [number, number, number, number];
  timezone: string;
  /** Months (1-12) when the city's flood season runs. */
  monsoonMonths: number[];
  /** Reference elevations used to normalise how low-lying a road is. */
  elevationRangeM: [number, number];
}

export interface MetroStation {
  id: string;
  name: string;
  line: string;
  at: LatLng;
}

export interface GraphEdgeRef {
  segmentId: string;
  to: string;
}
