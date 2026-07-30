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
 * Two things are shimmed, both at the edges, and both in engine.ts:
 *
 *   - The OSM drainage layer is normally read off disk. Here it is embedded in
 *     the HTML and pushed straight into the loader's cache, so the loader
 *     returns it before it ever reaches `node:fs`.
 *   - `process.env` does not exist in a browser. A stub keeps the provider
 *     resolution code, which reads env vars to decide whether IMD or CWC are
 *     configured, on its documented "not connected" path.
 *
 * ── The modules ────────────────────────────────────────────────────────
 *
 * This file is boot, state and wiring. It holds the two pieces of application
 * state — the selected scenario and the last engine pass — and it is the only
 * place that knows the order things happen in. Everything else is owned:
 *
 *   engine.ts   the only importer of `@/lib`; turns the engine into view models
 *   map.ts      the only importer of Leaflet; draws roads, routes and camera
 *   panels.ts   the side panel, the wordmark and the status line
 *   i18n.ts     every user-visible string
 *   ui.ts       shared DOM and formatting helpers
 *   intro.ts    the opening moment; empty today
 *   shell.html  the static layout every module attaches to
 *
 * The rule that keeps them apart: view models flow outward from engine.ts, and
 * user intent flows back through this file. map.ts and panels.ts never call
 * each other, and neither of them ever calls the engine.
 */

import {
  comparePlans,
  getCityView,
  listPlaces,
  listScenarios,
  listVehicles,
  loadConditions,
  type Conditions,
} from "./engine";
import { t } from "./i18n";
import { startIntro } from "./intro";
import { clearRoutes, createMap, drawRoads, drawRoutes } from "./map";
import {
  fillControls,
  readJourneyInputs,
  renderChrome,
  renderRoadDetail,
  renderRoutes,
  renderRoutesNotice,
  renderStats,
  setStatus,
} from "./panels";
import { el } from "./ui";

/* ── State ────────────────────────────────────────────────────────────── */

let scenario = "live";

/** The most recent engine pass, kept so a map click can be answered locally. */
let conditions: Conditions | null = null;

/* ── Boot ─────────────────────────────────────────────────────────────── */

async function boot() {
  createMap(el("map"), getCityView());

  fillControls(
    {
      scenarios: listScenarios(),
      places: listPlaces(),
      vehicles: listVehicles(),
      scenarioId: scenario,
    },
    {
      onScenarioChange: (id) => {
        scenario = id;
        void refresh();
      },
      onPlan: () => void plan(),
    },
  );

  await refresh();

  // Decorates a page that is already usable — never gates it.
  startIntro();
}

/* ── One pass over the city ───────────────────────────────────────────── */

async function refresh() {
  setStatus(t("status.working"));
  conditions = await loadConditions(scenario);

  drawRoads(conditions.roads, showRoad);
  renderStats(conditions.summary);
  setStatus(conditions.degraded ? t("status.degraded") : t("status.live"));

  await plan();
}

/* ── The journey ──────────────────────────────────────────────────────── */

/**
 * Routing runs against a fresh engine pass rather than the one `refresh` just
 * stored, because the plan button can be pressed long after the map was drawn.
 * The engine caches for 45 seconds, so the common case costs nothing and a
 * stale one is recomputed.
 */
async function plan() {
  const current = await loadConditions(scenario);
  const inputs = readJourneyInputs();

  if (inputs.fromId === inputs.toId) {
    renderRoutesNotice("same-points");
    return;
  }

  const journey = comparePlans(current, inputs);
  clearRoutes();

  if (!journey) {
    renderRoutesNotice("no-route");
    return;
  }

  drawRoutes(journey);
  renderRoutes(journey);
}

function showRoad(segmentId: string) {
  const road = conditions?.roads.find((r) => r.id === segmentId);
  if (!road) return;
  renderRoadDetail(road);
}

/* ── Start ────────────────────────────────────────────────────────────── */

renderChrome();

boot().catch((error) => {
  console.error(error);
  setStatus(t("status.failed", { error: String(error) }));
});
