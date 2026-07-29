import type { Explanation, LatLng, NonEmpty, RiskLevel } from "@/lib/core/types";
import type { SurvivabilityAssessment, VehicleProfile } from "@/lib/vehicles/types";

export type RouteMode = "fastest" | "safest";

export interface RouteRequest {
  cityId: string;
  originNodeId: string;
  destinationNodeId: string;
  vehicle: VehicleProfile | null;
  /** Minutes from now that the journey starts. */
  departInMin: number;
}

export interface RouteLeg {
  segmentId: string;
  name: string;
  corridor: string;
  fromName: string;
  toName: string;
  geometry: LatLng[];
  distanceM: number;
  travelMin: number;
  /** Minutes from now at which the driver enters this segment. */
  entersAtMin: number;
  /** Modelled depth at the moment of arrival, not right now. */
  depthOnArrivalCm: number;
  floodProbability: number;
  riskLevel: RiskLevel;
  isUnderpass: boolean;
  slopePct: number;
  /** Set when this leg is the reason a route is unsafe. */
  warning: string | null;
  /** True when the vehicle cannot cross this leg at all. */
  impassable: boolean;
}

export interface RouteResult {
  mode: RouteMode;
  label: string;
  nodeIds: string[];
  legs: RouteLeg[];
  geometry: LatLng[];
  distanceM: number;
  durationMin: number;
  /** 0..100. Higher is safer. */
  safeRouteScore: number;
  riskLevel: RiskLevel;
  maxDepthCm: number;
  maxProbability: number;
  underpassCount: number;
  impassableCount: number;
  /** The single leg that determines this route's risk. */
  worstLeg: RouteLeg | null;
  /** Survivability against the deepest water on the route. */
  survivability: SurvivabilityAssessment | null;
  explanations: NonEmpty<Explanation>;
  arrivesInMin: number;
}

export interface RouteComparison {
  fastest: RouteResult;
  safest: RouteResult;
  /** True when the risk-aware search picked the same roads as the time-only one. */
  identical: boolean;
  /**
   * False when even the best available route crosses water the vehicle cannot
   * handle. The route is still returned — seeing that every option is bad is
   * more useful than being told nothing.
   */
  safeRouteExists: boolean;
  /** Extra minutes the safe route costs. */
  extraMinutes: number;
  /** Percentage-point reduction in peak flood probability along the route. */
  riskReduction: number;
  /** Reduction in the deepest water crossed, in cm. */
  depthReduction: number;
  explanations: NonEmpty<Explanation>;
}
