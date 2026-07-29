import {
  DEFAULT_CITY_ID,
  getCityPlugin,
  listCityPlugins,
  loadHotspots,
} from "@/lib/cities/registry";
import { resolveElevation } from "@/lib/signals/providers/elevation";
import { CityGraph } from "./city-graph";

const globalRef = globalThis as typeof globalThis & {
  __floodpilotGraphs?: Map<string, CityGraph>;
  __floodpilotElevationDone?: Set<string>;
};

/**
 * Build once per process and reuse. The road network is static; only the risk
 * state on top of it changes, and that lives in `SegmentState`.
 *
 * Hotspots are loaded asynchronously because the register is designed to be
 * overridable at runtime, so use `getCityGraphAsync` on any path that can await.
 */
export function getCityGraph(cityId: string = DEFAULT_CITY_ID): CityGraph {
  const cache = (globalRef.__floodpilotGraphs ??= new Map());
  const existing = cache.get(cityId);
  if (existing) return existing;

  const graph = new CityGraph(getCityPlugin(cityId));
  cache.set(cityId, graph);
  return graph;
}

/**
 * Graph built with the live hotspot register applied.
 *
 * Rebuilds only when an override actually changes the register, so the common
 * case is still a cache hit.
 */
export async function getCityGraphAsync(
  cityId: string = DEFAULT_CITY_ID,
): Promise<CityGraph> {
  const plugin = getCityPlugin(cityId);
  const hotspots = await loadHotspots(cityId);

  const cache = (globalRef.__floodpilotGraphs ??= new Map());
  const existing = cache.get(cityId);
  if (existing && existing.allSegments().length > 0) {
    const seededCount = plugin.hotspots.length;
    if (hotspots.length === seededCount) return existing;
  }

  const graph = new CityGraph(plugin, hotspots);
  cache.set(cityId, graph);
  return graph;
}

/**
 * Replace seeded junction heights with real terrain data, once per process.
 *
 * Elevation is the single most important static input to flood risk — in Delhi
 * the entire road network spans about 34 metres, so a two-metre error changes
 * the answer. Worth one network call at cold start, but it must never block a
 * prediction.
 */
export async function ensureRealElevations(graph: CityGraph): Promise<boolean> {
  const done = (globalRef.__floodpilotElevationDone ??= new Set());
  if (done.has(graph.city.id)) return true;
  done.add(graph.city.id);

  try {
    const field = await resolveElevation(
      graph.allNodes().map((n) => n.at),
      graph.plugin.sources.elevation,
    );
    if (!field) return false;
    return graph.applyElevations(field) > 0;
  } catch {
    return false;
  }
}

export function listCities() {
  return listCityPlugins().map((p) => p.meta);
}

export { DEFAULT_CITY_ID } from "@/lib/cities/registry";
export { CityGraph } from "./city-graph";
export * from "./types";
