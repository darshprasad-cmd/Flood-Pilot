import {
  clamp,
  hashRange,
  haversineM,
  invLerp,
  midpoint,
  polylineLengthM,
} from "@/lib/core/math";
import type { LatLng } from "@/lib/core/types";
import type { ElevationField } from "@/lib/signals/types";
import type {
  CityMeta,
  Drain,
  DrainType,
  GraphEdgeRef,
  MetroStation,
  RoadClass,
  RoadNode,
  RoadSegment,
  SegmentState,
} from "./types";
import type { SeedNode, SeedSegment } from "./seed/bengaluru";

/**
 * Straight-line junction-to-junction distance understates how far you actually
 * drive. This is the standard urban detour factor and is applied to travel-time
 * distance only — the drawn geometry stays honest.
 */
const DETOUR_FACTOR = 1.15;

/** Years of flood history the seed covers, used to turn events into a rate. */
const HISTORY_WINDOW_YEARS = 3.5;

export interface CitySeed {
  city: CityMeta;
  nodes: SeedNode[];
  segments: SeedSegment[];
  metro: MetroStation[];
  monthlyNormalMm: number[];
  weatherGrid: LatLng[];
}

/**
 * The city as a graph.
 *
 * Static structure is built once and cached; the dynamic layer (`SegmentState`)
 * is written by the intelligence engine on every tick and read by routing. That
 * split is what lets an expensive road network be reused across requests while
 * the risk numbers stay fresh.
 */
export class CityGraph {
  readonly city: CityMeta;
  readonly nodes: Map<string, RoadNode> = new Map();
  readonly segments: Map<string, RoadSegment> = new Map();
  readonly metro: MetroStation[];
  readonly monthlyNormalMm: number[];
  readonly weatherGrid: LatLng[];

  /** Undirected adjacency: every segment is traversable both ways. */
  private readonly adjacency: Map<string, GraphEdgeRef[]> = new Map();
  private readonly states: Map<string, SegmentState> = new Map();

  constructor(seed: CitySeed) {
    this.city = seed.city;
    this.metro = seed.metro;
    this.monthlyNormalMm = seed.monthlyNormalMm;
    this.weatherGrid = seed.weatherGrid;

    for (const n of seed.nodes) {
      this.nodes.set(n.id, {
        id: n.id,
        name: n.name,
        at: { lat: n.lat, lng: n.lng },
        elevationM: n.elevationM,
        ward: n.ward,
        metro: n.metro,
      });
    }

    for (const s of seed.segments) {
      const segment = this.buildSegment(s);
      if (!segment) continue;
      this.segments.set(segment.id, segment);

      this.link(segment.from, { segmentId: segment.id, to: segment.to });
      this.link(segment.to, { segmentId: segment.id, to: segment.from });
    }
  }

  private link(nodeId: string, edge: GraphEdgeRef): void {
    const list = this.adjacency.get(nodeId);
    if (list) list.push(edge);
    else this.adjacency.set(nodeId, [edge]);
  }

  private buildSegment(seed: SeedSegment): RoadSegment | null {
    const from = this.nodes.get(seed.from);
    const to = this.nodes.get(seed.to);
    if (!from || !to) {
      // A dangling reference would silently disconnect the graph; fail loudly in
      // development rather than routing around a road that does not exist.
      if (process.env.NODE_ENV !== "production") {
        throw new Error(
          `Segment "${seed.id}" references unknown junction "${
            from ? seed.to : seed.from
          }".`,
        );
      }
      return null;
    }

    const geometry: LatLng[] = [from.at, ...(seed.waypoints ?? []), to.at];
    const geometricLengthM = polylineLengthM(geometry);
    const lengthM = Math.max(120, geometricLengthM * DETOUR_FACTOR);
    const mid = midpoint(geometry);

    // Water pools at the low point, and an underpass sits below both of its
    // approach junctions by definition.
    const lowPoint = Math.min(from.elevationM, to.elevationM);
    const elevationM = seed.underpass ? lowPoint - 3.5 : lowPoint;

    const rise = Math.abs(from.elevationM - to.elevationM);
    const slopePct = (rise / Math.max(1, geometricLengthM)) * 100;

    const catchmentIndex =
      seed.catchment ?? this.derivedCatchment(elevationM, slopePct);
    const imperviousIndex = seed.impervious ?? CLASS_IMPERVIOUS[seed.roadClass];
    const drainQuality = seed.drainQuality ?? 0.6;

    const drains = generateDrains(seed.id, geometry, lengthM, drainQuality, seed.roadClass);
    const drainDensityPerKm = drains.length / (lengthM / 1000);
    const nearestDrainM = drains.length
      ? Math.min(...drains.map((d) => haversineM(mid, d.at)))
      : 1200;

    const meanSilting = drains.length
      ? drains.reduce((s, d) => s + d.siltingIndex, 0) / drains.length
      : 1;

    // Effective capacity is design capacity discounted by silting and by how
    // sparse the network is. A pristine drain 400 m away does not help.
    const densityFactor = clamp(drainDensityPerKm / 5);
    const drainCapacityIndex = clamp(
      (1 - meanSilting) * (0.45 + 0.55 * densityFactor),
    );

    const history = (seed.history ?? []).map((h) => ({
      ...h,
      source: "floodpilot/seed:reported-hotspots",
    }));

    return {
      id: seed.id,
      name: seed.name,
      corridor: seed.corridor,
      from: seed.from,
      to: seed.to,
      geometry,
      lengthM,
      midpoint: mid,
      roadClass: seed.roadClass,
      lanes: seed.lanes,
      speedLimitKph: seed.speedLimitKph,
      elevationM,
      slopePct,
      catchmentIndex,
      imperviousIndex,
      isUnderpass: seed.underpass ?? false,
      drains,
      distToDrainM: nearestDrainM,
      drainDensityPerKm,
      drainCapacityIndex,
      floodHistory: history,
      floodFrequencyPerYear: history.length / HISTORY_WINDOW_YEARS,
      populationExposure: seed.exposure ?? defaultExposure(seed.roadClass, lengthM),
      criticalFacilities: seed.facilities ?? [],
      provenance: {
        source: "floodpilot/seed:bengaluru",
        kind: "seeded",
        fetchedAt: new Date(0).toISOString(),
        reliability: history.length > 0 ? 0.65 : 0.5,
        live: false,
        note:
          "Junctions and corridors are real; geometry is a straight-line approximation and flood history is an illustrative seed of reported hotspots, not an official municipal record.",
      },
    };
  }

  /** Low, flat ground collects water from everywhere around it. */
  private derivedCatchment(elevationM: number, slopePct: number): number {
    const [lo, hi] = this.city.elevationRangeM;
    const lowness = 1 - invLerp(lo, hi, elevationM);
    const flatness = 1 - clamp(slopePct / 3);
    return clamp(lowness * 0.65 + flatness * 0.35);
  }

  /* ---------------------------------------------------------------------- */

  getNode(id: string): RoadNode | undefined {
    return this.nodes.get(id);
  }

  getSegment(id: string): RoadSegment | undefined {
    return this.segments.get(id);
  }

  allSegments(): RoadSegment[] {
    return [...this.segments.values()];
  }

  allNodes(): RoadNode[] {
    return [...this.nodes.values()];
  }

  neighbours(nodeId: string): GraphEdgeRef[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  /** Junction nearest to a coordinate — how a dropped pin becomes a graph node. */
  nearestNode(at: LatLng): RoadNode {
    let best: RoadNode | null = null;
    let bestD = Infinity;
    for (const node of this.nodes.values()) {
      const d = haversineM(at, node.at);
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    // The graph always has nodes; the seed throws at construction if it does not.
    return best as RoadNode;
  }

  /* ---------------------------------------------------------------------- */

  setState(state: SegmentState): void {
    this.states.set(state.segmentId, state);
  }

  getState(segmentId: string): SegmentState | undefined {
    return this.states.get(segmentId);
  }

  allStates(): SegmentState[] {
    return [...this.states.values()];
  }

  /** Age of the dynamic layer in seconds; `null` when nothing has been computed. */
  stateAgeSec(now = Date.now()): number | null {
    const stamps = [...this.states.values()].map((s) => Date.parse(s.updatedAt));
    if (stamps.length === 0) return null;
    return (now - Math.max(...stamps)) / 1000;
  }

  /**
   * Replace seeded junction heights with real digital-elevation-model readings,
   * then recompute everything that depended on them.
   */
  applyElevations(field: ElevationField): number {
    let applied = 0;

    for (const node of this.nodes.values()) {
      const sample = field.samples.find(
        (s) => haversineM(s.at, node.at) < 60,
      );
      if (!sample) continue;
      node.elevationM = sample.elevationM;
      applied++;
    }

    if (applied === 0) return 0;

    for (const seg of this.segments.values()) {
      const from = this.nodes.get(seg.from);
      const to = this.nodes.get(seg.to);
      if (!from || !to) continue;

      const lowPoint = Math.min(from.elevationM, to.elevationM);
      seg.elevationM = seg.isUnderpass ? lowPoint - 3.5 : lowPoint;
      const rise = Math.abs(from.elevationM - to.elevationM);
      seg.slopePct = (rise / Math.max(1, seg.lengthM / DETOUR_FACTOR)) * 100;
      seg.provenance = {
        ...seg.provenance,
        note: `${seg.provenance.note} Junction heights refined by the Copernicus digital elevation model.`,
      };
    }

    return applied;
  }
}

/* -------------------------------------------------------------------------- */
/*  Derived attribute helpers                                                 */
/* -------------------------------------------------------------------------- */

const CLASS_IMPERVIOUS: Record<RoadClass, number> = {
  highway: 0.86,
  ring: 0.88,
  arterial: 0.85,
  collector: 0.8,
  local: 0.72,
  service: 0.66,
};

const CLASS_DRAIN_TYPE: Record<RoadClass, DrainType> = {
  highway: "box_drain",
  ring: "box_drain",
  arterial: "storm_inlet",
  collector: "storm_inlet",
  local: "storm_inlet",
  service: "storm_inlet",
};

function defaultExposure(roadClass: RoadClass, lengthM: number): number {
  const perKm: Record<RoadClass, number> = {
    highway: 5_200,
    ring: 6_400,
    arterial: 4_800,
    collector: 3_100,
    local: 1_600,
    service: 900,
  };
  return Math.round((perKm[roadClass] * lengthM) / 1000);
}

/**
 * Synthesise the drainage network along a segment.
 *
 * Real inlet inventories exist inside municipal GIS but are not public, so we
 * derive a plausible network from the corridor's known drainage performance.
 * Everything is seeded from the segment id, so a road's drains never change
 * between requests.
 */
function generateDrains(
  segmentId: string,
  geometry: LatLng[],
  lengthM: number,
  drainQuality: number,
  roadClass: RoadClass,
): Drain[] {
  // Well-drained corridors carry roughly 6 inlets/km; neglected ones nearer 2.
  const densityPerKm = 1.8 + drainQuality * 4.6;
  const count = Math.max(1, Math.round((lengthM / 1000) * densityPerKm));

  const drains: Drain[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const at = pointAlong(geometry, t);
    const seedKey = `${segmentId}:drain:${i}`;

    const siltingIndex = clamp(
      1 - drainQuality + hashRange(`${seedKey}:silt`, -0.12, 0.18),
      0.05,
      0.95,
    );

    drains.push({
      id: seedKey,
      at,
      type: CLASS_DRAIN_TYPE[roadClass],
      designCapacityLps: Math.round(hashRange(`${seedKey}:cap`, 140, 420)),
      siltingIndex,
      lastCleanedDaysAgo: Math.round(siltingIndex * hashRange(`${seedKey}:clean`, 60, 400)),
    });
  }

  return drains;
}

/** Point at fraction `t` along a polyline, by arc length. */
function pointAlong(points: LatLng[], t: number): LatLng {
  if (points.length === 1) return points[0];

  const total = polylineLengthM(points);
  const target = total * clamp(t);
  let travelled = 0;

  for (let i = 1; i < points.length; i++) {
    const seg = haversineM(points[i - 1], points[i]);
    if (travelled + seg >= target) {
      const k = seg === 0 ? 0 : (target - travelled) / seg;
      return {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * k,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * k,
      };
    }
    travelled += seg;
  }

  return points[points.length - 1];
}
