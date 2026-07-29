import { fetchElevationField } from "@/lib/signals/terrain";
import { CityGraph, type CitySeed } from "./city-graph";
import {
  BENGALURU,
  BENGALURU_METRO,
  BENGALURU_MONTHLY_NORMAL_MM,
  BENGALURU_NODES,
  BENGALURU_SEGMENTS,
  BENGALURU_WEATHER_GRID,
} from "./seed/bengaluru";

/**
 * City registry.
 *
 * Adding a city is adding a seed file — no engine, routing or UI code is
 * city-specific.
 */
const CITY_SEEDS: Record<string, CitySeed> = {
  bengaluru: {
    city: BENGALURU,
    nodes: BENGALURU_NODES,
    segments: BENGALURU_SEGMENTS,
    metro: BENGALURU_METRO,
    monthlyNormalMm: BENGALURU_MONTHLY_NORMAL_MM,
    weatherGrid: BENGALURU_WEATHER_GRID,
  },
};

export const DEFAULT_CITY_ID = "bengaluru";

const globalRef = globalThis as typeof globalThis & {
  __floodpilotGraphs?: Map<string, CityGraph>;
  __floodpilotElevationDone?: Set<string>;
};

/**
 * Build once per process and reuse. The road network is static; only the risk
 * state on top of it changes, and that lives in `SegmentState`.
 */
export function getCityGraph(cityId: string = DEFAULT_CITY_ID): CityGraph {
  const cache = (globalRef.__floodpilotGraphs ??= new Map());
  const existing = cache.get(cityId);
  if (existing) return existing;

  const seed = CITY_SEEDS[cityId];
  if (!seed) {
    throw new Error(
      `Unknown city "${cityId}". Available: ${Object.keys(CITY_SEEDS).join(", ")}`,
    );
  }

  const graph = new CityGraph(seed);
  cache.set(cityId, graph);
  return graph;
}

/**
 * Replace seeded junction heights with real terrain data, once per process.
 *
 * Elevation is the single most important static input to flood risk, so it is
 * worth one network call at cold start — but it must never block a prediction,
 * hence the fire-once-and-forget-failures shape.
 */
export async function ensureRealElevations(graph: CityGraph): Promise<boolean> {
  const done = (globalRef.__floodpilotElevationDone ??= new Set());
  if (done.has(graph.city.id)) return true;
  done.add(graph.city.id);

  try {
    const field = await fetchElevationField(graph.allNodes().map((n) => n.at));
    if (!field) return false;
    const applied = graph.applyElevations(field);
    return applied > 0;
  } catch {
    return false;
  }
}

export function listCities() {
  return Object.values(CITY_SEEDS).map((s) => s.city);
}

export { CityGraph } from "./city-graph";
export type { CitySeed } from "./city-graph";
export * from "./types";
