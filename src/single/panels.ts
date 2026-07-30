/**
 * Everything on the page that is words rather than geography.
 *
 * The side panel — city conditions, the journey planner, the two route cards,
 * the road detail sheet — plus the two chrome surfaces that sit outside it: the
 * wordmark in the header and the status line at the foot. They are here rather
 * than in main.ts because they are all the same job: turn a view model into
 * markup inside an element shell.html already declared.
 *
 * This module reads view models from engine.ts and copy from i18n.ts. It never
 * calls the engine and never touches the map; the only thing it hands back to
 * the caller is what the user typed, via `readJourneyInputs`.
 *
 * Interface (owned by this module):
 *
 *   renderChrome()               wordmark and tagline
 *   fillControls(data, handlers) populate the four selects and bind them
 *   readJourneyInputs()          from / to / vehicle, as chosen right now
 *   renderStats(summary)         the three city-condition figures
 *   renderRoutes(journey)        both route cards and the trade-off sentence
 *   renderRoutesNotice(reason)   the panel's two "no result" states
 *   renderRoadDetail(road)       the road sheet
 *   setStatus(text)              the foot of the page
 *
 * shell.html owns the static layout. Nothing here creates a container; every
 * function writes into an id the shell already declares.
 */

import type { JourneyInputs, JourneyView, RoadView, RouteView, SummaryView } from "./engine";
import { BRAND_NAME, BRAND_TAGLINE, t } from "./i18n";
import { COLORS, el, escapeHtml, fixed0, optionsHtml, percent, pluralise, select } from "./ui";

/**
 * Where the planner starts.
 *
 * Dwarka to ITO is the demonstration journey: south-west edge to the centre,
 * crossing the corridors that fail first, so the two routes differ on almost
 * any rainfall worth modelling.
 */
const DEFAULT_FROM = "dwarka";
const DEFAULT_TO = "ito";
const DEFAULT_VEHICLE = "swift";

export interface ControlData {
  scenarios: { id: string; label: string }[];
  places: { id: string; name: string }[];
  vehicles: {
    id: string;
    manufacturer: string;
    model: string;
    groundClearanceMm: number;
  }[];
  /** The scenario that should start selected. */
  scenarioId: string;
}

export interface ControlHandlers {
  onScenarioChange: (scenarioId: string) => void;
  onPlan: () => void;
}

export function renderChrome(): void {
  el("brand").textContent = BRAND_NAME;
  el("tagline").textContent = BRAND_TAGLINE;
}

export function fillControls(data: ControlData, handlers: ControlHandlers): void {
  const scenario = select("scenario");
  scenario.innerHTML = optionsHtml(
    data.scenarios.map((s) => ({ value: s.id, label: s.label })),
  );
  scenario.value = data.scenarioId;
  scenario.onchange = () => handlers.onScenarioChange(scenario.value);

  const places = optionsHtml(data.places.map((p) => ({ value: p.id, label: p.name })));
  const from = select("from");
  const to = select("to");
  from.innerHTML = places;
  to.innerHTML = places;
  from.value = DEFAULT_FROM;
  to.value = DEFAULT_TO;

  // Ground clearance is in the label because it is the number that decides
  // whether the water on a road is a delay or a stall.
  const vehicle = select("vehicle");
  vehicle.innerHTML = optionsHtml(
    data.vehicles.map((v) => ({
      value: v.id,
      label: t("plan.vehicleOption", {
        manufacturer: v.manufacturer,
        model: v.model,
        clearanceMm: v.groundClearanceMm,
      }),
    })),
  );
  vehicle.value = DEFAULT_VEHICLE;

  el<HTMLButtonElement>("plan").onclick = () => handlers.onPlan();
}

export function readJourneyInputs(): JourneyInputs {
  return {
    fromId: select("from").value,
    toId: select("to").value,
    vehicleId: select("vehicle").value,
  };
}

/* ── City conditions ──────────────────────────────────────────────────── */

const stat = (label: string, value: string, color: string = COLORS.neutral) =>
  `<div class="stat"><span>${escapeHtml(label)}</span><b style="color:${color}">${escapeHtml(
    value,
  )}</b></div>`;

export function renderStats(summary: SummaryView): void {
  el("stats").innerHTML = [
    stat(
      t("stats.atRisk"),
      String(summary.roadsAtRisk),
      summary.roadsAtRisk > 0 ? COLORS.fastest : COLORS.safe,
    ),
    stat(
      t("stats.impassable"),
      String(summary.impassable),
      summary.impassable > 0 ? COLORS.danger : COLORS.safe,
    ),
    stat(t("stats.deepest"), t("unit.cm", { value: fixed0(summary.deepestCm) })),
  ].join("");
}

/* ── Route results ────────────────────────────────────────────────────── */

export type RoutesNotice = "same-points" | "no-route";

export function renderRoutesNotice(reason: RoutesNotice): void {
  const message = reason === "same-points" ? t("routes.samePoints") : t("routes.noRoute");
  el("routes").innerHTML = `<p class="muted">${message}</p>`;
}

export function renderRoutes(journey: JourneyView): void {
  el("routes").innerHTML = `
    ${routeCard(t("routes.fastest"), journey.fastest, COLORS.fastest)}
    ${routeCard(
      journey.safeRouteExists
        ? t("routes.recommended", { brand: BRAND_NAME })
        : t("routes.leastDangerous"),
      journey.safest,
      journey.safeRouteExists ? COLORS.safe : COLORS.danger,
    )}
    ${
      journey.identical
        ? `<p class="muted">${
            journey.safeRouteExists
              ? t("routes.identicalSafe")
              : t("routes.identicalUnsafe")
          }</p>`
        : `<p class="muted">${describeTrade(journey)}</p>`
    }`;
}

function routeCard(title: string, route: RouteView, color: string) {
  return `<div class="route" style="border-color:${color}55">
    <p class="eyebrow" style="color:${color}">${escapeHtml(title)}</p>
    <div class="row"><span>${t("routes.time")}</span><b>${t("unit.min", {
      value: Math.round(route.durationMin),
    })}</b></div>
    <div class="row"><span>${t("routes.deepest")}</span><b>${t("unit.cm", {
      value: Math.round(route.maxDepthCm),
    })}</b></div>
    <div class="row"><span>${t("routes.underpasses")}</span><b>${route.underpassCount}</b></div>
    ${
      route.impassableCount > 0
        ? `<div class="row impassable"><span>${t(
            "routes.impassableStretches",
          )}</span><b>${route.impassableCount}</b></div>`
        : ""
    }
  </div>`;
}

/**
 * Why the recommended route is worth the extra minutes.
 *
 * Max depth is only one of the things Safe Route Score weighs — underpasses,
 * onset timing and the depth at the moment you would actually arrive all count
 * — so the safer route can legitimately have a slightly higher peak. Claiming
 * it avoids "0 cm of water" in that case is worse than saying nothing.
 */
function describeTrade(journey: JourneyView): string {
  const extra = Math.round(journey.extraMinutes);
  const depth = Math.round(journey.depthReduction);
  const underpasses = journey.fastest.underpassCount - journey.safest.underpassCount;

  if (depth >= 1) return t("trade.depth", { extra, depth });
  if (underpasses > 0) {
    return t(pluralise(underpasses, "trade.underpass", "trade.underpasses"), {
      extra,
      count: underpasses,
    });
  }
  if (journey.riskReduction > 0) return t("trade.risk", { extra });
  return t("trade.time", { extra });
}

/* ── Road detail ──────────────────────────────────────────────────────── */

export function renderRoadDetail(road: RoadView): void {
  el("detail").innerHTML = `
    <p class="eyebrow">${escapeHtml(road.corridor)}</p>
    <h3>${escapeHtml(road.name)}</h3>
    <div class="row">
      <span>${t("road.probability")}</span><b>${t("unit.percent", {
        value: percent(road.floodProbability),
      })}</b>
    </div>
    <div class="row"><span>${t("road.peakDepth")}</span><b>${t("unit.cm", {
      value: fixed0(road.peakDepthCm),
    })}</b></div>
    <div class="row"><span>${t("road.timeToFlood")}</span><b>${
      road.timeToFloodMin === null
        ? t("unit.none")
        : t("unit.min", { value: road.timeToFloodMin })
    }</b></div>
    <div class="row"><span>${t("road.recovery")}</span><b>${
      road.recoveryMin === null
        ? t("unit.none")
        : t("unit.hr", { value: Math.round(road.recoveryMin / 60) })
    }</b></div>
    <div class="row"><span>${t("road.elevation")}</span><b>${t("unit.m", {
      value: road.elevationM.toFixed(1),
    })}</b></div>
    ${
      road.blockages.length
        ? `<p class="eyebrow" style="margin-top:14px">${t("road.blockages")}</p>` +
          road.blockages
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
  el("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ── Status line ──────────────────────────────────────────────────────── */

export function setStatus(text: string): void {
  el("status").textContent = text;
}
