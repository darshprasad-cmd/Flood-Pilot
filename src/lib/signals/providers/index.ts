import type { CityPlugin, ProviderId } from "@/lib/cities/types";
import { cwcStatus } from "./cwc";
import { googleStatus } from "./google";
import { imdStatus } from "./imd";
import type { OsmDrainageLayer } from "./osm";
import { osmStatus } from "./osm";
import type { ProviderStatus } from "./types";

/**
 * Status of every data source this city prefers.
 *
 * Drives the "prediction based on" panel. Sources that are unavailable are shown
 * as unavailable, with the reason and the environment variable that would
 * connect them — a user should be able to tell at a glance whether they are
 * looking at an IMD forecast or a fallback, because that difference matters.
 */
export function sourceStatuses(
  plugin: CityPlugin,
  osmLayer: OsmDrainageLayer | null,
): ProviderStatus[] {
  const wanted = new Set<ProviderId>([
    ...plugin.sources.rainfall,
    ...plugin.sources.river,
    ...plugin.sources.elevation,
    ...plugin.sources.traffic,
    ...plugin.sources.drainage,
  ]);

  const statuses: ProviderStatus[] = [];

  if (wanted.has("imd")) statuses.push(imdStatus());
  if (wanted.has("cwc")) statuses.push(cwcStatus());
  if (wanted.has("google-elevation")) statuses.push(googleStatus("elevation"));
  if (wanted.has("google-traffic")) statuses.push(googleStatus("traffic"));
  if (wanted.has("osm-overpass")) statuses.push(osmStatus(osmLayer));

  statuses.push({
    id: "open-meteo",
    name: "Open-Meteo",
    authority: "Open data",
    available: true,
    blockedByCredential: false,
    detail:
      "Always available. Provides the rainfall, elevation and river-discharge fallbacks, and the observed rainfall history used for ground saturation.",
  });

  return statuses;
}

export type { ProviderStatus } from "./types";
export { imdStatus } from "./imd";
export { cwcStatus, GAUGE_STATUS_LABEL, type RiverGaugeReading } from "./cwc";
export { googleStatus, fetchGoogleRoutes, type GoogleRouteReference } from "./google";
export { osmStatus, enrichSegmentFromOsm, osmDrainageAdjustment } from "./osm";
export type { OsmDrainageLayer, OsmSegmentEnrichment } from "./osm";
export { loadOsmLayer } from "./osm-cache";
export { resolveElevation } from "./elevation";
export { resolveRainfall, type RainfallResult } from "./rainfall";
export { resolveRiver, type RiverResult } from "./river";
export { resolveTraffic } from "./traffic";
export type { ImdWarning, ImdWarningLevel } from "./imd";
export { warningRiskFloor } from "./imd";
