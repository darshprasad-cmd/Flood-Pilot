import type { MetroStation } from "@/lib/graph/types";
import {
  BENGALURU,
  BENGALURU_MONTHLY_NORMAL_MM,
  BENGALURU_NODES,
  BENGALURU_SEGMENTS,
  BENGALURU_WEATHER_GRID,
} from "@/lib/graph/seed/bengaluru";
import type { CityPlugin, SourceCredit } from "../types";

/**
 * Bengaluru — the second city.
 *
 * Delhi is version one and everything is tuned for it, but a platform that only
 * ever ran in one city would not have proved the claim that adding a city is a
 * data exercise. This plugin exists as evidence: it supplies its own junctions,
 * drainage character, rainfall normals and source preferences, and shares every
 * line of the hazard engine, routing, vehicle model and decision engine with
 * Delhi.
 *
 * It is deliberately thinner than Delhi — no trunk-drain network, no river gauge
 * — because Bengaluru's flooding is pluvial and lake-overflow driven rather than
 * fluvial, and the model should reflect that rather than pretend otherwise.
 */

const BENGALURU_METRO: MetroStation[] = BENGALURU_NODES.filter((n) => n.metro).map(
  (n) => ({
    id: `metro_${n.id}`,
    name: n.metro!.station,
    line: n.metro!.line,
    at: { lat: n.lat, lng: n.lng },
  }),
);

const BENGALURU_CREDITS: SourceCredit[] = [
  {
    id: "open-meteo",
    name: "Open-Meteo",
    authority: "Open-Meteo (open data)",
    url: "https://open-meteo.com/",
    provides: [
      "Rainfall forecast",
      "Observed rainfall history",
      "Elevation",
      "River discharge (GloFAS)",
    ],
    requiresKey: false,
  },
  {
    id: "osm-overpass",
    name: "OpenStreetMap (Overpass API)",
    authority: "OpenStreetMap contributors",
    url: "https://overpass-api.de/",
    provides: ["Drainage channels", "Water bodies", "Culverts and underpasses"],
    requiresKey: false,
  },
  {
    id: "google-traffic",
    name: "Google Maps Platform",
    authority: "Google",
    url: "https://developers.google.com/maps",
    provides: ["Live traffic", "Alternate routes", "Road hierarchy"],
    requiresKey: true,
    envKey: "GOOGLE_MAPS_API_KEY",
  },
];

export const BENGALURU_PLUGIN: CityPlugin = {
  meta: BENGALURU,
  nodes: BENGALURU_NODES,
  segments: BENGALURU_SEGMENTS,
  metro: BENGALURU_METRO,
  monthlyNormalMm: BENGALURU_MONTHLY_NORMAL_MM,
  weatherGrid: BENGALURU_WEATHER_GRID,
  majorDrains: [],
  gauges: [],
  hotspots: [],
  controlRooms: [
    {
      name: "BBMP Control Room",
      authority: "Bruhat Bengaluru Mahanagara Palike",
      phone: ["1533", "080-22660000"],
      note: "Waterlogging, tree falls and storm-water drain complaints.",
    },
  ],
  credits: BENGALURU_CREDITS,
  sources: {
    rainfall: ["open-meteo"],
    river: ["open-meteo-flood"],
    elevation: ["google-elevation", "open-meteo-elevation"],
    traffic: ["google-traffic", "internal-model"],
    drainage: ["osm-overpass", "seed"],
    roads: ["seed", "osm-overpass"],
  },
  floodCharacter:
    "Bengaluru floods from rainfall and lake overflow rather than a river. Water runs down the Koramangala–Challaghatta valley into Bellandur and Varthur, and the Outer Ring Road tech corridor sits at the bottom of it.",
};
