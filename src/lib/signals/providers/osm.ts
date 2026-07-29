import { clamp, distanceToPolylineM, haversineM } from "@/lib/core/math";
import type { LatLng } from "@/lib/core/types";
import type { ProviderStatus } from "./types";

/**
 * OpenStreetMap (Overpass) adapter.
 *
 * The one preferred source for Delhi that needs no credential and can be
 * verified right now. OSM carries the physical drainage geography that
 * determines waterlogging — nallahs, canals, culverts, the tunnels that make an
 * underpass an underpass — and Delhi's coverage of these is genuinely good.
 *
 * Overpass is slow (tens of seconds) and rate-limited, so it is never on the
 * request path. `scripts/enrich-osm.mjs` runs the query offline and writes a
 * cache into the city plugin; at runtime we read the cache and only fall back to
 * a live query if explicitly asked.
 */

const OVERPASS_ENDPOINT =
  process.env.OVERPASS_API_URL?.trim() || "https://overpass-api.de/api/interpreter";

export interface OsmWaterway {
  id: number;
  kind: string;
  name: string | null;
  path: LatLng[];
}

export interface OsmPoint {
  id: number;
  kind: string;
  name: string | null;
  at: LatLng;
}

export interface OsmDrainageLayer {
  cityId: string;
  generatedAt: string;
  /** Drains, canals, ditches, streams and rivers. */
  waterways: OsmWaterway[];
  /** Culverts — where a drain passes under a road. */
  culverts: OsmPoint[];
  /** Road tunnels and underpasses. */
  underpasses: OsmPoint[];
  bridges: OsmPoint[];
  waterBodies: OsmPoint[];
  counts: Record<string, number>;
}

export const EMPTY_OSM_LAYER: OsmDrainageLayer = {
  cityId: "",
  generatedAt: new Date(0).toISOString(),
  waterways: [],
  culverts: [],
  underpasses: [],
  bridges: [],
  waterBodies: [],
  counts: {},
};

export function osmStatus(layer: OsmDrainageLayer | null): ProviderStatus {
  const loaded = !!layer && layer.waterways.length > 0;
  return {
    id: "osm-overpass",
    name: "OpenStreetMap (Overpass API)",
    authority: "OpenStreetMap contributors",
    available: loaded,
    blockedByCredential: false,
    detail: loaded
      ? `${layer!.waterways.length} drainage channels, ${layer!.culverts.length} culverts and ${layer!.underpasses.length} underpasses loaded from OpenStreetMap.`
      : "No cached OSM drainage layer. Run `npm run enrich:osm` to extract drains, culverts, underpasses and water bodies for this city.",
  };
}

/**
 * The Overpass query.
 *
 * Exported so the offline script and any live call use exactly the same
 * definition of what counts as drainage geography.
 */
export function buildOverpassQuery(bounds: [number, number, number, number]): string {
  const [south, west, north, east] = bounds;
  const bbox = `${south},${west},${north},${east}`;

  return `[out:json][timeout:180];
(
  way["waterway"~"^(drain|canal|ditch|stream|river)$"](${bbox});
  way["natural"="water"](${bbox});
  way["landuse"="reservoir"](${bbox});
  node["man_made"="culvert"](${bbox});
  way["tunnel"="culvert"](${bbox});
  way["highway"]["tunnel"="yes"](${bbox});
  way["highway"]["layer"~"^-"](${bbox});
  way["highway"]["bridge"="yes"](${bbox});
);
out geom 6000;`;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassPayload {
  elements?: OverpassElement[];
}

/** Turn a raw Overpass payload into the drainage layer. Shared with the script. */
export function parseOverpass(
  cityId: string,
  payload: OverpassPayload,
  generatedAt: string,
): OsmDrainageLayer {
  const layer: OsmDrainageLayer = {
    cityId,
    generatedAt,
    waterways: [],
    culverts: [],
    underpasses: [],
    bridges: [],
    waterBodies: [],
    counts: {},
  };

  const bump = (key: string) => {
    layer.counts[key] = (layer.counts[key] ?? 0) + 1;
  };

  for (const el of payload.elements ?? []) {
    const tags = el.tags ?? {};
    const path: LatLng[] = (el.geometry ?? []).map((g) => ({
      lat: g.lat,
      lng: g.lon,
    }));
    const centre: LatLng | null = el.lat !== undefined && el.lon !== undefined
      ? { lat: el.lat, lng: el.lon }
      : el.center
        ? { lat: el.center.lat, lng: el.center.lon }
        : path.length > 0
          ? path[Math.floor(path.length / 2)]
          : null;

    const name = tags.name ?? null;

    if (tags.waterway) {
      if (path.length >= 2) {
        layer.waterways.push({ id: el.id, kind: tags.waterway, name, path });
        bump(`waterway:${tags.waterway}`);
      }
      continue;
    }

    if (tags.man_made === "culvert" || tags.tunnel === "culvert") {
      if (centre) {
        layer.culverts.push({ id: el.id, kind: "culvert", name, at: centre });
        bump("culvert");
      }
      continue;
    }

    if (tags.highway && (tags.tunnel === "yes" || (tags.layer ?? "").startsWith("-"))) {
      if (centre) {
        layer.underpasses.push({
          id: el.id,
          kind: tags.tunnel === "yes" ? "tunnel" : "below_grade",
          name,
          at: centre,
        });
        bump("underpass");
      }
      continue;
    }

    if (tags.highway && tags.bridge === "yes") {
      if (centre) {
        layer.bridges.push({ id: el.id, kind: "bridge", name, at: centre });
        bump("bridge");
      }
      continue;
    }

    if (tags.natural === "water" || tags.landuse === "reservoir") {
      if (centre) {
        layer.waterBodies.push({
          id: el.id,
          kind: tags.natural === "water" ? "water" : "reservoir",
          name,
          at: centre,
        });
        bump("water_body");
      }
    }
  }

  return layer;
}

/** Live Overpass query. Only used by the offline enrichment script by default. */
export async function fetchOsmDrainage(
  cityId: string,
  bounds: [number, number, number, number],
  timeoutMs = 180_000,
): Promise<OsmDrainageLayer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      body: `data=${encodeURIComponent(buildOverpassQuery(bounds))}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parseOverpass(cityId, await res.json(), new Date().toISOString());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/*  Applying the layer to road segments                                       */
/* -------------------------------------------------------------------------- */

export interface OsmSegmentEnrichment {
  /** Metres to the nearest mapped drainage channel. */
  distanceToNaturalDrainageM: number;
  /** Name of that channel, where OSM has one. */
  nearestChannel: string | null;
  /** Mapped culverts within 250 m. */
  culvertCount: number;
  /** True when OSM maps a tunnel or below-grade road on this stretch. */
  osmUnderpass: boolean;
  /** Mapped water bodies within 600 m. */
  waterBodyCount: number;
}

/**
 * Match a road segment against the OSM drainage layer.
 *
 * "Distance to natural drainage" is a real predictor and one that seeded data
 * cannot supply: a road 80 m from a nallah behaves completely differently from
 * one 800 m away, whatever its own storm drains look like.
 */
export function enrichSegmentFromOsm(
  midpoint: LatLng,
  geometry: LatLng[],
  layer: OsmDrainageLayer,
): OsmSegmentEnrichment {
  let nearest = Infinity;
  let nearestChannel: string | null = null;

  for (const way of layer.waterways) {
    // Cheap reject before the expensive polyline distance.
    if (haversineM(midpoint, way.path[0]) > 8000) continue;
    const d = distanceToPolylineM(midpoint, way.path);
    if (d < nearest) {
      nearest = d;
      nearestChannel = way.name ?? way.kind;
    }
  }

  const culvertCount = layer.culverts.filter(
    (c) => haversineM(midpoint, c.at) < 250,
  ).length;

  const waterBodyCount = layer.waterBodies.filter(
    (w) => haversineM(midpoint, w.at) < 600,
  ).length;

  const osmUnderpass = layer.underpasses.some((u) =>
    geometry.some((g) => haversineM(g, u.at) < 180),
  );

  return {
    distanceToNaturalDrainageM: Number.isFinite(nearest) ? nearest : 5000,
    nearestChannel,
    culvertCount,
    osmUnderpass,
    waterBodyCount,
  };
}

/**
 * How much OSM's drainage geography should adjust a road's modelled drain
 * performance. Close to a mapped channel with culverts present is genuinely
 * better drained; far from any channel is genuinely worse.
 */
export function osmDrainageAdjustment(e: OsmSegmentEnrichment): number {
  const proximity = clamp(1 - e.distanceToNaturalDrainageM / 1500);
  const culverts = clamp(e.culvertCount / 4);
  return clamp(proximity * 0.16 + culverts * 0.08 - (proximity < 0.1 ? 0.08 : 0), -0.1, 0.22);
}
