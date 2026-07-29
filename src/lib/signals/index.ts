import { interpolateIDW } from "@/lib/core/math";
import { localMonthIndex, tzOffsetMinutes } from "@/lib/core/time";
import type { LatLng, SignalProvenance } from "@/lib/core/types";
import type { CityGraph } from "@/lib/graph/city-graph";
import { fetchAntecedentField } from "./antecedent";
import {
  resolveRainfall,
  resolveRiver,
  resolveTraffic,
} from "./providers";
import { buildReportField } from "./reports";
import type { ScenarioId } from "./scenarios";
import type {
  AntecedentCell,
  SignalBundle,
  SourceUsage,
  WeatherCell,
} from "./types";

/**
 * Gather every input the intelligence engine needs for one city, for one tick.
 *
 * Signals are resolved through the city's declared source preferences — for
 * Delhi that means IMD before Open-Meteo, CWC before the global flood model, and
 * Google before the internal traffic model. Upstream calls run concurrently, and
 * none of them can fail the request: a failure degrades confidence and is
 * recorded in `sources` so the product can say what it actually used.
 */
export async function collectSignals(
  graph: CityGraph,
  scenario: ScenarioId,
  now: Date = new Date(),
): Promise<SignalBundle> {
  const grid = graph.weatherGrid;
  const plugin = graph.plugin;
  const monthIndex = localMonthIndex(now, graph.city.timezone);
  const monthlyNormal = graph.monthlyNormalMm[monthIndex] ?? 60;

  // River reaches are sparse; three probes across the city is plenty.
  const riverProbes: LatLng[] = [
    grid[0],
    grid[Math.floor(grid.length / 2)],
    grid[grid.length - 1],
  ];

  const [rainfall, antecedent, reports] = await Promise.all([
    resolveRainfall(grid, plugin.sources.rainfall, scenario, now),
    fetchAntecedentField(grid, monthlyNormal, scenario, now),
    buildReportField(graph.city.id, now),
  ]);

  const meanWetness =
    antecedent.cells.reduce((s, c) => s + c.wetnessIndex, 0) /
    Math.max(1, antecedent.cells.length);

  const weather = rainfall.data.field;
  const peakRain = Math.max(0, ...weather.cells.map((c) => c.peakIntensityMmHr));

  const [river, traffic] = await Promise.all([
    resolveRiver(
      plugin.gauges,
      riverProbes,
      plugin.sources.river,
      meanWetness,
      now,
    ),
    resolveTraffic(
      graph.allSegments(),
      plugin.sources.traffic,
      now,
      peakRain,
      tzOffsetMinutes(graph.city.timezone, now),
    ),
  ]);

  const provenances: SignalProvenance[] = [
    weather.provenance,
    antecedent.provenance,
    river.data.field.provenance,
    traffic.data.provenance,
    reports.provenance,
  ];

  const sources: SourceUsage[] = [
    {
      signal: "rainfall",
      provider: rainfall.usedProvider,
      providerName: providerName(rainfall.usedProvider),
      used: true,
      detail: weather.provenance.note ?? "",
    },
    ...rainfall.skipped.map((s) => ({
      signal: "rainfall" as const,
      provider: s.id,
      providerName: providerName(s.id),
      used: false,
      detail: s.reason,
    })),
    {
      signal: "river",
      provider: river.usedProvider,
      providerName: providerName(river.usedProvider),
      used: true,
      detail:
        river.data.gauges[0]?.note ?? river.data.field.provenance.note ?? "",
    },
    ...river.skipped.map((s) => ({
      signal: "river" as const,
      provider: s.id,
      providerName: providerName(s.id),
      used: false,
      detail: s.reason,
    })),
    {
      signal: "traffic",
      provider: traffic.usedProvider,
      providerName: providerName(traffic.usedProvider),
      used: true,
      detail: traffic.data.provenance.note ?? "",
    },
    ...traffic.skipped.map((s) => ({
      signal: "traffic" as const,
      provider: s.id,
      providerName: providerName(s.id),
      used: false,
      detail: s.reason,
    })),
    {
      signal: "reports",
      provider: "floodpilot",
      providerName: "Citizen reports",
      used: true,
      detail: reports.provenance.note ?? "",
    },
  ];

  return {
    cityId: graph.city.id,
    now,
    weather,
    antecedent,
    elevation: null,
    river: river.data.field,
    traffic: traffic.data,
    reports,
    gauges: river.data.gauges,
    floodplainPressure: river.data.floodplainPressure,
    warnings: rainfall.data.warnings,
    provenances,
    sources,
    degraded: provenances.some((p) => !p.live && p.kind !== "seeded"),
  };
}

const PROVIDER_NAMES: Record<string, string> = {
  imd: "India Meteorological Department",
  cwc: "Central Water Commission",
  "google-traffic": "Google Maps traffic",
  "google-elevation": "Google Elevation API",
  "google-directions": "Google Directions",
  "osm-overpass": "OpenStreetMap",
  "open-meteo": "Open-Meteo",
  "open-meteo-flood": "Open-Meteo global flood model",
  "open-meteo-elevation": "Copernicus DEM via Open-Meteo",
  "internal-model": "दिशाAI internal model",
  seed: "दिशाAI seeded dataset",
};

export function providerName(id: string): string {
  return PROVIDER_NAMES[id] ?? id;
}

/* -------------------------------------------------------------------------- */
/*  Spatial sampling                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Sample the rainfall field at a point.
 *
 * The whole curve is interpolated, not just the headline number, because when a
 * road floods depends on the shape of the storm at *that* road. Delhi routinely
 * records 100 mm in Najafgarh and 5 mm in Mayur Vihar in the same three hours.
 */
export function sampleWeather(bundle: SignalBundle, at: LatLng): WeatherCell {
  const cells = bundle.weather.cells.map((value) => ({ at: value.at, value }));
  if (cells.length === 1) return cells[0].value;

  const pick = (extract: (c: WeatherCell) => number) =>
    interpolateIDW(at, cells, extract);

  const template = cells[0].value;
  const curve = template.curve.map((point, i) => ({
    minutesFromNow: point.minutesFromNow,
    mmPerHr: interpolateIDW(at, cells, (c) => c.curve[i]?.mmPerHr ?? 0),
    probability: interpolateIDW(at, cells, (c) => c.curve[i]?.probability ?? 0),
  }));

  const peak = curve.reduce(
    (best, p) => (p.mmPerHr > best.mmPerHr ? p : best),
    curve[0] ?? { minutesFromNow: 0, mmPerHr: 0, probability: 0 },
  );

  return {
    at,
    tempC: pick((c) => c.tempC),
    humidity: pick((c) => c.humidity),
    currentRainMmHr: pick((c) => c.currentRainMmHr),
    curve,
    accum1hMm: pick((c) => c.accum1hMm),
    accum3hMm: pick((c) => c.accum3hMm),
    accum6hMm: pick((c) => c.accum6hMm),
    accum24hMm: pick((c) => c.accum24hMm),
    past24hMm: pick((c) => c.past24hMm),
    peakIntensityMmHr: peak.mmPerHr,
    peakInMin: peak.mmPerHr > 0.6 ? peak.minutesFromNow : null,
    eventTotalMm: pick((c) => c.eventTotalMm),
  };
}

export function sampleAntecedent(
  bundle: SignalBundle,
  at: LatLng,
): AntecedentCell {
  const cells = bundle.antecedent.cells.map((value) => ({ at: value.at, value }));
  if (cells.length === 1) return cells[0].value;

  const pick = (extract: (c: AntecedentCell) => number) =>
    interpolateIDW(at, cells, extract);

  return {
    at,
    last3dMm: pick((c) => c.last3dMm),
    last7dMm: pick((c) => c.last7dMm),
    last30dMm: pick((c) => c.last30dMm),
    wetnessIndex: pick((c) => c.wetnessIndex),
    consecutiveWetDays: Math.round(pick((c) => c.consecutiveWetDays)),
  };
}

/** Modelled river influence where no gauge covers a location. */
export function sampleRiverDischarge(bundle: SignalBundle, at: LatLng): number {
  const available = bundle.river.cells.filter((c) => c.available);
  if (available.length === 0) return 0;
  return interpolateIDW(
    at,
    available.map((value) => ({ at: value.at, value })),
    (c) => Math.max(0, c.ratioToMean - 1),
  );
}

export * from "./types";
export { SCENARIOS, resolveScenario, type ScenarioId } from "./scenarios";
export { HORIZON_MIN } from "./weather";
