import { interpolateIDW } from "@/lib/core/math";
import { localMonthIndex } from "@/lib/core/time";
import type { LatLng, SignalProvenance } from "@/lib/core/types";
import type { CityGraph } from "@/lib/graph/city-graph";
import { tzOffsetMinutes } from "@/lib/core/time";
import { fetchAntecedentField } from "./antecedent";
import { buildReportField } from "./reports";
import type { ScenarioId } from "./scenarios";
import { fetchRiverField } from "./terrain";
import { buildTrafficField } from "./traffic";
import type {
  AntecedentCell,
  SignalBundle,
  WeatherCell,
} from "./types";
import { fetchWeatherField } from "./weather";

/**
 * Gather every input the intelligence engine needs for one city, for one tick.
 *
 * Upstream calls run concurrently — a slow river-discharge API must not delay a
 * rainfall-driven prediction — and none of them can fail the request; a failure
 * degrades confidence instead.
 */
export async function collectSignals(
  graph: CityGraph,
  scenario: ScenarioId,
  now: Date = new Date(),
): Promise<SignalBundle> {
  const grid = graph.weatherGrid;
  const monthIndex = localMonthIndex(now, graph.city.timezone);
  const monthlyNormal = graph.monthlyNormalMm[monthIndex] ?? 60;

  // River reaches are sparse; three probes across the city is plenty and keeps
  // the payload small.
  const riverProbes: LatLng[] = [grid[0], grid[Math.floor(grid.length / 2)], grid[grid.length - 1]];

  const [weather, antecedent, river, reports] = await Promise.all([
    fetchWeatherField(grid, scenario, now),
    fetchAntecedentField(grid, monthlyNormal, scenario, now),
    fetchRiverField(riverProbes, now),
    buildReportField(graph.city.id, now),
  ]);

  const peakRain = Math.max(0, ...weather.cells.map((c) => c.peakIntensityMmHr));

  const traffic = buildTrafficField(
    graph.allSegments().map((s) => ({
      id: s.id,
      roadClass: s.roadClass,
      lanes: s.lanes,
      speedLimitKph: s.speedLimitKph,
    })),
    now,
    peakRain,
    tzOffsetMinutes(graph.city.timezone, now),
  );

  const provenances: SignalProvenance[] = [
    weather.provenance,
    antecedent.provenance,
    river.provenance,
    traffic.provenance,
    reports.provenance,
  ];

  return {
    cityId: graph.city.id,
    now,
    weather,
    antecedent,
    elevation: null,
    river,
    traffic,
    reports,
    provenances,
    degraded: provenances.some((p) => !p.live && p.kind !== "seeded"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Spatial sampling                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Sample the rainfall field at a point.
 *
 * The whole curve is interpolated, not just the headline number, because
 * "when does this road flood" depends on the shape of the storm at *that* road,
 * not at the city centroid.
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

/** River influence, weighted by how close the nearest modelled reach is. */
export function sampleRiver(bundle: SignalBundle, at: LatLng): number {
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
