import type { LatLng } from "@/lib/core/types";

/**
 * Community intelligence.
 *
 * The engine predicts; people observe. This layer is how the second becomes
 * usable — with the important qualification that a report is *evidence*, not
 * truth. Everything here exists to turn a stream of unverified claims into
 * something a routing engine and a control room can act on without being
 * trivially spammable.
 */

export const REPORT_TYPES = [
  "waterlogging",
  "overflowing_drain",
  "drain_blockage",
  "road_closure",
  "accident",
  "heavy_congestion",
  "construction",
  "metro_construction",
  "fallen_tree",
  "power_lines_down",
  "broken_down_vehicle",
  "vehicle_stalled",
  "emergency_vehicles",
  "pothole",
  "water_tanker",
  "road_clear",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const SEVERITIES = ["minor", "moderate", "major", "severe"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface ReportTypeMeta {
  id: ReportType;
  label: string;
  icon: string;
  /** Which map layer this report belongs to. */
  layer: MapLayerId;
  /** Does this claim standing water? Governs weather corroboration. */
  waterRelated: boolean;
  /** Does this claim the road is obstructed? Governs traffic corroboration. */
  obstruction: boolean;
  /** Ask for a depth measurement. */
  needsDepth: boolean;
  /** Ask how many lanes are blocked. */
  needsLanes: boolean;
  /**
   * How fast this stops being true. Waterlogging changes in minutes; a pothole
   * is there next week. Half-life in minutes.
   */
  halfLifeMin: number;
  /** Counter-evidence: a report of this type contradicts the claim. */
  contradictedBy: ReportType[];
}

export const REPORT_META: Record<ReportType, ReportTypeMeta> = {
  waterlogging: {
    id: "waterlogging",
    label: "Waterlogging",
    icon: "🌊",
    layer: "waterlogging",
    waterRelated: true,
    obstruction: true,
    needsDepth: true,
    needsLanes: true,
    halfLifeMin: 40,
    contradictedBy: ["road_clear"],
  },
  overflowing_drain: {
    id: "overflowing_drain",
    label: "Overflowing drain",
    icon: "🚿",
    layer: "waterlogging",
    waterRelated: true,
    obstruction: false,
    needsDepth: false,
    needsLanes: false,
    halfLifeMin: 90,
    contradictedBy: ["road_clear"],
  },
  drain_blockage: {
    id: "drain_blockage",
    label: "Blocked drain",
    icon: "🚱",
    layer: "waterlogging",
    waterRelated: false,
    obstruction: false,
    needsDepth: false,
    needsLanes: false,
    // A blocked drain stays blocked until somebody clears it.
    halfLifeMin: 3 * 24 * 60,
    contradictedBy: [],
  },
  road_closure: {
    id: "road_closure",
    label: "Road closed",
    icon: "🚨",
    layer: "closures",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: false,
    halfLifeMin: 180,
    contradictedBy: ["road_clear"],
  },
  accident: {
    id: "accident",
    label: "Accident",
    icon: "🚗",
    layer: "accidents",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: true,
    halfLifeMin: 60,
    contradictedBy: ["road_clear"],
  },
  heavy_congestion: {
    id: "heavy_congestion",
    label: "Heavy congestion",
    icon: "🚦",
    layer: "congestion",
    waterRelated: false,
    obstruction: false,
    needsDepth: false,
    needsLanes: false,
    halfLifeMin: 35,
    contradictedBy: ["road_clear"],
  },
  construction: {
    id: "construction",
    label: "Construction",
    icon: "🚧",
    layer: "construction",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: true,
    // Construction is a standing condition, not an incident.
    halfLifeMin: 14 * 24 * 60,
    contradictedBy: [],
  },
  metro_construction: {
    id: "metro_construction",
    label: "Metro construction",
    icon: "🚇",
    layer: "construction",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: true,
    halfLifeMin: 30 * 24 * 60,
    contradictedBy: [],
  },
  fallen_tree: {
    id: "fallen_tree",
    label: "Fallen tree",
    icon: "🌳",
    layer: "closures",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: true,
    halfLifeMin: 240,
    contradictedBy: ["road_clear"],
  },
  power_lines_down: {
    id: "power_lines_down",
    label: "Power lines down",
    icon: "⚡",
    layer: "closures",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: false,
    halfLifeMin: 300,
    contradictedBy: ["road_clear"],
  },
  broken_down_vehicle: {
    id: "broken_down_vehicle",
    label: "Broken-down vehicle",
    icon: "🚛",
    layer: "congestion",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: true,
    halfLifeMin: 50,
    contradictedBy: ["road_clear"],
  },
  vehicle_stalled: {
    id: "vehicle_stalled",
    label: "Vehicle stalled in water",
    icon: "🆘",
    layer: "waterlogging",
    waterRelated: true,
    obstruction: true,
    needsDepth: true,
    needsLanes: true,
    halfLifeMin: 50,
    contradictedBy: ["road_clear"],
  },
  emergency_vehicles: {
    id: "emergency_vehicles",
    label: "Emergency vehicles",
    icon: "🚒",
    layer: "alerts",
    waterRelated: false,
    obstruction: false,
    needsDepth: false,
    needsLanes: false,
    halfLifeMin: 30,
    contradictedBy: [],
  },
  pothole: {
    id: "pothole",
    label: "Pothole",
    icon: "🕳️",
    layer: "construction",
    waterRelated: false,
    obstruction: false,
    needsDepth: false,
    needsLanes: false,
    halfLifeMin: 30 * 24 * 60,
    contradictedBy: [],
  },
  water_tanker: {
    id: "water_tanker",
    label: "Tanker / pumping operation",
    icon: "🚜",
    layer: "alerts",
    waterRelated: false,
    obstruction: true,
    needsDepth: false,
    needsLanes: true,
    halfLifeMin: 120,
    contradictedBy: [],
  },
  road_clear: {
    id: "road_clear",
    label: "Road is clear",
    icon: "✅",
    layer: "alerts",
    waterRelated: false,
    obstruction: false,
    needsDepth: false,
    needsLanes: false,
    halfLifeMin: 40,
    contradictedBy: [
      "waterlogging",
      "accident",
      "road_closure",
      "fallen_tree",
      "heavy_congestion",
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  Map layers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every entry here must have something that actually draws it. A switch whose
 * only effect is to change the count next to the word "Layers" is worse than a
 * missing feature — it tells somebody they have turned a hazard off.
 */
export const MAP_LAYERS = [
  "floodRisk",
  "waterlogging",
  "construction",
  "congestion",
  "accidents",
  "closures",
  "alerts",
  "signalDelay",
  "drains",
] as const;

export type MapLayerId = (typeof MAP_LAYERS)[number];

export interface MapLayerMeta {
  id: MapLayerId;
  label: string;
  colour: string;
  /** On by default. */
  defaultOn: boolean;
  description: string;
}

/**
 * The English copy lives here because this map is serialised to clients by
 * /api/community, which has no locale to answer in. What the layers control
 * actually shows comes from the dictionary under the same ids, so a layer added
 * here needs its `layers.<id>` entry adding there in the same change.
 */
export const LAYER_META: Record<MapLayerId, MapLayerMeta> = {
  floodRisk: {
    id: "floodRisk",
    label: "Flood risk",
    colour: "#4aa8ff",
    defaultOn: true,
    description: "Modelled flood probability and depth for every road.",
  },
  waterlogging: {
    id: "waterlogging",
    label: "Live waterlogging",
    colour: "#2b6fa8",
    defaultOn: true,
    description: "Water reported on the ground right now, by people who are there.",
  },
  construction: {
    id: "construction",
    label: "Construction",
    colour: "#e8b62c",
    defaultOn: true,
    description: "Roadworks, metro construction and reported potholes.",
  },
  congestion: {
    id: "congestion",
    label: "Congestion",
    colour: "#f08a3c",
    defaultOn: false,
    description: "Reported heavy traffic and breakdowns.",
  },
  accidents: {
    id: "accidents",
    label: "Accidents",
    colour: "#e8503a",
    defaultOn: true,
    description: "Reported collisions and their lane impact.",
  },
  closures: {
    id: "closures",
    label: "Road closures",
    colour: "#b32b1d",
    defaultOn: true,
    description: "Closures, fallen trees and downed power lines.",
  },
  alerts: {
    id: "alerts",
    label: "Community alerts",
    colour: "#35d6d6",
    defaultOn: true,
    description: "Emergency vehicles, pumping operations, all-clear reports.",
  },
  signalDelay: {
    id: "signalDelay",
    label: "Intersection delay",
    colour: "#7cc4ff",
    defaultOn: false,
    description:
      "AI-estimated delay at junctions. Estimated, not published signal timing.",
  },
  drains: {
    id: "drains",
    label: "Trunk drains & Yamuna",
    colour: "#3f5a72",
    defaultOn: true,
    description: "The drainage network the city depends on.",
  },
};

/* -------------------------------------------------------------------------- */
/*  Reports                                                                   */
/* -------------------------------------------------------------------------- */

export interface CommunityReport {
  id: string;
  type: ReportType;
  cityId: string;
  segmentId: string;
  /** Where the reporter actually was. */
  at: LatLng;
  createdAt: string;

  severity: Severity;
  /** Lanes the reporter estimates are blocked. */
  lanesBlocked: number | null;
  depthCm: number | null;
  description: string | null;
  /** Optional photo. Stored as a URL; see docs for the upload path. */
  photoUrl: string | null;

  reporterId: string;
  reporterTrust: number;
  corroborations: number;
  contradictions: number;
}

export type NewCommunityReport = Omit<
  CommunityReport,
  "id" | "createdAt" | "corroborations" | "contradictions" | "reporterTrust"
> & { reporterTrust?: number };

/** A report as it leaves the server. */
export type PublishedReport = Omit<CommunityReport, "reporterId">;

/**
 * Strip the reporter id from a report before it is served.
 *
 * The id never leaves the server — not even to the person it belongs to. It is
 * a stable device identity, and served next to a coordinate and a timestamp it
 * is a location trace: that is why it lives in an httpOnly cookie, and why
 * returning it in a response body would hand it straight back to page script.
 *
 * This lives here rather than in one route because every endpoint that serves
 * reports has to do it — /api/reports on POST and GET, /api/community in the
 * per-report verification list — and a single one forgetting is the whole leak.
 */
export function publishedReport(report: CommunityReport): PublishedReport {
  const { reporterId: _reporterId, ...rest } = report;
  return rest;
}

/* -------------------------------------------------------------------------- */
/*  Verification                                                              */
/* -------------------------------------------------------------------------- */

export type ConfidenceBand = "low" | "moderate" | "high" | "very_high";

export interface VerificationSignal {
  key: string;
  label: string;
  /** Does this signal support the claim? */
  agrees: boolean;
  /** 0..1 how strongly. */
  strength: number;
  /** 0..1 how much this signal counts towards the total. */
  weight: number;
  detail: string;
}

export interface ReportVerification {
  confidence: number;
  band: ConfidenceBand;
  signals: VerificationSignal[];
  /** One line a person can read. */
  verdict: string;
  /** Should this report be allowed to move a prediction? */
  actionable: boolean;
}

export const BAND_META: Record<ConfidenceBand, { label: string; colour: string }> = {
  low: { label: "Low", colour: "#f08a3c" },
  moderate: { label: "Moderate", colour: "#e8b62c" },
  high: { label: "High", colour: "#8fc93a" },
  very_high: { label: "Very high", colour: "#2fbf6f" },
};

/* -------------------------------------------------------------------------- */
/*  Clusters                                                                  */
/* -------------------------------------------------------------------------- */

export type InferredEventKind =
  | "major_flood_event"
  | "drain_failure"
  | "likely_accident"
  | "construction_bottleneck"
  | "infrastructure_defect"
  | "road_blocked"
  | "emergency_response"
  | "localised_congestion"
  | "unclassified";

export interface InferredEvent {
  kind: InferredEventKind;
  label: string;
  /** 0..1 — how strongly the report pattern supports this reading. */
  likelihood: number;
  /** The reasoning, written for a control room. */
  explanation: string;
  /** What the operator should actually do. */
  recommendation: string;
}

export interface ReportCluster {
  id: string;
  cityId: string;
  /** Centroid of the member reports. */
  at: LatLng;
  radiusM: number;
  reportIds: string[];
  reportCount: number;
  /** Distinct reporters — the number that matters for corroboration. */
  reporterCount: number;
  segmentIds: string[];
  /** Most common report type in the cluster. */
  dominantType: ReportType;
  typeCounts: Partial<Record<ReportType, number>>;
  severity: Severity;
  confidence: number;
  band: ConfidenceBand;
  lanesBlocked: number | null;
  meanDepthCm: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  inferred: InferredEvent;
  /** Nearest named location, for the headline. */
  locationName: string;
}
