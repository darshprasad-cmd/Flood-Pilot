import type { CityMeta, MetroStation } from "@/lib/graph/types";
import type { CityPlugin, SourceCredit } from "../types";
import {
  DELHI_CONTROL_ROOMS,
  DELHI_DRAINS,
  DELHI_GAUGES,
} from "./drainage";
import { DELHI_HOTSPOTS } from "./hotspots";
import { DELHI_NODES } from "./nodes";
import { DELHI_SEGMENTS } from "./segments";

export const DELHI_META: CityMeta = {
  id: "delhi",
  name: "Delhi NCR",
  country: "India",
  center: { lat: 28.6139, lng: 77.209 },
  bounds: [28.4, 76.84, 28.88, 77.4],
  timezone: "Asia/Kolkata",
  monsoonMonths: [6, 7, 8, 9],
  // Operational range of the road network: Yamuna bank to the Ridge. Only ~34 m
  // separates the lowest road from the highest, which is the whole problem —
  // Delhi has very little gravity available to move water.
  elevationRangeM: [198, 232],
};

/** Long-run monthly rainfall normals for Delhi (Safdarjung), mm. */
export const DELHI_MONTHLY_NORMAL_MM = [
  19, 20, 16, 12, 21, 70, 211, 247, 130, 15, 5, 8,
];

/**
 * Rainfall sampling grid across the NCR.
 *
 * Delhi's monsoon rainfall is famously uneven — it is routine for one part of the
 * city to record 100 mm while another records 5 mm in the same three hours, so a
 * single station reading would be actively misleading.
 */
export const DELHI_WEATHER_GRID = [
  { lat: 28.73, lng: 77.2 }, // Burari / Wazirabad — north
  { lat: 28.72, lng: 77.11 }, // Rohini — north-west
  { lat: 28.62, lng: 77.03 }, // Najafgarh / Uttam Nagar — west
  { lat: 28.63, lng: 77.21 }, // Connaught Place — centre
  { lat: 28.66, lng: 77.3 }, // Shahdara / Karkardooma — east
  { lat: 28.59, lng: 77.31 }, // Mayur Vihar / Noida — south-east
  { lat: 28.52, lng: 77.21 }, // Saket — south
  { lat: 28.55, lng: 77.09 }, // Dwarka / IGI — south-west
];

const DELHI_METRO: MetroStation[] = DELHI_NODES.filter((n) => n.metro).map((n) => ({
  id: `metro_${n.id}`,
  name: n.metro!.station,
  line: n.metro!.line,
  at: { lat: n.lat, lng: n.lng },
}));

/**
 * Data sources, in the order Delhi prefers them.
 *
 * Official Indian government sources come first for every signal they cover.
 * Where they require credentials, the resolver falls through to an open source
 * and says so in the provenance rather than silently substituting.
 */
export const DELHI_CREDITS: SourceCredit[] = [
  {
    id: "imd",
    name: "India Meteorological Department",
    authority: "Ministry of Earth Sciences, Government of India",
    url: "https://api.imd.gov.in/",
    provides: [
      "Rainfall forecast",
      "Hourly rainfall",
      "Rainfall intensity",
      "Quantitative precipitation forecast",
      "Colour-coded weather warnings",
    ],
    requiresKey: true,
    envKey: "IMD_API_KEY",
  },
  {
    id: "cwc",
    name: "Central Water Commission",
    authority: "Ministry of Jal Shakti, Government of India",
    url: "https://cwc.gov.in/",
    provides: [
      "Yamuna river level",
      "Flood warnings",
      "River discharge",
      "Gauge station thresholds",
      "Historical flood records",
    ],
    requiresKey: true,
    envKey: "CWC_API_KEY",
  },
  {
    id: "ifc",
    name: "Delhi Irrigation & Flood Control Department",
    authority: "Government of NCT of Delhi",
    url: "https://ifc.delhi.gov.in/",
    provides: [
      "Drain network and barrage information",
      "Flood control rooms and helplines",
      "River monitoring",
    ],
    requiresKey: false,
  },
  {
    id: "ddma",
    name: "Delhi Disaster Management Authority",
    authority: "Government of NCT of Delhi",
    url: "https://ddma.delhi.gov.in/",
    provides: [
      "Flood-prone area listings",
      "Official flood advisories",
      "Disaster management protocols",
      "Historical flooding behaviour",
    ],
    requiresKey: false,
  },
  {
    id: "google-traffic",
    name: "Google Maps Platform",
    authority: "Google",
    url: "https://developers.google.com/maps",
    provides: [
      "Road hierarchy",
      "Live traffic and congestion",
      "Alternate routes",
      "Place information",
    ],
    requiresKey: true,
    envKey: "GOOGLE_MAPS_API_KEY",
  },
  {
    id: "google-elevation",
    name: "Google Elevation API",
    authority: "Google",
    url: "https://developers.google.com/maps/documentation/elevation",
    provides: [
      "Road elevation",
      "Local depressions",
      "Water flow direction",
    ],
    requiresKey: true,
    envKey: "GOOGLE_MAPS_API_KEY",
  },
  {
    id: "osm-overpass",
    name: "OpenStreetMap (Overpass API)",
    authority: "OpenStreetMap contributors",
    url: "https://overpass-api.de/",
    provides: [
      "Drainage channels and canals",
      "Water bodies",
      "Culverts and underpasses",
      "Bridges and service roads",
    ],
    requiresKey: false,
  },
  {
    id: "open-meteo",
    name: "Open-Meteo",
    authority: "Open-Meteo (open data)",
    url: "https://open-meteo.com/",
    provides: [
      "Rainfall forecast fallback",
      "Observed rainfall history",
      "Elevation fallback",
      "River discharge fallback (GloFAS)",
    ],
    requiresKey: false,
  },
];

export const DELHI_PLUGIN: CityPlugin = {
  meta: DELHI_META,
  nodes: DELHI_NODES,
  segments: DELHI_SEGMENTS,
  metro: DELHI_METRO,
  monthlyNormalMm: DELHI_MONTHLY_NORMAL_MM,
  weatherGrid: DELHI_WEATHER_GRID,
  majorDrains: DELHI_DRAINS,
  gauges: DELHI_GAUGES,
  hotspots: DELHI_HOTSPOTS,
  controlRooms: DELHI_CONTROL_ROOMS,
  credits: DELHI_CREDITS,
  sources: {
    rainfall: ["imd", "open-meteo"],
    river: ["cwc", "open-meteo-flood"],
    elevation: ["google-elevation", "open-meteo-elevation"],
    traffic: ["google-traffic", "internal-model"],
    drainage: ["osm-overpass", "seed"],
    roads: ["seed", "osm-overpass"],
  },
  floodCharacter:
    "Delhi floods four different ways, and they need different warnings. Cloudbursts overwhelm the storm network in twenty minutes. Trunk drains — above all the Najafgarh — back up and push water onto roads hours after the rain stops. Underpasses fill because they are sealed boxes below grade. And when the Yamuna crosses 205.33 m at Old Railway Bridge, the city's outfalls reverse and the floodplain goes under for days, warned by a Hathnikund release two days earlier.",
};

export { DELHI_HOTSPOTS } from "./hotspots";
export { DELHI_DRAINS, DELHI_GAUGES, DELHI_CONTROL_ROOMS } from "./drainage";
