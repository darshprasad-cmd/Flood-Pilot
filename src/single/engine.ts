/**
 * The single file's only door onto the real engine.
 *
 * Everything under `@/lib` is imported here and nowhere else in `src/single`.
 * The rendering modules — map.ts and panels.ts — see only the plain view models
 * declared below: arrays of numbers, strings and `[lat, lng]` pairs, with no
 * `CityGraph`, no `HazardPrediction` and no `RouteComparison` in sight.
 *
 * That boundary is the point. It keeps the shared engine free to change its
 * internals without touching four files, and it makes the one rule this build
 * exists to enforce checkable in one place: no second implementation. If a
 * number is computed here it is computed by the same code the deployed app
 * runs. Nothing in this module models anything.
 *
 * ── Two disciplines this module is responsible for ──────────────────────
 *
 * 1. Nothing undefined reaches a formatter. Every number crossing this
 *    boundary has been through `num()`, every string through `text()`, so a
 *    renderer can never print "NaN cm" or "undefined min". Where a quantity is
 *    genuinely absent, it crosses as a *tagged state* rather than as a number a
 *    caller has to remember to special-case: `OnsetView` says "already" instead
 *    of `0`, `RecoveryView` picks its own unit instead of rounding 20 minutes
 *    down to "0 hr".
 *
 * 2. Nothing said here can be false. Numbers that get rendered side by side are
 *    rounded here, once, so the prose and the cards cannot disagree by a minute.
 *    Comparative claims cross as a `TradeView` — a tagged reason plus the exact
 *    figures that justify it — because the safer route legitimately can have a
 *    higher peak depth (Safe Route Score weighs underpasses and arrival timing
 *    too), and a renderer left to pick its own sentence will eventually claim
 *    "8 minutes more to avoid 0 cm of water".
 *
 * Interface (owned by this module):
 *
 *   CITY                    the city this build ships
 *   getCityView()           map centre and bounds
 *   listScenarios()         rainfall scenarios, for the header select
 *   listPlaces()            junctions, sorted, for from/to
 *   listVehicles()          the vehicle catalogue, popular-first
 *   loadConditions(id)      run the engine → Conditions
 *   getRoadDetail(c, id)    the full explainable sheet for one road
 *   comparePlans(c, inputs) route two ways over those conditions → JourneyView
 *   runBrief(id, inputs)    the whole agent chain → BriefView (the Today answer)
 *
 * View models: CityView, RoadView, RoadDetailView, SummaryView, Conditions,
 * ProvenanceView, ForecastView, GaugeView, JourneyInputs, RouteView,
 * JourneyView, TradeView, SurvivabilityView, BriefView.
 */

import { runJourneyBrief, type JourneyContext } from "@/lib/agents/orchestrator";
import { summarise, summariseForecast } from "@/lib/api/serialize";
import { RISK_META } from "@/lib/core/risk";
import { clockAt } from "@/lib/core/time";
import {
  ACTION_THRESHOLD_CM,
  IMPASSABLE_CM,
  runFloodEngine,
  type EngineResult,
} from "@/lib/engine";
import { getCityGraph } from "@/lib/graph";
import { planRoutes } from "@/lib/routing/safe-route";
import { resolveScenario, SCENARIOS } from "@/lib/signals/scenarios";
import { VEHICLE_CATALOG } from "@/lib/vehicles/catalog";
import { BAND_META, buildVehicleProfile } from "@/lib/vehicles/survivability";
import type { SurvivabilityAssessment, VehicleProfile } from "@/lib/vehicles/types";
import type { OsmDrainageLayer } from "@/lib/signals/providers/osm";
import type { RouteComparison, RouteLeg, RouteResult } from "@/lib/routing/types";

/* ── Browser shims ────────────────────────────────────────────────────── */

declare global {
  interface Window {
    __DISHA_OSM__?: OsmDrainageLayer;
  }
}

const globalRef = globalThis as typeof globalThis & {
  __floodpilotOsm?: Map<string, OsmDrainageLayer | null>;
};

// `process` itself is stubbed by the build's banner, which lands above module
// initialisation — too early to do from here.

// Seed the drainage cache before anything can ask for it. This module is the
// first of the single-file modules to initialise, because it is the only one
// that imports the engine, so the cache is populated before any engine code
// can reach the loader.
if (typeof window !== "undefined" && window.__DISHA_OSM__) {
  globalRef.__floodpilotOsm = new Map([["delhi", window.__DISHA_OSM__]]);
}

export const CITY = "delhi";

/* ── Guards ───────────────────────────────────────────────────────────── */

/**
 * Every number that crosses this boundary goes through here.
 *
 * The engine's own arithmetic is sound, but a division by an empty set or a
 * provider returning nothing is one `NaN` away from "NaN cm of water", which
 * reads as a broken product rather than as missing data. A defined fallback is
 * always better than a formatted `undefined`.
 */
const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** The same contract for strings: never an empty label, never "undefined". */
const text = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const int = (value: unknown, fallback = 0): number => Math.round(num(value, fallback));
const round1 = (value: unknown, fallback = 0): number =>
  Math.round(num(value, fallback) * 10) / 10;
const clamp01 = (value: unknown): number => Math.min(1, Math.max(0, num(value, 0)));

/* ── Quantities that have an absent case ──────────────────────────────── */

/**
 * When water arrives.
 *
 * The engine reports minutes-to-onset as a number where `0` means "the water is
 * already there". Rendered as a countdown that is a lie — most of the city reads
 * "0 min" during a cloudburst, which looks like a stopped clock rather than a
 * road that is under water now. Tagging the three cases makes that unrenderable.
 */
export type OnsetView =
  | { kind: "already" }
  | { kind: "in"; minutes: number }
  | { kind: "none" };

const onsetOf = (minutes: number | null | undefined): OnsetView => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return { kind: "none" };
  }
  // Under a minute is not a warning time; it is water on the road.
  return minutes < 1 ? { kind: "already" } : { kind: "in", minutes: Math.round(minutes) };
};

/**
 * How long a road takes to drain.
 *
 * Carries its own unit because the alternative — convert to hours, round — turns
 * every recovery under half an hour into "0 hr", which says "no delay" about a
 * road that is impassable right now.
 */
export type RecoveryView =
  | { kind: "none" }
  | { kind: "minutes"; minutes: number }
  | { kind: "hours"; hours: number };

const recoveryOf = (minutes: number | null | undefined): RecoveryView => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return { kind: "none" };
  }
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return { kind: "none" };
  // Below 90 minutes an hours figure rounds away more than it communicates.
  return m < 90 ? { kind: "minutes", minutes: m } : { kind: "hours", hours: Math.round(m / 60) };
};

/* ── View models ──────────────────────────────────────────────────────── */

export interface CityView {
  center: [number, number];
  /** South-west and north-east corners, ready for Leaflet's fitBounds. */
  bounds: [[number, number], [number, number]];
}

/**
 * One road, flattened.
 *
 * Carries both what the map needs to draw it and what the panel needs to
 * explain it, because a click on the map has to reach the panel and neither
 * module should have to go back to the engine to complete the round trip.
 *
 * Deliberately scalar. The explainable sheet — curves, drivers, drainage — is
 * an order of magnitude larger and is built on demand by `getRoadDetail`, so
 * the 120 roads the map holds at once stay cheap.
 */
export interface RoadView {
  id: string;
  name: string;
  corridor: string;
  /** Leaflet-ready [lat, lng] pairs. */
  path: [number, number][];
  /** Colour from the shared risk ramp — the same table the Next app paints. */
  color: string;
  /** Risk band id and its label, so a legend can name what the colour means. */
  riskLevel: string;
  riskLabel: string;
  isUnderpass: boolean;
  /**
   * True on exactly the roads the summary counts as "at risk".
   *
   * The map used to pick its own threshold for which roads to emphasise, which
   * disagreed with the stat card beside it by ten roads. One definition, decided
   * by the shared summariser, exported so both surfaces read it.
   */
  atRisk: boolean;
  /** The vehicle-agnostic case: water deeper than an ordinary car can cross. */
  impassable: boolean;
  /** 0..1. */
  floodProbability: number;
  depthNowCm: number;
  peakDepthCm: number;
  onset: OnsetView;
  recovery: RecoveryView;
  /** Raw engine values, kept for callers that do their own arithmetic. */
  timeToFloodMin: number | null;
  recoveryMin: number | null;
  elevationM: number;
  /** 0..1, with the band the engine puts it in. */
  confidence: number;
  confidenceLabel: string;
  blockages: BlockageView[];
}

export interface BlockageView {
  label: string;
  basis: string;
  /** 0..1. */
  likelihood: number;
  consequence: string;
}

/**
 * The explainable sheet for one road.
 *
 * Everything here is already on the engine's prediction — the depth curve it
 * integrated, the drivers it attributed, the limitations it recorded against its
 * own confidence. None of it is recomputed; it was simply being thrown away.
 */
export interface RoadDetailView extends RoadView {
  /** The modelled depth series, with the rainfall driving it at each step. */
  curve: { minutesFromNow: number; depthCm: number; forcingMmHr: number }[];
  /** 8 cm and 30 cm: where a low car starts to struggle, and where it stops. */
  actionCm: number;
  impassableCm: number;
  peak: OnsetView;
  /** Why the model says what it says, strongest first. */
  why: { text: string; impact: string; evidence: { label: string; value: string }[] }[];
  /** What the model weighted, as feature attributions. */
  drivers: { label: string; value: number; unit: string; share: number; direction: string }[];
  /** Stated whenever confidence is not high — the engine's own words. */
  limitations: string[];
  infrastructure: {
    roadClass: string;
    lanes: number;
    slopePct: number;
    /** Drain capacity as a percentage of design, after siltation. */
    drainCapacityPct: number;
    distToDrainM: number;
    majorDrain: { name: string; kind: string; distanceM: number; siltationPct: number } | null;
    /** 0..100 — how much a high Yamuna stage raises water here regardless of rain. */
    floodplainExposurePct: number;
    basementParking: number;
    pumpStations: number;
    peopleExposed: number;
    /** Set when this road is in the city's recurring-waterlogging register. */
    hotspot: { name: string; note: string } | null;
    floodHistoryCount: number;
  };
}

/**
 * City conditions.
 *
 * Every figure comes from the shared `summarise()`, which is also what the
 * deployed dashboard reads — the three-number version this file used to compute
 * for itself disagreed with it, which is exactly the second implementation the
 * header forbids.
 */
export interface SummaryView {
  roadsAtRisk: number;
  impassable: number;
  deepestCm: number;
  /** 0..1. */
  peakProbability: number;
  meanConfidence: number;
  peopleExposed: number;
  underpassesAtRisk: number;
  hotspotsActive: number;
  /** The soonest onset anywhere in the city. */
  nextOnset: OnsetView;
  worstRoad: { id: string; name: string; depthCm: number } | null;
}

/**
 * Where the numbers came from.
 *
 * The status line used to read "Running on open data" whether or not anything
 * had answered, because the engine's `degraded` flag is true in this build by
 * design: IMD and CWC are never configured here. A file opened with no network
 * showed materially different water under a byte-identical claim of provenance.
 */
export interface ProvenanceView {
  /**
   * "live" — every source that could answer did.
   * "partial" — some answered, the rest fell back to the model.
   * "modelled" — nothing reached the network; every figure is simulated.
   */
  kind: "live" | "partial" | "modelled";
  liveCount: number;
  totalCount: number;
  /** True when the rainfall forecast itself came off the network. */
  rainfallLive: boolean;
  /** True when the chosen scenario replaces observed rainfall with a storm. */
  simulatedRainfall: boolean;
  /** Who was asked, who answered, and what they said — the audit list. */
  sources: { signal: string; providerName: string; used: boolean; detail: string }[];
  signals: { kind: string; source: string; live: boolean; reliability: number; note: string }[];
}

/**
 * The next twelve hours: the rain, and what the model makes of it.
 *
 * Straight from `summariseForecast`, which takes the peak off the raw curves
 * rather than off the sampled points — an hourly grid steps over a crest, and a
 * headline that disagrees with the per-road numbers on the same screen is worse
 * than no headline.
 */
export interface ForecastView {
  issuedAtClock: string;
  rain: {
    minutesFromNow: number;
    clock: string;
    mmPerHr: number;
    peakMmPerHr: number;
    /** 0..1. */
    probability: number;
  }[];
  peakMmPerHr: number;
  peakIn: OnsetView;
  peakClock: string | null;
  eventTotalMm: number;
  /** The two lines worth drawing across the depth chart. */
  actionCm: number;
  impassableCm: number;
  model: {
    /** 0..1. */
    confidence: number;
    peakDepthCm: number;
    peakIn: OnsetView;
    peakClock: string | null;
    curve: {
      minutesFromNow: number;
      clock: string;
      maxDepthCm: number;
      meanDepthCm: number;
      roadsAtRisk: number;
      roadsImpassable: number;
    }[];
  } | null;
}

export interface GaugeView {
  station: string;
  river: string;
  levelM: number;
  dangerLevelM: number;
  warningLevelM: number;
  /** Change over the last 24 hours, in metres. */
  trendM24h: number;
  status: string;
  /** True when the level is at or past the warning mark. */
  elevated: boolean;
  forecastPeakM: number | null;
  forecastPeakInHr: number | null;
  live: boolean;
}

/**
 * One engine pass, serialised.
 *
 * `source` is the raw result, kept only so `comparePlans` can hand the engine's
 * own predictions back to the router without a second run, and so
 * `getRoadDetail` can reach one road's prediction on click. Rendering modules
 * must not read it; if they need something from it, it belongs in a view model.
 */
export interface Conditions {
  scenarioId: string;
  scenarioLabel: string;
  /** True for the four modelled storms; false only for the live forecast. */
  simulated: boolean;
  scenarioBlurb: string;
  /** True when one or more signal providers fell back to modelled values. */
  degraded: boolean;
  computedAt: string;
  /** Delhi wall-clock time of this pass — a stale figure looks like a fresh one. */
  computedAtClock: string;
  roads: RoadView[];
  summary: SummaryView;
  provenance: ProvenanceView;
  forecast: ForecastView;
  gauges: GaugeView[];
  readonly source: EngineResult;
}

export interface JourneyInputs {
  fromId: string;
  toId: string;
  vehicleId: string;
}

/**
 * One route.
 *
 * `durationMin` and `maxDepthCm` are whole numbers *here* rather than at the
 * point of rendering, because two surfaces render them: the card, and the
 * sentence underneath it. Rounding independently produced cards reading 61 and
 * 62 minutes above a sentence claiming "0 minutes more".
 */
export interface RouteView {
  durationMin: number;
  maxDepthCm: number;
  underpassCount: number;
  impassableCount: number;
  /** 0..100, the engine's Safe Route Score. Higher is safer. */
  safeRouteScore: number;
  riskLevel: string;
  riskLabel: string;
  distanceKm: number;
  arrivesInMin: number;
  /** The single leg that decides this route's risk. */
  worstLeg: {
    name: string;
    depthCm: number;
    /** 0..1. */
    probability: number;
    entersInMin: number;
    isUnderpass: boolean;
  } | null;
  /** The engine's own account of this route, strongest first. */
  explanations: string[];
  /** Legs stitched into one [lat, lng] line. */
  path: [number, number][];
}

/**
 * Why the recommended route is the recommended one.
 *
 * A tagged reason rather than a sentence, so copy stays in i18n — but the
 * *choice* of reason is made here, once, because it is a claim about the world
 * and not a presentation decision. Every number is already rounded to what the
 * cards display, so no branch can produce a figure the cards contradict.
 */
export type TradeView =
  /** Same roads both ways, and they are passable. */
  | { kind: "same-route" }
  /** Same roads both ways, and they are not passable in this vehicle. */
  | { kind: "same-route-blocked"; depthCm: number; worstRoad: string | null }
  /** No route this vehicle can make. This is the least dangerous one. */
  | { kind: "no-safe-route"; depthCm: number; impassableCount: number }
  /** The fast route is impassable in this vehicle; the recommended one is not. */
  | { kind: "avoids-impassable"; extraMinutes: number; count: number }
  | { kind: "avoids-underpasses"; extraMinutes: number; count: number }
  | { kind: "avoids-water"; extraMinutes: number; depthCm: number }
  /** Lower flood probability, in percentage points, with nothing sharper to say. */
  | { kind: "lower-risk"; extraMinutes: number; points: number }
  /** Nothing measurable separates them. Saying so beats inventing a benefit. */
  | { kind: "no-measurable-gain"; extraMinutes: number };

export interface SurvivabilityView {
  band: "safe" | "borderline" | "unsafe";
  label: string;
  color: string;
  blurb: string;
  /** 0..100. */
  score: number;
  againstDepthCm: number;
  maxSafeWadeCm: number;
  /** The number that actually decides it — water above here destroys the engine. */
  intakeHeightCm: number;
  flowWarning: string | null;
  reasons: { text: string; impact: string }[];
}

export interface JourneyView {
  fastest: RouteView;
  safest: RouteView;
  /** The risk-aware search picked the same roads as the time-only one. */
  identical: boolean;
  /** False when even the best route crosses water this vehicle cannot handle. */
  safeRouteExists: boolean;
  /** Consistent with the cards: the difference of the two rounded durations. */
  extraMinutes: number;
  /** Percentage points of flood probability, whole numbers. */
  riskReduction: number;
  /** Difference of the two rounded depths, in cm. Can be negative. */
  depthReduction: number;
  underpassesAvoided: number;
  trade: TradeView;
  /** How this vehicle rates against the deepest water on the safe route. */
  survivability: SurvivabilityView | null;
  /** The engine's own comparison copy, strongest first. */
  explanations: string[];
}

/* ── The Today answer ─────────────────────────────────────────────────── */

/**
 * Four verdicts, mapped from the decision agent's chosen action.
 *
 * The agent picks among eight actions; a person opening the file wants to know
 * which of four things is true before reading any of them.
 */
export type Verdict = "go" | "caution" | "wait" | "stay";

export interface AnswerView {
  verdict: Verdict;
  action: string;
  label: string;
  headline: string;
  etaMin: number | null;
  riskLevel: string;
  reasons: string[];
  alternatives: { action: string; label: string; headline: string; etaMin: number | null }[];
  /** Advice that stands regardless of how the journey is made — move the car. */
  parallel: { action: string; label: string; headline: string; reasons: string[] }[];
  emergencyContacts: { name: string; authority: string; phone: string[] }[];
}

/**
 * How long there is.
 *
 * `openThroughout` exists so the panel can say "no rush" honestly. A window that
 * never closes and a window whose closing time is unknown are different answers,
 * and collapsing them into a missing clock reads as the second.
 */
export interface WindowView {
  closesInMin: number | null;
  closesAtClock: string | null;
  leaveByInMin: number | null;
  leaveByClock: string | null;
  /** True when no departure in the next four hours works. */
  noSafeWindow: boolean;
  /** True when the route holds across the whole forecast. */
  openThroughout: boolean;
}

export interface BriefView {
  answer: AnswerView;
  window: WindowView;
  survivability: SurvivabilityView | null;
  journey: JourneyView | null;
  alerts: { id: string; kind: string; severity: string; title: string; body: string; actionLabel: string | null }[];
  timeline: {
    minutesFromNow: number;
    clock: string;
    title: string;
    detail: string;
    kind: string;
    severity: string;
  }[];
  /** Which agent produced which part, and how sure it was. */
  trace: {
    agent: string;
    name: string;
    latencyMs: number;
    confidence: number;
    confidenceLabel: string;
    degraded: boolean;
    note: string;
  }[];
  computedAtClock: string;
}

/* ── Static catalogues ────────────────────────────────────────────────── */

export function getCityView(): CityView {
  const { city } = getCityGraph(CITY);
  return {
    center: [num(city.center.lat), num(city.center.lng)],
    bounds: [
      [num(city.bounds[0]), num(city.bounds[1])],
      [num(city.bounds[2]), num(city.bounds[3])],
    ],
  };
}

/**
 * The rainfall scenarios.
 *
 * `simulated` and `blurb` come along because a modelled cloudburst and the live
 * forecast are otherwise indistinguishable in the select, which is a
 * truthfulness problem rather than a decorative one.
 */
export function listScenarios(): {
  id: string;
  label: string;
  simulated: boolean;
  blurb: string;
}[] {
  return Object.values(SCENARIOS).map((scenario) => ({
    id: scenario.id,
    label: text(scenario.label, scenario.id),
    simulated: scenario.simulated === true,
    blurb: text(scenario.blurb, ""),
  }));
}

export function listPlaces(): { id: string; name: string }[] {
  return [...getCityGraph(CITY).allNodes()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((node) => ({ id: node.id, name: text(node.name, node.id) }));
}

/** Popular-in-Delhi vehicles first; `sort` is stable, so catalogue order holds. */
export function listVehicles(): {
  id: string;
  manufacturer: string;
  model: string;
  groundClearanceMm: number;
}[] {
  return [...VEHICLE_CATALOG]
    .sort((a, b) => (b.popularInDelhi ? 1 : 0) - (a.popularInDelhi ? 1 : 0))
    .map((vehicle) => ({
      id: vehicle.id,
      manufacturer: text(vehicle.manufacturer, ""),
      model: text(vehicle.model, vehicle.id),
      groundClearanceMm: int(vehicle.groundClearanceMm),
    }));
}

/* ── One engine pass ──────────────────────────────────────────────────── */

export async function loadConditions(scenarioId: string): Promise<Conditions> {
  const scenario = resolveScenario(scenarioId);
  const result = await runFloodEngine(CITY, scenario);
  const meta = SCENARIOS[scenario];

  const tz = result.graph.city.timezone;
  const computedAt = new Date(result.computedAt);
  const stampedAt = Number.isFinite(computedAt.getTime()) ? computedAt : new Date();

  const summary = summarise(result);

  const roads: RoadView[] = [];
  for (const state of result.states) {
    const segment = result.graph.getSegment(state.segmentId);
    if (!segment) continue;

    const risk = RISK_META[state.riskLevel] ?? RISK_META.safe;

    roads.push({
      id: state.segmentId,
      name: text(segment.name, state.segmentId),
      corridor: text(segment.corridor, ""),
      path: segment.geometry.map((point) => [num(point.lat), num(point.lng)]),
      color: risk.color,
      riskLevel: state.riskLevel,
      riskLabel: risk.label,
      isUnderpass: segment.isUnderpass === true,
      // The identical test `summarise` applies, so the map's emphasis and the
      // stat card beside it cannot disagree about which roads are at risk.
      atRisk:
        num(state.peakDepthCm) >= ACTION_THRESHOLD_CM &&
        num(state.floodProbability) >= 0.35,
      impassable: state.timeToImpassableMin !== null,
      floodProbability: clamp01(state.floodProbability),
      depthNowCm: round1(state.depthCm),
      peakDepthCm: round1(state.peakDepthCm),
      onset: onsetOf(state.timeToFloodMin),
      recovery: recoveryOf(state.recoveryMin),
      timeToFloodMin: state.timeToFloodMin,
      recoveryMin: state.recoveryMin,
      elevationM: round1(segment.elevationM),
      confidence: clamp01(state.confidence),
      confidenceLabel: text(state.confidenceBand, "moderate"),
      blockages: state.blockages.map((blockage) => ({
        label: text(blockage.label, ""),
        basis: text(blockage.basis, ""),
        likelihood: clamp01(blockage.likelihood),
        consequence: text(blockage.consequence, ""),
      })),
    });
  }

  const forecast = summariseForecast(result.bundle.weather, result.predictions.values());
  const clock = (minutes: number) => clockAt(stampedAt, tz, num(minutes));

  return {
    scenarioId: scenario,
    scenarioLabel: text(meta?.label, scenario),
    simulated: meta?.simulated === true,
    scenarioBlurb: text(meta?.blurb, ""),
    degraded: result.bundle.degraded === true,
    computedAt: result.computedAt,
    computedAtClock: clock(0),
    roads,
    summary: {
      roadsAtRisk: int(summary.segmentsAtRisk),
      impassable: int(summary.segmentsImpassable),
      deepestCm: round1(summary.peakDepthCm),
      peakProbability: clamp01(summary.peakProbability),
      meanConfidence: clamp01(summary.meanConfidence),
      peopleExposed: int(summary.peopleExposed),
      underpassesAtRisk: int(summary.underpassesAtRisk),
      hotspotsActive: int(summary.hotspotsActive),
      nextOnset: onsetOf(summary.nextOnsetMin),
      worstRoad: summary.worstSegment
        ? {
            id: summary.worstSegment.id,
            name: text(summary.worstSegment.name, summary.worstSegment.id),
            depthCm: round1(summary.worstSegment.depthCm),
          }
        : null,
    },
    provenance: provenanceOf(result, meta?.simulated === true),
    forecast: {
      issuedAtClock: clock(0),
      rain: forecast.rain.map((point) => ({
        minutesFromNow: int(point.minutesFromNow),
        clock: clock(point.minutesFromNow),
        mmPerHr: round1(point.mmPerHr),
        peakMmPerHr: round1(point.peakMmPerHr),
        probability: clamp01(point.probability),
      })),
      peakMmPerHr: round1(forecast.peakMmPerHr),
      peakIn: onsetOf(forecast.peakInMin),
      peakClock: forecast.peakInMin === null ? null : clock(forecast.peakInMin),
      eventTotalMm: round1(forecast.eventTotalMm),
      actionCm: ACTION_THRESHOLD_CM,
      impassableCm: IMPASSABLE_CM,
      model: forecast.model
        ? {
            confidence: clamp01(forecast.model.confidence),
            peakDepthCm: round1(forecast.model.peakDepthCm),
            peakIn: onsetOf(forecast.model.peakAtMin),
            peakClock:
              forecast.model.peakAtMin === null ? null : clock(forecast.model.peakAtMin),
            curve: forecast.model.curve.map((point) => ({
              minutesFromNow: int(point.minutesFromNow),
              clock: clock(point.minutesFromNow),
              maxDepthCm: round1(point.maxDepthCm),
              meanDepthCm: round1(point.meanDepthCm),
              roadsAtRisk: int(point.roadsAtRisk),
              roadsImpassable: int(point.roadsImpassable),
            })),
          }
        : null,
    },
    gauges: result.bundle.gauges.map((gauge) => ({
      station: text(gauge.station.name, gauge.station.id),
      river: text(gauge.station.river, ""),
      levelM: round1(gauge.levelM),
      dangerLevelM: round1(gauge.station.dangerLevelM),
      warningLevelM: round1(gauge.station.warningLevelM),
      trendM24h: round1(gauge.trendM24h),
      status: text(gauge.status, "normal"),
      elevated: gauge.status !== "normal",
      forecastPeakM: gauge.forecastPeakM === null ? null : round1(gauge.forecastPeakM),
      forecastPeakInHr:
        gauge.forecastPeakInHr === null ? null : round1(gauge.forecastPeakInHr),
      live: gauge.live === true,
    })),
    source: result,
  };
}

/**
 * What actually answered this pass.
 *
 * `bundle.degraded` is not the question a status line should ask: it is true
 * whenever any provider is not live and not seeded, which in this build means
 * always, because IMD and CWC need keys nobody has here. The useful distinction
 * is whether the network answered at all — that is what changes the numbers.
 */
function provenanceOf(result: EngineResult, simulatedRainfall: boolean): ProvenanceView {
  const provenances = result.bundle.provenances ?? [];

  // Seeded datasets ship inside the file, so they are neither live nor a
  // failure; counting them either way would misreport the network's state.
  const networked = provenances.filter((p) => p.kind !== "seeded");
  const liveCount = networked.filter((p) => p.live).length;
  const rainfall = provenances.find((p) => p.kind === "forecast" || p.kind === "measured");

  return {
    kind:
      networked.length > 0 && liveCount === networked.length
        ? "live"
        : liveCount > 0
          ? "partial"
          : "modelled",
    liveCount,
    totalCount: networked.length,
    rainfallLive: rainfall?.live === true,
    simulatedRainfall,
    sources: (result.bundle.sources ?? []).map((source) => ({
      signal: text(source.signal, ""),
      providerName: text(source.providerName, text(source.provider, "")),
      used: source.used === true,
      detail: text(source.detail, ""),
    })),
    signals: provenances.map((p) => ({
      kind: text(p.kind, "modelled"),
      source: text(p.source, ""),
      live: p.live === true,
      reliability: clamp01(p.reliability),
      note: text(p.note, ""),
    })),
  };
}

/* ── One road, fully explained ────────────────────────────────────────── */

/**
 * The road-detail sheet.
 *
 * Built on click rather than for all 120 roads at once: the depth curve alone is
 * larger than everything else in `RoadView` put together, and the sheet only
 * ever shows one road.
 */
export function getRoadDetail(
  conditions: Conditions,
  roadId: string,
): RoadDetailView | null {
  const road = conditions.roads.find((r) => r.id === roadId);
  if (!road) return null;

  const result = conditions.source;
  const segment = result.graph.getSegment(roadId);
  const prediction = result.predictions.get(roadId);
  if (!segment) return null;

  return {
    ...road,
    curve: (prediction?.onsetCurve ?? []).map((point) => ({
      minutesFromNow: int(point.minutesFromNow),
      depthCm: round1(point.value),
      forcingMmHr: round1(point.forcing),
    })),
    actionCm: ACTION_THRESHOLD_CM,
    impassableCm: IMPASSABLE_CM,
    peak: onsetOf(prediction?.peakAtMin ?? null),
    why: (prediction?.explanations ?? []).map((explanation) => ({
      text: text(explanation.text, ""),
      impact: text(explanation.impact, "neutral"),
      evidence: (explanation.evidence ?? []).map((item) => ({
        label: text(item.label, ""),
        value: text(item.value, ""),
      })),
    })),
    drivers: (prediction?.drivers ?? []).slice(0, 6).map((driver) => ({
      label: text(driver.label, driver.feature),
      value: round1(driver.value),
      unit: text(driver.unit, ""),
      share: clamp01(driver.share),
      direction: text(driver.direction, "raises"),
    })),
    limitations: (prediction?.confidence.limitations ?? []).map((line) => text(line, "")),
    infrastructure: {
      roadClass: text(segment.roadClass, ""),
      lanes: int(segment.lanes),
      slopePct: round1(segment.slopePct),
      drainCapacityPct: Math.round(clamp01(segment.drainCapacityIndex) * 100),
      distToDrainM: int(segment.distToDrainM),
      majorDrain: segment.majorDrain
        ? {
            name: text(segment.majorDrain.name, segment.majorDrain.id),
            kind: text(segment.majorDrain.kind, ""),
            distanceM: int(segment.majorDrain.distanceM),
            siltationPct: Math.round(clamp01(segment.majorDrain.siltationIndex) * 100),
          }
        : null,
      floodplainExposurePct: Math.round(clamp01(segment.floodplainExposure) * 100),
      basementParking: int(segment.basementParking),
      pumpStations: int(segment.pumpStations),
      peopleExposed: int(segment.populationExposure),
      hotspot: segment.hotspot
        ? {
            name: text(segment.hotspot.name, ""),
            note: text(segment.hotspot.note, ""),
          }
        : null,
      floodHistoryCount: segment.floodHistory?.length ?? 0,
    },
  };
}

/* ── Routing ──────────────────────────────────────────────────────────── */

/**
 * Stitch legs into one polyline.
 *
 * Consecutive legs share their junction, so every leg after the first drops its
 * opening point to avoid a duplicated vertex.
 */
const pathOf = (legs: RouteLeg[]): [number, number][] =>
  legs.flatMap((leg, i) =>
    (i ? leg.geometry.slice(1) : leg.geometry).map(
      (point) => [num(point.lat), num(point.lng)] as [number, number],
    ),
  );

/**
 * A catalogue id becomes a full profile.
 *
 * Year and tyre condition are not asked for in this build, so the profile uses
 * the catalogue's own defaults; the survivability model reads both.
 */
function profileFor(vehicleId: string): VehicleProfile | null {
  const entry = VEHICLE_CATALOG.find((v) => v.id === vehicleId) ?? null;
  if (!entry) return null;
  return buildVehicleProfile({
    id: entry.id,
    manufacturer: entry.manufacturer,
    model: entry.model,
    year: 2021,
    bodyType: entry.bodyType,
    groundClearanceMm: entry.groundClearanceMm,
    tyreType: "standard",
    driveType: entry.driveType,
    fuelType: entry.fuelTypes[0],
  });
}

const serialiseRoute = (route: RouteResult): RouteView => {
  const risk = RISK_META[route.riskLevel] ?? RISK_META.safe;
  return {
    durationMin: int(route.durationMin),
    maxDepthCm: int(route.maxDepthCm),
    underpassCount: int(route.underpassCount),
    impassableCount: int(route.impassableCount),
    safeRouteScore: int(route.safeRouteScore),
    riskLevel: route.riskLevel,
    riskLabel: risk.label,
    distanceKm: round1(num(route.distanceM) / 1000),
    arrivesInMin: int(route.arrivesInMin),
    worstLeg: route.worstLeg
      ? {
          name: text(route.worstLeg.name, ""),
          depthCm: int(route.worstLeg.depthOnArrivalCm),
          probability: clamp01(route.worstLeg.floodProbability),
          entersInMin: int(route.worstLeg.entersAtMin),
          isUnderpass: route.worstLeg.isUnderpass === true,
        }
      : null,
    explanations: route.explanations.map((e) => text(e.text, "")).filter(Boolean),
    path: pathOf(route.legs),
  };
};

const serialiseSurvivability = (
  assessment: SurvivabilityAssessment | null,
): SurvivabilityView | null => {
  if (!assessment) return null;
  const meta = BAND_META[assessment.band] ?? BAND_META.borderline;
  return {
    band: assessment.band,
    label: meta.label,
    color: meta.color,
    blurb: meta.blurb,
    score: int(assessment.score),
    againstDepthCm: int(assessment.againstDepthCm),
    maxSafeWadeCm: round1(assessment.maxSafeWadeCm),
    intakeHeightCm: round1(assessment.intakeHeightCm),
    flowWarning: assessment.flowWarning ?? null,
    reasons: assessment.reasons.map((reason) => ({
      text: text(reason.text, ""),
      impact: text(reason.impact, "neutral"),
    })),
  };
};

/**
 * A depth difference the model is entitled to claim.
 *
 * Below this the two routes are the same route as far as water is concerned:
 * one centimetre is well inside the hazard model's own error, and "29 minutes
 * more to avoid 1 cm of water" is an absurd trade to offer somebody — doubly so
 * when the real reason, an underpass avoided, was sitting in the next branch.
 */
const MEANINGFUL_DEPTH_CM = 3;

/** Percentage points of flood probability worth putting in a sentence. */
const MEANINGFUL_RISK_POINTS = 5;

/**
 * Choose the claim.
 *
 * Ordered by how defensible each statement is, not by how good it sounds. The
 * impassable cases come first because they are the only ones where the
 * recommendation is "this is the least bad option" rather than "this is safe",
 * and every previous version of this file got that case wrong: it sold a route
 * that was slower, deeper and crossed more underpasses as "measurably
 * lower-risk", because it never asked whether the route was passable at all.
 */
function tradeOf(
  fastest: RouteView,
  safest: RouteView,
  identical: boolean,
  riskReduction: number,
): TradeView {
  const extraMinutes = Math.max(0, safest.durationMin - fastest.durationMin);
  const depthCm = fastest.maxDepthCm - safest.maxDepthCm;
  const underpasses = fastest.underpassCount - safest.underpassCount;

  if (identical) {
    return safest.impassableCount > 0
      ? {
          kind: "same-route-blocked",
          depthCm: safest.maxDepthCm,
          worstRoad: safest.worstLeg?.name ?? null,
        }
      : { kind: "same-route" };
  }

  if (safest.impassableCount > 0) {
    return {
      kind: "no-safe-route",
      depthCm: safest.maxDepthCm,
      impassableCount: safest.impassableCount,
    };
  }

  if (fastest.impassableCount > 0) {
    return { kind: "avoids-impassable", extraMinutes, count: fastest.impassableCount };
  }

  if (underpasses > 0 && depthCm < MEANINGFUL_DEPTH_CM) {
    return { kind: "avoids-underpasses", extraMinutes, count: underpasses };
  }

  if (depthCm >= MEANINGFUL_DEPTH_CM) {
    return { kind: "avoids-water", extraMinutes, depthCm };
  }

  if (riskReduction >= MEANINGFUL_RISK_POINTS) {
    return { kind: "lower-risk", extraMinutes, points: riskReduction };
  }

  return { kind: "no-measurable-gain", extraMinutes };
}

function serialiseComparison(comparison: RouteComparison): JourneyView {
  const fastest = serialiseRoute(comparison.fastest);
  const safest = serialiseRoute(comparison.safest);

  // Derived from the rounded figures rather than from the engine's floats, so
  // the sentence and the cards above it are arithmetically consistent.
  const extraMinutes = safest.durationMin - fastest.durationMin;
  const depthReduction = fastest.maxDepthCm - safest.maxDepthCm;
  const riskReduction = int(comparison.riskReduction);

  return {
    fastest,
    safest,
    identical: comparison.identical === true,
    safeRouteExists: comparison.safeRouteExists === true,
    extraMinutes,
    riskReduction,
    depthReduction,
    underpassesAvoided: Math.max(0, fastest.underpassCount - safest.underpassCount),
    trade: tradeOf(fastest, safest, comparison.identical === true, riskReduction),
    survivability: serialiseSurvivability(comparison.safest.survivability),
    explanations: comparison.explanations.map((e) => text(e.text, "")).filter(Boolean),
  };
}

/**
 * Route the journey twice — once for time, once for risk — and serialise both.
 *
 * Returns null when no path exists between the two junctions at all, which the
 * panel reports differently from "the only path is dangerous".
 */
export function comparePlans(
  conditions: Conditions,
  inputs: JourneyInputs,
): JourneyView | null {
  const comparison = planRoutes(getCityGraph(CITY), conditions.source.predictions, {
    cityId: CITY,
    originNodeId: inputs.fromId,
    destinationNodeId: inputs.toId,
    vehicle: profileFor(inputs.vehicleId),
    departInMin: 0,
  });

  return comparison ? serialiseComparison(comparison) : null;
}

/* ── The whole answer ─────────────────────────────────────────────────── */

/**
 * Defaults for the journey context.
 *
 * The single file has no purpose or urgency control, and inventing one would be
 * worse than choosing the least presumptuous answer: a flexible commute nobody
 * can do from home. That combination leaves every option the decision agent
 * knows about on the table rather than quietly ruling three of them out.
 */
const DEFAULT_JOURNEY: JourneyContext = {
  purpose: "commute",
  urgency: "flexible",
  deadlineInMin: null,
  canWorkRemotely: false,
};

/**
 * The action to a verdict.
 *
 * Two of the eight actions mean "do not travel", one means "not yet", and the
 * rest mean "travel, with this caveat". `leave_now` is the only one that can be
 * unqualified, and only when the route is genuinely passable.
 */
function verdictOf(action: string, journey: JourneyView | null): Verdict {
  if (action === "shelter_in_place" || action === "cancel_trip") return "stay";
  if (action === "work_remotely") return "stay";
  if (action === "delay_departure") return "wait";
  if (action === "leave_now") {
    const safe =
      journey === null ||
      (journey.safeRouteExists &&
        journey.safest.impassableCount === 0 &&
        journey.survivability?.band !== "unsafe");
    return safe ? "go" : "caution";
  }
  return "caution";
}

/**
 * Everything the Next app's Today panel answers, in one call.
 *
 * `runJourneyBrief` is the same orchestrator the deployed app runs: prediction,
 * routing, vehicle, timeline, decision, citizen alerts, with the trace that says
 * which agent produced what. The community-intelligence step inside it degrades
 * to nothing in a browser — there is no report store — and it is already wrapped
 * in a try/catch for exactly that case.
 */
export async function runBrief(
  scenarioId: string,
  inputs: JourneyInputs,
  journeyContext: Partial<JourneyContext> = {},
): Promise<BriefView> {
  const now = new Date();
  const brief = await runJourneyBrief({
    cityId: CITY,
    scenario: resolveScenario(scenarioId),
    originNodeId: inputs.fromId,
    destinationNodeId: inputs.toId,
    vehicle: profileFor(inputs.vehicleId),
    journey: { ...DEFAULT_JOURNEY, ...journeyContext },
    departInMin: 0,
    now,
  });

  const tz = getCityGraph(CITY).city.timezone;
  const clock = (minutes: number) => clockAt(now, tz, num(minutes));

  const journey = brief.comparison ? serialiseComparison(brief.comparison) : null;
  const primary = brief.decision.primary;
  const timeline = brief.timeline;

  return {
    answer: {
      verdict: verdictOf(primary.action, journey),
      action: primary.action,
      label: text(primary.label, ""),
      headline: text(primary.headline, ""),
      etaMin: primary.etaMin === null ? null : int(primary.etaMin),
      riskLevel: text(primary.riskLevel, "moderate"),
      reasons: primary.explanations.map((e) => text(e.text, "")).filter(Boolean),
      alternatives: brief.decision.alternatives.map((option) => ({
        action: option.action,
        label: text(option.label, ""),
        headline: text(option.headline, ""),
        etaMin: option.etaMin === null ? null : int(option.etaMin),
      })),
      parallel: brief.decision.parallel.map((option) => ({
        action: option.action,
        label: text(option.label, ""),
        headline: text(option.headline, ""),
        reasons: option.explanations.map((e) => text(e.text, "")).filter(Boolean),
      })),
      emergencyContacts: brief.decision.emergencyContacts.map((contact) => ({
        name: text(contact.name, ""),
        authority: text(contact.authority, ""),
        phone: contact.phone.filter((p) => typeof p === "string" && p.length > 0),
      })),
    },
    window: {
      closesInMin:
        timeline.latestSafeDepartureMin === null
          ? null
          : int(timeline.latestSafeDepartureMin),
      closesAtClock:
        timeline.latestSafeDepartureMin === null
          ? null
          : clock(timeline.latestSafeDepartureMin),
      leaveByInMin:
        timeline.recommendedDepartureMin === null
          ? null
          : int(timeline.recommendedDepartureMin),
      leaveByClock: text(timeline.recommendedDepartureClock, "") || null,
      noSafeWindow: timeline.noSafeWindow === true,
      // The searcher reports "safe across the whole forecast" as a recommended
      // departure of zero with no closing time — the one case where there is
      // genuinely no clock to show and no urgency to imply.
      openThroughout:
        !timeline.noSafeWindow &&
        timeline.latestSafeDepartureMin === null &&
        timeline.recommendedDepartureMin === 0,
    },
    survivability:
      serialiseSurvivability(brief.survivability) ?? journey?.survivability ?? null,
    journey,
    alerts: brief.alerts.map((alert) => ({
      id: alert.id,
      kind: text(alert.kind, ""),
      severity: text(alert.severity, "moderate"),
      title: text(alert.title, ""),
      body: text(alert.body, ""),
      actionLabel: text(alert.actionLabel, "") || null,
    })),
    timeline: timeline.events.map((event) => ({
      minutesFromNow: int(event.minutesFromNow),
      clock: text(event.clock, clock(event.minutesFromNow)),
      title: text(event.title, ""),
      detail: text(event.detail, ""),
      kind: text(event.kind, ""),
      severity: text(event.severity, "moderate"),
    })),
    trace: brief.trace.map((entry) => ({
      agent: text(entry.agent, ""),
      name: text(entry.name, entry.agent),
      latencyMs: int(entry.latencyMs),
      confidence: clamp01(entry.confidence),
      confidenceLabel: text(entry.confidenceBand, "moderate"),
      degraded: entry.degraded === true,
      note: text(entry.topExplanation, ""),
    })),
    computedAtClock: clock(0),
  };
}
