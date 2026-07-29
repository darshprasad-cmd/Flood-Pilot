import type { ControlRoom, GaugeStation, MajorDrain } from "../types";

/**
 * Delhi's drainage network.
 *
 * Delhi does not flood the way a coastal city floods. It floods because roughly
 * 200 natural nallahs were progressively converted into a storm-drain network
 * that outfalls into a single river, and when the river runs high the outfalls
 * back up — so the same drain that is supposed to remove water starts pushing it
 * onto the road instead. Modelling the trunk drains explicitly is what lets the
 * engine tell the difference between "it is raining hard here" and "the Najafgarh
 * drain is full and Zakhira is about to go under".
 *
 * Alignments are coarsely traced from public mapping. Design capacities are
 * order-of-magnitude figures for the trunk sections, not as-built survey data.
 */
export const DELHI_DRAINS: MajorDrain[] = [
  {
    id: "najafgarh",
    name: "Najafgarh Drain (Sahibi Nadi)",
    kind: "trunk_drain",
    path: [
      { lat: 28.583, lng: 76.945 },
      { lat: 28.615, lng: 77.02 },
      { lat: 28.648, lng: 77.06 },
      { lat: 28.672, lng: 77.095 },
      { lat: 28.668, lng: 77.135 },
      { lat: 28.666, lng: 77.158 },
      { lat: 28.676, lng: 77.172 },
      { lat: 28.694, lng: 77.18 },
      { lat: 28.706, lng: 77.19 },
      { lat: 28.716, lng: 77.212 },
      { lat: 28.716, lng: 77.232 },
    ],
    designCapacityCumecs: 240,
    siltationIndex: 0.62,
    outfall: "Yamuna, upstream of Wazirabad barrage",
    operator: "Delhi Irrigation & Flood Control Department",
    note: "Carries the largest share of west and north-west Delhi's runoff. A former river, now the city's main trunk drain, and the single biggest determinant of waterlogging from Najafgarh through Nangloi, Punjabi Bagh and Zakhira.",
  },
  {
    id: "supplementary",
    name: "Supplementary Drain",
    kind: "supplementary_drain",
    path: [
      { lat: 28.681, lng: 77.048 },
      { lat: 28.7, lng: 77.09 },
      { lat: 28.72, lng: 77.115 },
      { lat: 28.729, lng: 77.162 },
      { lat: 28.722, lng: 77.2 },
      { lat: 28.716, lng: 77.23 },
    ],
    designCapacityCumecs: 105,
    siltationIndex: 0.55,
    outfall: "Yamuna at Wazirabad",
    operator: "Delhi Irrigation & Flood Control Department",
    note: "Built to relieve the Najafgarh drain. Serves Rohini, Pitampura and Jahangirpuri; when it runs full, Azadpur and Mukarba Chowk lose their outfall.",
  },
  {
    id: "barapullah",
    name: "Barapullah Nallah",
    kind: "trunk_drain",
    path: [
      { lat: 28.548, lng: 77.203 },
      { lat: 28.56, lng: 77.212 },
      { lat: 28.567, lng: 77.221 },
      { lat: 28.573, lng: 77.231 },
      { lat: 28.583, lng: 77.244 },
      { lat: 28.588, lng: 77.256 },
    ],
    designCapacityCumecs: 85,
    siltationIndex: 0.48,
    outfall: "Yamuna at Sarai Kale Khan",
    operator: "Public Works Department, Delhi",
    note: "Drains south-central Delhi — INA, Lodhi, Defence Colony, Jangpura — into the Yamuna. Its outfall is the first to back up when the river rises, which is why Ashram and Sarai Kale Khan flood before it has rained much locally.",
  },
  {
    id: "shahdara",
    name: "Shahdara Drain",
    kind: "trunk_drain",
    path: [
      { lat: 28.685, lng: 77.325 },
      { lat: 28.665, lng: 77.302 },
      { lat: 28.648, lng: 77.288 },
      { lat: 28.636, lng: 77.271 },
      { lat: 28.629, lng: 77.256 },
    ],
    designCapacityCumecs: 130,
    siltationIndex: 0.58,
    outfall: "Yamuna downstream of ITO barrage",
    operator: "Delhi Irrigation & Flood Control Department",
    note: "The trunk drain for trans-Yamuna Delhi. Its outfall sits below the ITO barrage, so a high river stage stops it discharging and Geeta Colony, Laxmi Nagar and Karkardooma waterlog from the drain rather than from the sky.",
  },
  {
    id: "kushak",
    name: "Kushak / Sunehri Nallah",
    kind: "branch_drain",
    path: [
      { lat: 28.601, lng: 77.207 },
      { lat: 28.592, lng: 77.218 },
      { lat: 28.583, lng: 77.232 },
      { lat: 28.578, lng: 77.24 },
    ],
    designCapacityCumecs: 32,
    siltationIndex: 0.44,
    outfall: "Barapullah nallah",
    operator: "New Delhi Municipal Council",
    note: "Drains Lutyens' Delhi. Small section, heavily culverted, and the reason central Delhi's waterlogging is concentrated at a handful of dips rather than spread out.",
  },
  {
    id: "civillines",
    name: "Civil Lines / Delhi Gate Nallah",
    kind: "branch_drain",
    path: [
      { lat: 28.679, lng: 77.222 },
      { lat: 28.664, lng: 77.232 },
      { lat: 28.648, lng: 77.24 },
      { lat: 28.641, lng: 77.249 },
    ],
    designCapacityCumecs: 40,
    siltationIndex: 0.6,
    outfall: "Yamuna at Rajghat",
    operator: "Municipal Corporation of Delhi",
    note: "Serves Old Delhi and the Civil Lines. Its low-lying outfall at Rajghat is submerged whenever the Yamuna is above warning level.",
  },
  {
    id: "yamuna",
    name: "Yamuna",
    kind: "river",
    path: [
      { lat: 28.79, lng: 77.221 },
      { lat: 28.745, lng: 77.228 },
      { lat: 28.716, lng: 77.232 },
      { lat: 28.686, lng: 77.245 },
      { lat: 28.657, lng: 77.25 },
      { lat: 28.628, lng: 77.253 },
      { lat: 28.598, lng: 77.258 },
      { lat: 28.565, lng: 77.283 },
      { lat: 28.545, lng: 77.307 },
      { lat: 28.51, lng: 77.32 },
    ],
    designCapacityCumecs: 7000,
    siltationIndex: 0.35,
    outfall: "Downstream to Agra",
    operator: "Central Water Commission / Delhi I&FC",
    note: "Every drain in the city ends here. When the river crosses its danger level the outfalls reverse and Delhi's drainage stops working as drainage.",
  },
];

/**
 * Yamuna gauge.
 *
 * The Old Railway Bridge thresholds are the operational figures Delhi's flood
 * response is built around and are published by the Central Water Commission.
 * The 48-72 hour lag from a Hathnikund release is the reason Delhi can be warned
 * of river flooding days ahead — which is a completely different prediction
 * problem from the 20-minute warning a cloudburst gives you.
 */
export const DELHI_GAUGES: GaugeStation[] = [
  {
    id: "yamuna_old_railway_bridge",
    name: "Old Railway Bridge (Loha Pul), Delhi",
    river: "Yamuna",
    at: { lat: 28.6575, lng: 77.2497 },
    warningLevelM: 204.5,
    dangerLevelM: 205.33,
    evacuationLevelM: 206.0,
    operator: "Central Water Commission",
    code: "DLRB",
    upstreamLagHr: 55,
    drivenBy: "Hathnikund Barrage, Yamunanagar",
    source:
      "Central Water Commission flood forecasting network — warning 204.50 m, danger 205.33 m, evacuation 206.00 m.",
  },
];

/**
 * Live flood control rooms.
 *
 * Included because an intelligence platform that tells somebody their basement
 * is about to flood and then does not tell them who to call has stopped short of
 * being useful.
 */
export const DELHI_CONTROL_ROOMS: ControlRoom[] = [
  {
    name: "Delhi Flood Control Room",
    authority: "Irrigation & Flood Control Department, GNCTD",
    phone: ["1800-11-0093", "011-22421656"],
    note: "Operates through the monsoon for river flooding and drain breaches.",
    url: "https://ifc.delhi.gov.in/",
  },
  {
    name: "Central Control Room for Waterlogging",
    authority: "Public Works Department, Delhi",
    phone: ["1800-110-093"],
    note: "Waterlogging complaints on PWD roads, underpasses and flyovers.",
  },
  {
    name: "MCD Control Room",
    authority: "Municipal Corporation of Delhi",
    phone: ["155305"],
    note: "Local road waterlogging, drain cleaning and desilting complaints.",
  },
  {
    name: "Delhi Disaster Management Authority",
    authority: "DDMA, GNCTD",
    phone: ["1077", "011-23438252"],
    note: "State emergency operations centre; district-level disaster response.",
    url: "https://ddma.delhi.gov.in/",
  },
  {
    name: "Delhi Traffic Police",
    authority: "Delhi Police",
    phone: ["1095", "011-25844444"],
    note: "Road closures, diversions and stranded vehicles.",
  },
];
