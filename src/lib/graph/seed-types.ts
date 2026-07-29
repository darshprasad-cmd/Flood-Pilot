import type { LatLng } from "@/lib/core/types";
import type { RoadClass } from "./types";

/** A junction in a city seed. */
export interface SeedNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Metres above mean sea level, seeded and later refined by a DEM. */
  elevationM: number;
  ward: string;
  metro?: { station: string; line: string; walkM: number };
}

export interface SeedFloodRecord {
  date: string;
  depthCm: number;
  durationHr: number;
  /** Hours of traffic disruption the event caused, where recorded. */
  disruptionHr?: number;
}

/**
 * A road segment in a city seed.
 *
 * Only the fields that cannot be derived are declared. Everything else —
 * length, slope, drain inventory, exposure — is computed in `CityGraph` so a
 * seed stays readable and a new city stays cheap to add.
 */
export interface SeedSegment {
  id: string;
  name: string;
  corridor: string;
  from: string;
  to: string;
  roadClass: RoadClass;
  lanes: number;
  speedLimitKph: number;
  /** Intermediate points where the real road bends noticeably. */
  waypoints?: LatLng[];

  /** Road dips below grade under a rail line, flyover or bridge. */
  underpass?: boolean;
  /** 0..1 override for how much upstream area drains onto this road. */
  catchment?: number;
  /** 0..1 — how well the storm drain network here actually performs. */
  drainQuality?: number;
  /** 0..1 sealed surface fraction of the contributing catchment. */
  impervious?: number;

  /**
   * 0..1 exposure to river backwater — how much a high river stage raises the
   * water level here regardless of local rainfall.
   */
  floodplain?: number;
  /** Major drain or nallah whose overflow reaches this road. */
  majorDrainId?: string;
  /** Metres from the road to that drain. */
  majorDrainDistanceM?: number;

  /** Buildings with basement parking fronting this segment. */
  basementParking?: number;
  /** Live sewage/stormwater pumping stations serving this stretch. */
  pumpStations?: number;
  /** Active construction known to obstruct drainage. */
  constructionObstruction?: boolean;

  history?: SeedFloodRecord[];
  /** People directly affected when this segment goes under. */
  exposure?: number;
  facilities?: string[];
}
