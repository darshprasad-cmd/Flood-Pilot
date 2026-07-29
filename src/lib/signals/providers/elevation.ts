import type { ProviderId } from "@/lib/cities/types";
import type { LatLng } from "@/lib/core/types";
import { fetchElevationField } from "../terrain";
import type { ElevationField } from "../types";
import { fetchGoogleElevation } from "./google";

/**
 * Resolve elevation from the city's preferred providers in order.
 *
 * Google first for Delhi (per the brief), Copernicus via Open-Meteo as the
 * keyless fallback. Whichever answers stamps its own provenance, so the
 * confidence layer and the source panel both reflect reality.
 */
export async function resolveElevation(
  points: LatLng[],
  preference: ProviderId[],
  now: Date = new Date(),
): Promise<ElevationField | null> {
  for (const provider of preference) {
    if (provider === "google-elevation") {
      const field = await fetchGoogleElevation(points, now);
      if (field) return field;
      continue;
    }
    if (provider === "open-meteo-elevation" || provider === "open-meteo") {
      const field = await fetchElevationField(points, now);
      if (field) return field;
    }
  }
  return null;
}
