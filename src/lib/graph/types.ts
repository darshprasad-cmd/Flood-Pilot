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
  /** Hours of traffic disruption the event caused, where recorded. */
  disruptionHr?: number;
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

  /* River and trunk-drain exposure --------------------------------------- */
  /**
   * 0..1 — how much a high river stage raises the water level here regardless of
   * local rainfall. In Delhi this is the difference between a road that floods
   * when it rains and a road that floods when the Yamuna crosses 205.33 m.
   */
  floodplainExposure: number;
  /** The trunk drain this road depends on, and how close it runs to it. */
  majorDrain: {
    id: string;
    name: string;
    kind: string;
    distanceM: number;
    /** 0..1 — silting and encroachment against the drain's design section. */
    siltationIndex: number;
    capacityCumecs: number;
  } | null;

  /* Sub-surface and infrastructure --------------------------------------- */
  /** Buildings with basement parking fronting this segment. */
  basementParking: number;
  /** Pumping stations serving this stretch. */
  pumpStations: number;
  /** Active construction known to obstruct drainage. */
  constructionObstruction: boolean;
  /** Matching entry in the city's recurring-waterlogging register. */
  hotspot: {
    id: string;
    name: string;
    kind: string;
    severity: string;
    typicalDepthCm: number;
    typicalDurationHr: number;
    source: string;
    note: string;
  } | null;

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
/** One modelled failure mode for a road segment. */
export interface BlockageRisk {
  kind: BlockageKind;
  label: string;
  /** 0..1 likelihood over the forecast horizon. */
  likelihood: number;
  /** What the estimate rests on — live signal, history, or infrastructure. */
  basis: string;
  /** Written for whoever has to act on it. */
  consequence: string;
}

export const BLOCKAGE_KINDS = [
  "clogged_drain",
  "storm_drain_overflow",
  "waterlogged_intersection",
  "underpass_flooding",
  "basement_parking",
  "road_closure",
  "pump_failure",
  "drain_backflow",
  "construction_obstruction",
] as const;

export type BlockageKind = (typeof BLOCKAGE_KINDS)[number];

export interface SegmentState {
  segmentId: string;
  /** Probability that water accumulates to the action threshold. */
  floodProbability: number;
  depthCm: number;
  riskLevel: RiskLevel;
  /** Minutes until water crosses the vehicle-relevant threshold; null if never. */
  timeToFloodMin: number | null;
  peakAtMin: number | null;
  peakDepthCm: number;

  /* Waterlogging engine outputs ------------------------------------------ */
  /** 0..1 chance the trunk or storm drain here surcharges onto the road. */
  drainOverflowLikelihood: number;
  /** Minutes until the road is impassable to an ordinary car. */
  timeToImpassableMin: number | null;
  /** Minutes from now until the water is back below the action threshold. */
  recoveryMin: number | null;
  /** Modelled failure modes, ranked. */
  blockages: BlockageRisk[];

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
