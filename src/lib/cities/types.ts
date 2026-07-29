import type { LatLng } from "@/lib/core/types";
import type { CityMeta, MetroStation } from "@/lib/graph/types";
import type { SeedNode, SeedSegment } from "@/lib/graph/seed-types";

/**
 * A city plugin.
 *
 * Everything city-specific lives behind this one interface. Bringing a new city
 * online means supplying GIS layers, a drainage network, historical flood
 * records and a source-preference list — the hazard engine, routing, vehicle
 * model, decision engine and UI are untouched.
 */

export type ProviderId =
  | "imd"
  | "cwc"
  | "google-traffic"
  | "google-elevation"
  | "google-directions"
  | "osm-overpass"
  | "open-meteo"
  | "open-meteo-flood"
  | "open-meteo-elevation"
  | "internal-model"
  | "seed";

export interface CitySourcePreferences {
  /** Most preferred first; the resolver falls through to the next available. */
  rainfall: ProviderId[];
  river: ProviderId[];
  elevation: ProviderId[];
  traffic: ProviderId[];
  drainage: ProviderId[];
  roads: ProviderId[];
}

export type DrainKind =
  | "trunk_drain"
  | "supplementary_drain"
  | "branch_drain"
  | "river"
  | "canal"
  | "barrage_channel";

/**
 * A major drain or nallah.
 *
 * These matter for two separate reasons: roads near them flood *earlier*
 * (backflow when the drain runs full), and the drain's own capacity governs how
 * fast an entire sub-basin can shed water.
 */
export interface MajorDrain {
  id: string;
  name: string;
  kind: DrainKind;
  /** Alignment of the drain, coarsely traced. */
  path: LatLng[];
  designCapacityCumecs: number;
  /** 0..1 — silting and encroachment against design section. */
  siltationIndex: number;
  outfall: string;
  operator: string;
  note: string;
}

/** A river gauge with its official warning thresholds. */
export interface GaugeStation {
  id: string;
  name: string;
  river: string;
  at: LatLng;
  /** Metres above mean sea level. */
  warningLevelM: number;
  dangerLevelM: number;
  evacuationLevelM: number;
  operator: string;
  code?: string;
  /** Hours between an upstream barrage release and the peak arriving here. */
  upstreamLagHr?: number;
  /** Upstream control structure whose releases drive this gauge. */
  drivenBy?: string;
  source: string;
}

export type HotspotKind =
  | "underpass"
  | "low_colony"
  | "arterial_dip"
  | "floodplain"
  | "drain_overflow"
  | "intersection"
  | "basement_parking";

export type HotspotSeverity = "watch" | "recurring" | "chronic";

/**
 * A known recurring waterlogging location.
 *
 * Kept as data rather than logic, and loaded through `loadHotspots` so an
 * operator can override or extend the list without a code change — the
 * requirement is that this stays updateable, because these lists genuinely do
 * change every season as drains are remodelled.
 */
export interface HotspotRecord {
  id: string;
  name: string;
  at: LatLng;
  /** Segments this hotspot maps onto. */
  segmentIds: string[];
  kind: HotspotKind;
  severity: HotspotSeverity;
  typicalDepthCm: number;
  typicalDurationHr: number;
  /** Which authority's list this entry came from. */
  source: string;
  note: string;
  pumpsDeployed?: number;
  /** True when the entry has been checked against an official published list. */
  verified: boolean;
}

export interface ControlRoom {
  name: string;
  authority: string;
  phone: string[];
  note?: string;
  url?: string;
}

/** Named data source shown to users under "prediction based on". */
export interface SourceCredit {
  id: ProviderId | string;
  name: string;
  authority: string;
  url: string;
  /** What this source contributes. */
  provides: string[];
  requiresKey: boolean;
  envKey?: string;
}

export interface CityPlugin {
  meta: CityMeta;
  nodes: SeedNode[];
  segments: SeedSegment[];
  metro: MetroStation[];
  /** Long-run monthly rainfall normals in mm, index 0 = January. */
  monthlyNormalMm: number[];
  weatherGrid: LatLng[];
  majorDrains: MajorDrain[];
  gauges: GaugeStation[];
  hotspots: HotspotRecord[];
  controlRooms: ControlRoom[];
  sources: CitySourcePreferences;
  credits: SourceCredit[];
  /** One-line description of how this city floods. Shown in the UI. */
  floodCharacter: string;
}
