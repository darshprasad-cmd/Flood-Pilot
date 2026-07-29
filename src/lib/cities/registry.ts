import { BENGALURU_PLUGIN } from "./bengaluru";
import { DELHI_PLUGIN } from "./delhi";
import type { CityPlugin, HotspotRecord } from "./types";

/**
 * City registry.
 *
 * Delhi is version one. Bengaluru is here to keep the multi-city claim honest —
 * if adding a city required touching the engine, this file would not be the only
 * place a second city appears.
 */
const PLUGINS: Record<string, CityPlugin> = {
  delhi: DELHI_PLUGIN,
  bengaluru: BENGALURU_PLUGIN,
};

export const DEFAULT_CITY_ID = "delhi";

export function getCityPlugin(cityId: string = DEFAULT_CITY_ID): CityPlugin {
  const plugin = PLUGINS[cityId];
  if (!plugin) {
    throw new Error(
      `Unknown city "${cityId}". Available: ${Object.keys(PLUGINS).join(", ")}`,
    );
  }
  return plugin;
}

export function listCityPlugins(): CityPlugin[] {
  // Delhi first — it is the operational deployment, not just one of a set.
  return [PLUGINS[DEFAULT_CITY_ID], ...Object.values(PLUGINS).filter((p) => p.meta.id !== DEFAULT_CITY_ID)];
}

export function cityExists(cityId: string): boolean {
  return cityId in PLUGINS;
}

/* -------------------------------------------------------------------------- */
/*  Hotspots                                                                  */
/* -------------------------------------------------------------------------- */

const globalRef = globalThis as typeof globalThis & {
  __floodpilotHotspots?: Map<string, { at: number; data: HotspotRecord[] }>;
};

const HOTSPOT_CACHE_TTL_MS = 10 * 60_000;

/**
 * Load the hotspot list for a city.
 *
 * Civic bodies republish their waterlogging-point lists every monsoon, so this
 * must be updateable without a deploy. Resolution order:
 *
 *   1. `FLOODPILOT_HOTSPOTS_URL` — a JSON document fetched at runtime. This is
 *      the intended production path: point it at a document the flood control
 *      room owns and the list updates when they update it.
 *   2. `FLOODPILOT_HOTSPOTS_JSON` — inline JSON, for a quick override.
 *   3. The seeded list shipped with the city plugin.
 *
 * An override *replaces* entries with a matching id and appends the rest, so a
 * partial override is legitimate — an operator can correct one underpass without
 * having to restate the whole list.
 */
export async function loadHotspots(
  cityId: string = DEFAULT_CITY_ID,
): Promise<HotspotRecord[]> {
  const cache = (globalRef.__floodpilotHotspots ??= new Map());
  const hit = cache.get(cityId);
  if (hit && Date.now() - hit.at < HOTSPOT_CACHE_TTL_MS) return hit.data;

  const seed = getCityPlugin(cityId).hotspots;
  const overrides = await loadOverrides(cityId);
  const merged = mergeHotspots(seed, overrides);

  cache.set(cityId, { at: Date.now(), data: merged });
  return merged;
}

/** Synchronous access to the shipped list, for code paths that cannot await. */
export function seededHotspots(cityId: string = DEFAULT_CITY_ID): HotspotRecord[] {
  return getCityPlugin(cityId).hotspots;
}

function mergeHotspots(
  seed: HotspotRecord[],
  overrides: HotspotRecord[],
): HotspotRecord[] {
  if (overrides.length === 0) return seed;

  const byId = new Map(seed.map((h) => [h.id, h]));
  for (const override of overrides) {
    byId.set(override.id, { ...byId.get(override.id), ...override });
  }
  return [...byId.values()];
}

async function loadOverrides(cityId: string): Promise<HotspotRecord[]> {
  const url = process.env.FLOODPILOT_HOTSPOTS_URL;
  if (url) {
    try {
      const res = await fetch(url, { next: { revalidate: 600 } });
      if (res.ok) return validate(await res.json(), cityId);
    } catch {
      // A broken override must never take the hotspot list down; fall through
      // to the shipped seed.
    }
  }

  const inline = process.env.FLOODPILOT_HOTSPOTS_JSON;
  if (inline) {
    try {
      return validate(JSON.parse(inline), cityId);
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Accepts either a bare array or `{ [cityId]: HotspotRecord[] }`, and drops any
 * entry missing the fields the engine actually reads.
 */
function validate(payload: unknown, cityId: string): HotspotRecord[] {
  const raw = Array.isArray(payload)
    ? payload
    : ((payload as Record<string, unknown>)?.[cityId] as unknown);

  if (!Array.isArray(raw)) return [];

  return raw.filter((entry): entry is HotspotRecord => {
    if (typeof entry !== "object" || entry === null) return false;
    const h = entry as Partial<HotspotRecord>;
    return (
      typeof h.id === "string" &&
      typeof h.name === "string" &&
      Array.isArray(h.segmentIds) &&
      typeof h.at === "object" &&
      h.at !== null &&
      typeof (h.at as { lat?: unknown }).lat === "number"
    );
  });
}

export * from "./types";
