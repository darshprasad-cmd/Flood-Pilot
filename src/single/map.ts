/**
 * The map.
 *
 * All Leaflet in the single-file build lives here; no other module imports it.
 * This module holds the map instance and its two layer groups as private state
 * and exposes a small verb list over them, so a caller can redraw the city or
 * the journey without knowing that either is made of polylines.
 *
 * It reads view models from engine.ts and never calls the engine itself. It
 * decides only presentation: how thick a road is drawn, whether it is dashed,
 * what a tooltip says.
 *
 * Interface (owned by this module):
 *
 *   createMap(container, view)     build the map and fit the city
 *   drawRoads(roads, onSelect)     replace the road layer; onSelect fires on tap
 *   drawRoutes(journey)            paint the two route lines
 *   clearRoutes()                  empty the route layer
 *
 * Anything that changes the map's box — a pane switch, an orientation change —
 * has to call `invalidateSize` on the instance, so that seam belongs here too.
 *
 * Everything here must survive a surface where requestAnimationFrame never
 * fires. `fitBounds` without `animate` is a synchronous transform, which is why
 * the camera is a fit rather than a flight. Any camera work added later belongs
 * in this module and must keep that property — see CinematicMap.tsx for the
 * visibility guard the Next app uses.
 */

import L from "leaflet";
import type { CityView, JourneyView, RoadView } from "./engine";
import { t } from "./i18n";
import { COLORS, escapeHtml, fixed0, percent } from "./ui";

const BASEMAP = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

let map: L.Map;
let roadLayer: L.LayerGroup;
let routeLayer: L.LayerGroup;

export function createMap(container: HTMLElement, view: CityView): void {
  map = L.map(container, {
    center: view.center,
    zoom: 11,
    zoomControl: true,
    renderer: L.svg(),
  });

  L.tileLayer(BASEMAP, {
    maxZoom: 19,
    attribution: t("map.attribution"),
  }).addTo(map);

  // Roads first, so a route always paints above the city it crosses.
  roadLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);

  map.fitBounds(view.bounds, { padding: [24, 24] });
}

/**
 * Repaint every road.
 *
 * A road that is both likely and deep enough to matter is drawn heavier and
 * brighter, so the eye finds the problem before it reads any number. Underpasses
 * are dashed because they fail differently — they fill from below and give no
 * warning at the entrance.
 */
export function drawRoads(roads: RoadView[], onSelect: (id: string) => void): void {
  roadLayer.clearLayers();

  for (const road of roads) {
    const risky = road.floodProbability > 0.35 && road.peakDepthCm > 5;
    const weight = risky ? 5 + Math.min(3, road.peakDepthCm / 25) : 3;

    // A dark casing under every line keeps adjacent roads legible against the
    // basemap without lightening the risk colour itself.
    L.polyline(road.path, {
      color: COLORS.casing,
      weight: weight + 4,
      opacity: 0.55,
      interactive: false,
    }).addTo(roadLayer);

    L.polyline(road.path, {
      color: road.color,
      weight,
      opacity: risky ? 0.95 : 0.62,
      lineCap: "round",
      dashArray: road.isUnderpass ? "1 7" : undefined,
    })
      .bindTooltip(
        `<strong>${escapeHtml(road.name)}</strong><br/>${t("map.tooltip", {
          probability: percent(road.floodProbability),
          depth: fixed0(road.peakDepthCm),
        })}`,
        { sticky: true, direction: "top" },
      )
      .on("click", () => onSelect(road.id))
      .addTo(roadLayer);
  }
}

/**
 * Paint the journey.
 *
 * The time-only route is dashed and drawn first so the recommendation sits on
 * top of it, and it is skipped entirely when both searches agreed — two
 * identical lines would read as a choice that was never offered.
 */
export function drawRoutes(journey: JourneyView): void {
  if (!journey.identical) {
    L.polyline(journey.fastest.path, {
      color: COLORS.fastest,
      weight: 4,
      dashArray: "12 10",
      opacity: 0.9,
      interactive: false,
    }).addTo(routeLayer);
  }

  L.polyline(journey.safest.path, {
    color: journey.safeRouteExists ? COLORS.safe : COLORS.danger,
    weight: 6,
    opacity: 0.95,
    interactive: false,
  }).addTo(routeLayer);
}

export function clearRoutes(): void {
  routeLayer.clearLayers();
}
