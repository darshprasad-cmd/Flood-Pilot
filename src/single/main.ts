/**
 * दिशाAI as one HTML file.
 *
 * The Next application is the product; this is the same engine with a smaller
 * face on it, for the cases where a server is not available or not wanted — a
 * judging laptop, an email attachment, a USB stick handed to a control room.
 *
 * The important constraint is that it must not be a second implementation.
 * Everything below imports the real modules: the same city graph, the same
 * hazard engine, the same routing, the same vehicle model, the same risk ramp.
 * If this file and the deployed app ever disagree about whether a road is
 * passable, that is a bug in one shared engine rather than a difference of
 * opinion between two.
 *
 * Two things are shimmed, both at the edges:
 *
 *   - The OSM drainage layer is normally read off disk. Here it is embedded in
 *     the HTML and pushed straight into the loader's cache, so the loader
 *     returns it before it ever reaches `node:fs`.
 *   - `process.env` does not exist in a browser. A stub keeps the provider
 *     resolution code, which reads env vars to decide whether IMD or CWC are
 *     configured, on its documented "not connected" path.
 */

import L from "leaflet";
import { getCityGraph } from "@/lib/graph";
import { runFloodEngine } from "@/lib/engine";
import { planRoutes } from "@/lib/routing/safe-route";
import { resolveScenario, SCENARIOS } from "@/lib/signals/scenarios";
import { VEHICLE_CATALOG } from "@/lib/vehicles/catalog";
import { buildVehicleProfile } from "@/lib/vehicles/survivability";
import { RISK_META } from "@/lib/core/risk";
import { BRAND } from "@/lib/brand";
import type { OsmDrainageLayer } from "@/lib/signals/providers/osm";
import type { SegmentState } from "@/lib/graph/types";

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

// Seed the drainage cache before anything can ask for it.
if (window.__DISHA_OSM__) {
  globalRef.__floodpilotOsm = new Map([["delhi", window.__DISHA_OSM__]]);
}

const CITY = "delhi";

/* ── Boot ─────────────────────────────────────────────────────────────── */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let map: L.Map;
let roadLayer: L.LayerGroup;
let routeLayer: L.LayerGroup;
let states: SegmentState[] = [];
let scenario = "live";

async function boot() {
  const graph = getCityGraph(CITY);

  map = L.map($("map"), {
    center: [graph.city.center.lat, graph.city.center.lng],
    zoom: 11,
    zoomControl: true,
    renderer: L.svg(),
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  roadLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  map.fitBounds(
    [
      [graph.city.bounds[0], graph.city.bounds[1]],
      [graph.city.bounds[2], graph.city.bounds[3]],
    ],
    { padding: [24, 24] },
  );

  fillControls(graph);
  await refresh();
}

function fillControls(graph: ReturnType<typeof getCityGraph>) {
  const scenarioSel = $("scenario") as unknown as HTMLSelectElement;
  scenarioSel.innerHTML = Object.values(SCENARIOS)
    .map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`)
    .join("");
  scenarioSel.value = scenario;
  scenarioSel.onchange = () => {
    scenario = scenarioSel.value;
    void refresh();
  };

  const nodes = [...graph.allNodes()].sort((a, b) => a.name.localeCompare(b.name));
  const options = nodes
    .map((n) => `<option value="${n.id}">${escapeHtml(n.name)}</option>`)
    .join("");

  const from = $("from") as unknown as HTMLSelectElement;
  const to = $("to") as unknown as HTMLSelectElement;
  from.innerHTML = options;
  to.innerHTML = options;
  from.value = "dwarka";
  to.value = "ito";

  const vehicle = $("vehicle") as unknown as HTMLSelectElement;
  vehicle.innerHTML = [...VEHICLE_CATALOG]
    .sort((a, b) => (b.popularInDelhi ? 1 : 0) - (a.popularInDelhi ? 1 : 0))
    .map(
      (v) =>
        `<option value="${v.id}">${escapeHtml(`${v.manufacturer} ${v.model}`)} — ${v.groundClearanceMm} mm</option>`,
    )
    .join("");
  vehicle.value = "swift";

  $("plan").onclick = () => void plan();
}

/* ── The engine ───────────────────────────────────────────────────────── */

async function refresh() {
  setStatus("Reading rainfall, drains and elevation…");
  const result = await runFloodEngine(CITY, resolveScenario(scenario));
  states = result.states;

  drawRoads(result);
  drawSummary(result);
  setStatus(
    result.bundle.degraded
      ? "Running on open data. Official feeds are not connected in this build."
      : "Live open data.",
  );
  await plan();
}

function drawRoads(result: Awaited<ReturnType<typeof runFloodEngine>>) {
  roadLayer.clearLayers();

  for (const state of result.states) {
    const segment = result.graph.getSegment(state.segmentId);
    if (!segment) continue;

    const path = segment.geometry.map((p) => [p.lat, p.lng] as [number, number]);
    const risky = state.floodProbability > 0.35 && state.peakDepthCm > 5;
    const weight = risky ? 5 + Math.min(3, state.peakDepthCm / 25) : 3;

    L.polyline(path, {
      color: "#05070b",
      weight: weight + 4,
      opacity: 0.55,
      interactive: false,
    }).addTo(roadLayer);

    L.polyline(path, {
      color: RISK_META[state.riskLevel].color,
      weight,
      opacity: risky ? 0.95 : 0.62,
      lineCap: "round",
      dashArray: segment.isUnderpass ? "1 7" : undefined,
    })
      .bindTooltip(
        `<strong>${escapeHtml(segment.name)}</strong><br/>${Math.round(
          state.floodProbability * 100,
        )}% · ${state.peakDepthCm.toFixed(0)} cm peak`,
        { sticky: true, direction: "top" },
      )
      .on("click", () => showRoad(state.segmentId))
      .addTo(roadLayer);
  }
}

function drawSummary(result: Awaited<ReturnType<typeof runFloodEngine>>) {
  const atRisk = result.states.filter(
    (s) => s.peakDepthCm >= 8 && s.floodProbability >= 0.35,
  ).length;
  const impassable = result.states.filter((s) => s.timeToImpassableMin !== null).length;
  const deepest = Math.max(0, ...result.states.map((s) => s.peakDepthCm));

  $("stats").innerHTML = [
    stat("Roads at risk", String(atRisk), atRisk > 0 ? "#f08a3c" : "#2fbf6f"),
    stat("Impassable", String(impassable), impassable > 0 ? "#e8503a" : "#2fbf6f"),
    stat("Deepest", `${deepest.toFixed(0)} cm`),
  ].join("");
}

function showRoad(segmentId: string) {
  const graph = getCityGraph(CITY);
  const segment = graph.getSegment(segmentId);
  const state = states.find((s) => s.segmentId === segmentId);
  if (!segment || !state) return;

  $("detail").innerHTML = `
    <p class="eyebrow">${escapeHtml(segment.corridor)}</p>
    <h3>${escapeHtml(segment.name)}</h3>
    <div class="row">
      <span>Flood probability</span><b>${Math.round(state.floodProbability * 100)}%</b>
    </div>
    <div class="row"><span>Peak depth</span><b>${state.peakDepthCm.toFixed(0)} cm</b></div>
    <div class="row"><span>Time to flood</span><b>${
      state.timeToFloodMin === null ? "—" : `${state.timeToFloodMin} min`
    }</b></div>
    <div class="row"><span>Recovery</span><b>${
      state.recoveryMin === null ? "—" : `${Math.round(state.recoveryMin / 60)} hr`
    }</b></div>
    <div class="row"><span>Elevation</span><b>${segment.elevationM.toFixed(1)} m</b></div>
    ${
      state.blockages.length
        ? `<p class="eyebrow" style="margin-top:14px">What goes wrong here</p>` +
          state.blockages
            .slice(0, 3)
            .map(
              (b) =>
                `<div class="blockage"><b>${escapeHtml(b.label)}</b><span>${escapeHtml(
                  b.basis,
                )}</span></div>`,
            )
            .join("")
        : ""
    }`;
  $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ── Routing ──────────────────────────────────────────────────────────── */

async function plan() {
  const graph = getCityGraph(CITY);
  const result = await runFloodEngine(CITY, resolveScenario(scenario));

  const from = ($("from") as unknown as HTMLSelectElement).value;
  const to = ($("to") as unknown as HTMLSelectElement).value;
  if (from === to) {
    $("routes").innerHTML = `<p class="muted">Pick two different points.</p>`;
    return;
  }

  const catalogId = ($("vehicle") as unknown as HTMLSelectElement).value;
  const entry = VEHICLE_CATALOG.find((v) => v.id === catalogId) ?? null;
  const vehicle = entry
    ? buildVehicleProfile({
        id: entry.id,
        manufacturer: entry.manufacturer,
        model: entry.model,
        year: 2021,
        bodyType: entry.bodyType,
        groundClearanceMm: entry.groundClearanceMm,
        tyreType: "standard",
        driveType: entry.driveType,
        fuelType: entry.fuelTypes[0],
      })
    : null;

  const comparison = planRoutes(graph, result.predictions, {
    cityId: CITY,
    originNodeId: from,
    destinationNodeId: to,
    vehicle,
    departInMin: 0,
  });

  routeLayer.clearLayers();

  if (!comparison) {
    $("routes").innerHTML = `<p class="muted">No route could be planned between these two junctions.</p>`;
    return;
  }

  const geometryOf = (legs: { geometry: { lat: number; lng: number }[] }[]) =>
    legs.flatMap((leg, i) =>
      (i ? leg.geometry.slice(1) : leg.geometry).map(
        (p) => [p.lat, p.lng] as [number, number],
      ),
    );

  if (!comparison.identical) {
    L.polyline(geometryOf(comparison.fastest.legs), {
      color: "#f08a3c",
      weight: 4,
      dashArray: "12 10",
      opacity: 0.9,
      interactive: false,
    }).addTo(routeLayer);
  }
  L.polyline(geometryOf(comparison.safest.legs), {
    color: comparison.safeRouteExists ? "#2fbf6f" : "#e8503a",
    weight: 6,
    opacity: 0.95,
    interactive: false,
  }).addTo(routeLayer);

  $("routes").innerHTML = `
    ${routeCard("What a maps app gives you", comparison.fastest, "#f08a3c")}
    ${routeCard(
      comparison.safeRouteExists ? "What दिशाAI recommends" : "Least dangerous route",
      comparison.safest,
      comparison.safeRouteExists ? "#2fbf6f" : "#e8503a",
    )}
    ${
      comparison.identical
        ? `<p class="muted">${
            comparison.safeRouteExists
              ? "Both searches picked the same roads. There is no safer alternative to trade time for, which is good news."
              : "Both searches picked the same roads because every alternative is worse. Changing route cannot fix this journey."
          }</p>`
        : `<p class="muted">${describeTrade(comparison)}</p>`
    }`;
}

/**
 * Why the recommended route is worth the extra minutes.
 *
 * Max depth is only one of the things Safe Route Score weighs — underpasses,
 * onset timing and the depth at the moment you would actually arrive all count
 * — so the safer route can legitimately have a slightly higher peak. Claiming
 * it avoids "0 cm of water" in that case is worse than saying nothing.
 */
function describeTrade(comparison: {
  extraMinutes: number;
  depthReduction: number;
  riskReduction: number;
  fastest: { underpassCount: number };
  safest: { underpassCount: number };
}) {
  const extra = Math.round(comparison.extraMinutes);
  const depth = Math.round(comparison.depthReduction);
  const underpasses = comparison.fastest.underpassCount - comparison.safest.underpassCount;

  if (depth >= 1) return `${extra} minutes more to avoid ${depth} cm of water.`;
  if (underpasses > 0) {
    return `${extra} minutes more to avoid ${underpasses} underpass${
      underpasses === 1 ? "" : "es"
    }.`;
  }
  if (comparison.riskReduction > 0) {
    return `${extra} minutes more for a measurably lower-risk route.`;
  }
  return `The recommended route costs ${extra} minutes more.`;
}

function routeCard(
  title: string,
  route: {
    durationMin: number;
    maxDepthCm: number;
    underpassCount: number;
    impassableCount: number;
    legs: unknown[];
  },
  color: string,
) {
  return `<div class="route" style="border-color:${color}55">
    <p class="eyebrow" style="color:${color}">${escapeHtml(title)}</p>
    <div class="row"><span>Time</span><b>${Math.round(route.durationMin)} min</b></div>
    <div class="row"><span>Deepest water</span><b>${Math.round(route.maxDepthCm)} cm</b></div>
    <div class="row"><span>Underpasses</span><b>${route.underpassCount}</b></div>
    ${
      route.impassableCount > 0
        ? `<div class="row impassable"><span>Impassable stretches</span><b>${route.impassableCount}</b></div>`
        : ""
    }
  </div>`;
}

/* ── Bits ─────────────────────────────────────────────────────────────── */

const stat = (label: string, value: string, color = "#e9eef7") =>
  `<div class="stat"><span>${escapeHtml(label)}</span><b style="color:${color}">${escapeHtml(
    value,
  )}</b></div>`;

function setStatus(text: string) {
  $("status").textContent = text;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

$("brand").textContent = BRAND.name;
$("tagline").textContent = BRAND.tagline;

boot().catch((error) => {
  console.error(error);
  setStatus(`Could not start: ${String(error)}`);
});
