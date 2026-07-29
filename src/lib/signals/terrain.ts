import type { LatLng } from "@/lib/core/types";
import { fetchJson } from "./fetcher";
import type { ElevationField, RiverCell, RiverField } from "./types";

const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood";

interface ElevationPayload {
  elevation?: (number | null)[];
}

/**
 * Real terrain heights from the Copernicus DEM, used to refine the seeded
 * elevations in the road graph.
 *
 * The API accepts up to 100 coordinates per call, so a whole city's junctions
 * fit in one or two requests.
 */
export async function fetchElevationField(
  points: LatLng[],
  now: Date = new Date(),
): Promise<ElevationField | null> {
  if (points.length === 0) return null;

  const batches: LatLng[][] = [];
  for (let i = 0; i < points.length; i += 100) {
    batches.push(points.slice(i, i + 100));
  }

  const samples: { at: LatLng; elevationM: number }[] = [];
  let anyFailed = false;

  for (const batch of batches) {
    const url =
      `${ELEVATION_URL}?latitude=${batch.map((p) => p.lat.toFixed(5)).join(",")}` +
      `&longitude=${batch.map((p) => p.lng.toFixed(5)).join(",")}`;

    // Terrain does not move; cache hard.
    const res = await fetchJson<ElevationPayload>(url, {
      revalidate: 30 * 86_400,
      timeoutMs: 7000,
      label: "open-meteo/elevation",
    });

    const values = res.data?.elevation;
    if (!res.ok || !values || values.length !== batch.length) {
      anyFailed = true;
      continue;
    }

    batch.forEach((at, i) => {
      const v = values[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        samples.push({ at, elevationM: v });
      }
    });
  }

  if (samples.length === 0) return null;

  return {
    provenance: {
      source: "open-meteo/elevation",
      kind: "measured",
      fetchedAt: now.toISOString(),
      reliability: anyFailed ? 0.7 : 0.92,
      live: true,
      note: anyFailed
        ? `Digital elevation model resolved ${samples.length}/${points.length} junctions; the rest keep their seeded heights.`
        : "Junction heights from the Copernicus digital elevation model.",
    },
    samples,
  };
}

/**
 * River discharge from the Open-Meteo global flood model (GloFAS).
 *
 * Bengaluru floods almost entirely from rainfall rather than rivers, so this is
 * a secondary signal here — but the integration is real, which means a city on a
 * river is already supported rather than being a future rewrite.
 */
export async function fetchRiverField(
  points: LatLng[],
  now: Date = new Date(),
): Promise<RiverField> {
  const url =
    `${FLOOD_URL}?latitude=${points.map((p) => p.lat.toFixed(4)).join(",")}` +
    `&longitude=${points.map((p) => p.lng.toFixed(4)).join(",")}` +
    `&daily=river_discharge,river_discharge_mean&forecast_days=5&timezone=GMT`;

  const res = await fetchJson<unknown>(url, {
    revalidate: 6 * 3600,
    timeoutMs: 6000,
    label: "open-meteo/flood",
  });

  const payloads = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];

  const cells: RiverCell[] = points.map((at, i) => {
    const daily = (payloads[i] as { daily?: Record<string, unknown> } | undefined)
      ?.daily;
    const discharge = asNumbers(daily?.river_discharge);
    const meanFlow = asNumbers(daily?.river_discharge_mean);

    if (!discharge || discharge.length === 0) {
      return {
        at,
        dischargeM3s: 0,
        ratioToMean: 1,
        risingRate: 0,
        available: false,
      };
    }

    const today = discharge[0] ?? 0;
    const later = discharge[discharge.length - 1] ?? today;
    const baseline =
      meanFlow && meanFlow.length > 0 && (meanFlow[0] ?? 0) > 0
        ? (meanFlow[0] as number)
        : Math.max(0.001, today);

    return {
      at,
      dischargeM3s: today,
      ratioToMean: today / baseline,
      risingRate: (later - today) / Math.max(1, discharge.length - 1),
      available: true,
    };
  });

  const anyAvailable = cells.some((c) => c.available);

  return {
    provenance: {
      source: "open-meteo/flood",
      kind: anyAvailable ? "forecast" : "modelled",
      fetchedAt: now.toISOString(),
      reliability: anyAvailable ? 0.6 : 0.25,
      live: res.ok && anyAvailable,
      note: anyAvailable
        ? "Global flood awareness model — river discharge forecast."
        : "No modelled river reach near these coordinates; flooding here is treated as rainfall-driven only.",
    },
    cells,
  };
}

function asNumbers(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.map((v) => (typeof v === "number" ? v : 0));
  return out.length ? out : null;
}
