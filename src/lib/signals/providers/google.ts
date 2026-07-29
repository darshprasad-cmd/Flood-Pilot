import { clamp } from "@/lib/core/math";
import type { LatLng } from "@/lib/core/types";
import { fetchJson } from "../fetcher";
import type { ElevationField, TrafficField, TrafficReading } from "../types";
import { env, hasEnv, type ProviderStatus } from "./types";

/**
 * Google Maps Platform adapters — elevation, traffic and directions.
 *
 * A deliberate constraint from the brief, and the right one: Google is used as a
 * *source*, not as the decision-maker. Elevation and live congestion feed our own
 * risk model; Directions supplies a road-network reference and alternate-route
 * candidates. The route that gets recommended is always chosen by FloodPilot's
 * risk-weighted search over the road risk graph, never by handing the problem to
 * Google and displaying the answer.
 */

const ELEVATION_URL = "https://maps.googleapis.com/maps/api/elevation/json";
const MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";
const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

export function googleStatus(kind: "elevation" | "traffic"): ProviderStatus {
  const available = hasEnv("GOOGLE_MAPS_API_KEY");
  const name =
    kind === "elevation" ? "Google Elevation API" : "Google Maps Platform";

  return {
    id: kind === "elevation" ? "google-elevation" : "google-traffic",
    name,
    authority: "Google",
    available,
    blockedByCredential: !available,
    envKey: "GOOGLE_MAPS_API_KEY",
    detail: available
      ? kind === "elevation"
        ? "Connected. Road elevation and local depressions come from Google."
        : "Connected. Congestion is derived from live travel times."
      : `Not connected. Set GOOGLE_MAPS_API_KEY to use ${name}; ${
          kind === "elevation"
            ? "elevation falls back to the Copernicus DEM via Open-Meteo"
            : "congestion falls back to the internal time-of-day model"
        }.`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Elevation                                                                 */
/* -------------------------------------------------------------------------- */

interface GoogleElevationPayload {
  status?: string;
  results?: { elevation?: number; location?: { lat: number; lng: number } }[];
}

/**
 * Road elevation from Google.
 *
 * Delhi's whole road network spans about 34 metres, so elevation accuracy is not
 * a nicety — a two-metre error moves a road from "drains fine" to "local
 * depression". Batched at 300 points per request, which is within the API's URL
 * length limits for locations of this precision.
 */
export async function fetchGoogleElevation(
  points: LatLng[],
  now: Date = new Date(),
): Promise<ElevationField | null> {
  const key = env("GOOGLE_MAPS_API_KEY");
  if (!key || points.length === 0) return null;

  const samples: { at: LatLng; elevationM: number }[] = [];
  let anyFailed = false;

  for (let i = 0; i < points.length; i += 300) {
    const batch = points.slice(i, i + 300);
    const locations = batch
      .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
      .join("|");

    const res = await fetchJson<GoogleElevationPayload>(
      `${ELEVATION_URL}?locations=${encodeURIComponent(locations)}&key=${key}`,
      { revalidate: 30 * 86_400, timeoutMs: 8000, label: "google/elevation" },
    );

    if (!res.ok || res.data?.status !== "OK" || !res.data.results) {
      anyFailed = true;
      continue;
    }

    res.data.results.forEach((r, idx) => {
      const target = batch[idx];
      if (typeof r.elevation === "number" && target) {
        samples.push({ at: target, elevationM: r.elevation });
      }
    });
  }

  if (samples.length === 0) return null;

  return {
    provenance: {
      source: "google/elevation",
      kind: "measured",
      fetchedAt: now.toISOString(),
      reliability: anyFailed ? 0.78 : 0.94,
      live: true,
      note: `Road elevation from the Google Elevation API (${samples.length}/${points.length} points resolved).`,
    },
    samples,
  };
}

/* -------------------------------------------------------------------------- */
/*  Traffic                                                                   */
/* -------------------------------------------------------------------------- */

interface MatrixPayload {
  status?: string;
  rows?: {
    elements?: {
      status?: string;
      duration?: { value: number };
      duration_in_traffic?: { value: number };
      distance?: { value: number };
    }[];
  }[];
}

export interface TrafficSegmentInput {
  id: string;
  from: LatLng;
  to: LatLng;
  speedLimitKph: number;
  lengthM: number;
}

/**
 * Live congestion derived from Google travel times.
 *
 * Google does not expose a raw congestion number, so we take the ratio of
 * `duration_in_traffic` to free-flow `duration` for each segment — which is what
 * congestion actually means to a driver. Requested one origin-destination pair at
 * a time within a batched matrix call to keep the mapping unambiguous.
 */
export async function fetchGoogleTraffic(
  segments: TrafficSegmentInput[],
  now: Date = new Date(),
): Promise<TrafficField | null> {
  const key = env("GOOGLE_MAPS_API_KEY");
  if (!key || segments.length === 0) return null;

  const bySegment: Record<string, TrafficReading> = {};
  let resolved = 0;

  // Distance Matrix bills per element; 25 pairs per call keeps requests small
  // and stays inside the documented per-request element ceiling.
  const BATCH = 25;

  for (let i = 0; i < segments.length; i += BATCH) {
    const batch = segments.slice(i, i + BATCH);
    const origins = batch
      .map((s) => `${s.from.lat.toFixed(6)},${s.from.lng.toFixed(6)}`)
      .join("|");
    const destinations = batch
      .map((s) => `${s.to.lat.toFixed(6)},${s.to.lng.toFixed(6)}`)
      .join("|");

    const url =
      `${MATRIX_URL}?origins=${encodeURIComponent(origins)}` +
      `&destinations=${encodeURIComponent(destinations)}` +
      `&departure_time=now&traffic_model=best_guess&mode=driving&key=${key}`;

    const res = await fetchJson<MatrixPayload>(url, {
      // Congestion is the fastest-moving signal here; 5 minutes.
      revalidate: 300,
      timeoutMs: 8000,
      label: "google/distance-matrix",
    });

    if (!res.ok || res.data?.status !== "OK" || !res.data.rows) continue;

    batch.forEach((segment, idx) => {
      // Diagonal element: origin i to destination i is this segment.
      const element = res.data?.rows?.[idx]?.elements?.[idx];
      if (!element || element.status !== "OK" || !element.duration) return;

      const free = element.duration.value;
      const actual = element.duration_in_traffic?.value ?? free;
      if (free <= 0) return;

      const delayFactor = clamp(actual / free, 1, 6);
      // Invert the delay curve used by the internal model so both sources
      // produce a comparable 0..1 density.
      const density = clamp(((delayFactor - 1) / 2.6) ** (1 / 2.1));

      bySegment[segment.id] = {
        segmentId: segment.id,
        density,
        delayFactor,
        meanSpeedKph: Math.max(4, segment.speedLimitKph / delayFactor),
      };
      resolved++;
    });
  }

  if (resolved === 0) return null;

  return {
    provenance: {
      source: "google/distance-matrix",
      kind: "measured",
      fetchedAt: now.toISOString(),
      reliability: 0.88,
      live: true,
      note: `Live congestion from Google travel times (${resolved}/${segments.length} segments).`,
    },
    bySegment,
  };
}

/* -------------------------------------------------------------------------- */
/*  Directions — reference only                                               */
/* -------------------------------------------------------------------------- */

export interface GoogleRouteReference {
  summary: string;
  durationSec: number;
  durationInTrafficSec: number | null;
  distanceM: number;
  /** Decoded polyline of the route. */
  path: LatLng[];
}

interface DirectionsPayload {
  status?: string;
  routes?: {
    summary?: string;
    overview_polyline?: { points?: string };
    legs?: {
      duration?: { value: number };
      duration_in_traffic?: { value: number };
      distance?: { value: number };
    }[];
  }[];
}

/**
 * Google's own route suggestions, used strictly as a cross-check.
 *
 * The brief is explicit that routing must not be delegated to Google, and it is
 * right to be: Google optimises for time and has no idea that the underpass on
 * its fastest route is about to be under a metre of water. We fetch its
 * alternates so the product can show *why* the obvious route is the wrong one.
 */
export async function fetchGoogleRoutes(
  origin: LatLng,
  destination: LatLng,
): Promise<GoogleRouteReference[] | null> {
  const key = env("GOOGLE_MAPS_API_KEY");
  if (!key) return null;

  const url =
    `${DIRECTIONS_URL}?origin=${origin.lat},${origin.lng}` +
    `&destination=${destination.lat},${destination.lng}` +
    `&alternatives=true&departure_time=now&mode=driving&key=${key}`;

  const res = await fetchJson<DirectionsPayload>(url, {
    revalidate: 300,
    timeoutMs: 8000,
    label: "google/directions",
  });

  if (!res.ok || res.data?.status !== "OK" || !res.data.routes) return null;

  return res.data.routes.map((route) => {
    const leg = route.legs?.[0];
    return {
      summary: route.summary ?? "Route",
      durationSec: leg?.duration?.value ?? 0,
      durationInTrafficSec: leg?.duration_in_traffic?.value ?? null,
      distanceM: leg?.distance?.value ?? 0,
      path: decodePolyline(route.overview_polyline?.points ?? ""),
    };
  });
}

/** Google's encoded polyline format. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}
