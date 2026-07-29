import type { SeedNode } from "@/lib/graph/seed-types";

/**
 * Delhi NCR junctions.
 *
 * Coordinates are real and geocoded to within a few hundred metres. Elevations
 * are seeded from published topography — the Yamuna floodplain sits around
 * 198-206 m, most of the built city 210-220 m, and the Delhi Ridge rises past
 * 230 m — and are refined at runtime by the Google or Open-Meteo elevation API
 * where one is reachable. That ~30 m spread is small, which is exactly why
 * Delhi floods: there is very little gravity available to move water.
 */
export const DELHI_NODES: SeedNode[] = [
  /* ── Central Delhi / Lutyens ──────────────────────────────────────────── */
  { id: "cp", name: "Connaught Place", lat: 28.6315, lng: 77.2167, elevationM: 216, ward: "New Delhi", metro: { station: "Rajiv Chowk", line: "Yellow / Blue", walkM: 200 } },
  { id: "minto", name: "Minto Bridge", lat: 28.636, lng: 77.2205, elevationM: 209, ward: "New Delhi", metro: { station: "New Delhi", line: "Yellow", walkM: 600 } },
  { id: "ndls", name: "New Delhi Railway Station", lat: 28.642, lng: 77.219, elevationM: 211, ward: "Paharganj", metro: { station: "New Delhi", line: "Yellow", walkM: 150 } },
  { id: "ito", name: "ITO Crossing", lat: 28.6285, lng: 77.241, elevationM: 205, ward: "IP Estate", metro: { station: "ITO", line: "Violet", walkM: 200 } },
  { id: "delhigate", name: "Delhi Gate", lat: 28.6395, lng: 77.2405, elevationM: 207, ward: "Daryaganj", metro: { station: "Delhi Gate", line: "Violet", walkM: 250 } },
  { id: "pragati", name: "Pragati Maidan", lat: 28.618, lng: 77.2445, elevationM: 207, ward: "IP Estate", metro: { station: "Supreme Court", line: "Blue", walkM: 250 } },
  { id: "indiagate", name: "India Gate", lat: 28.6129, lng: 77.2295, elevationM: 213, ward: "New Delhi", metro: { station: "Central Secretariat", line: "Yellow / Violet", walkM: 1200 } },
  { id: "jhandewalan", name: "Jhandewalan", lat: 28.644, lng: 77.199, elevationM: 214, ward: "Karol Bagh", metro: { station: "Jhandewalan", line: "Blue", walkM: 250 } },
  { id: "karolbagh", name: "Karol Bagh", lat: 28.6512, lng: 77.19, elevationM: 216, ward: "Karol Bagh", metro: { station: "Karol Bagh", line: "Blue", walkM: 250 } },

  /* ── Old Delhi / North ────────────────────────────────────────────────── */
  { id: "chandnichowk", name: "Chandni Chowk", lat: 28.656, lng: 77.23, elevationM: 209, ward: "Chandni Chowk", metro: { station: "Chandni Chowk", line: "Yellow", walkM: 200 } },
  { id: "redfort", name: "Red Fort / Lal Quila", lat: 28.6562, lng: 77.241, elevationM: 206, ward: "Chandni Chowk", metro: { station: "Lal Quila", line: "Violet", walkM: 200 } },
  { id: "kashmeregate", name: "Kashmere Gate ISBT", lat: 28.667, lng: 77.228, elevationM: 205, ward: "Civil Lines", metro: { station: "Kashmere Gate", line: "Red / Yellow / Violet", walkM: 150 } },
  { id: "tishazari", name: "Tis Hazari", lat: 28.669, lng: 77.2163, elevationM: 208, ward: "Civil Lines", metro: { station: "Tis Hazari", line: "Red", walkM: 200 } },
  { id: "civillines", name: "Civil Lines", lat: 28.679, lng: 77.2245, elevationM: 210, ward: "Civil Lines", metro: { station: "Civil Lines", line: "Yellow", walkM: 300 } },
  { id: "rajghat", name: "Rajghat / Nigambodh", lat: 28.6406, lng: 77.2494, elevationM: 202, ward: "Daryaganj" },
  { id: "gtbnagar", name: "GTB Nagar", lat: 28.698, lng: 77.2067, elevationM: 214, ward: "Model Town", metro: { station: "GTB Nagar", line: "Yellow", walkM: 200 } },
  { id: "mukherjeenagar", name: "Mukherjee Nagar", lat: 28.7055, lng: 77.2105, elevationM: 212, ward: "Mukherjee Nagar", metro: { station: "GTB Nagar", line: "Yellow", walkM: 1200 } },
  { id: "modeltown", name: "Model Town", lat: 28.718, lng: 77.1905, elevationM: 214, ward: "Model Town", metro: { station: "Model Town", line: "Yellow", walkM: 300 } },
  { id: "azadpur", name: "Azadpur Chowk", lat: 28.7072, lng: 77.1755, elevationM: 211, ward: "Azadpur", metro: { station: "Azadpur", line: "Yellow / Pink", walkM: 250 } },
  { id: "jahangirpuri", name: "Jahangirpuri", lat: 28.729, lng: 77.1622, elevationM: 212, ward: "Jahangirpuri", metro: { station: "Jahangirpuri", line: "Yellow", walkM: 250 } },
  { id: "mukarba", name: "Mukarba Chowk", lat: 28.7292, lng: 77.169, elevationM: 210, ward: "Bhalswa" },
  { id: "burari", name: "Burari", lat: 28.744, lng: 77.2, elevationM: 208, ward: "Burari" },
  { id: "wazirabad", name: "Wazirabad Barrage", lat: 28.715, lng: 77.2323, elevationM: 201, ward: "Wazirabad" },
  { id: "signaturebridge", name: "Signature Bridge", lat: 28.705, lng: 77.2405, elevationM: 200, ward: "Wazirabad" },

  /* ── Trans-Yamuna / East ──────────────────────────────────────────────── */
  { id: "shastripark", name: "Shastri Park", lat: 28.67, lng: 77.2543, elevationM: 201, ward: "Shastri Park", metro: { station: "Shastri Park", line: "Red", walkM: 250 } },
  { id: "seelampur", name: "Seelampur", lat: 28.6699, lng: 77.268, elevationM: 203, ward: "Seelampur", metro: { station: "Seelampur", line: "Red", walkM: 250 } },
  { id: "yamunavihar", name: "Yamuna Vihar / Bhajanpura", lat: 28.6962, lng: 77.2698, elevationM: 203, ward: "Yamuna Vihar", metro: { station: "Bhajanpura", line: "Pink", walkM: 500 } },
  { id: "shahdara", name: "Shahdara", lat: 28.6742, lng: 77.289, elevationM: 205, ward: "Shahdara", metro: { station: "Shahdara", line: "Red", walkM: 250 } },
  { id: "geetacolony", name: "Geeta Colony", lat: 28.652, lng: 77.2738, elevationM: 202, ward: "Geeta Colony" },
  { id: "laxminagar", name: "Laxmi Nagar", lat: 28.6352, lng: 77.2772, elevationM: 204, ward: "Laxmi Nagar", metro: { station: "Laxmi Nagar", line: "Blue", walkM: 250 } },
  { id: "akshardham", name: "Akshardham", lat: 28.618, lng: 77.277, elevationM: 201, ward: "Mayur Vihar", metro: { station: "Akshardham", line: "Blue", walkM: 250 } },
  { id: "mayurvihar", name: "Mayur Vihar Phase 1", lat: 28.6072, lng: 77.29, elevationM: 203, ward: "Mayur Vihar", metro: { station: "Mayur Vihar Phase-1", line: "Blue / Pink", walkM: 300 } },
  { id: "karkardooma", name: "Karkardooma", lat: 28.6519, lng: 77.3025, elevationM: 206, ward: "Karkardooma", metro: { station: "Karkardooma", line: "Blue / Pink", walkM: 250 } },
  { id: "preetvihar", name: "Preet Vihar", lat: 28.6392, lng: 77.2947, elevationM: 206, ward: "Preet Vihar", metro: { station: "Preet Vihar", line: "Blue", walkM: 250 } },
  { id: "anandvihar", name: "Anand Vihar ISBT", lat: 28.6469, lng: 77.3157, elevationM: 207, ward: "Anand Vihar", metro: { station: "Anand Vihar ISBT", line: "Blue / Pink", walkM: 200 } },
  { id: "gazipur", name: "Ghazipur", lat: 28.625, lng: 77.326, elevationM: 205, ward: "Ghazipur" },
  { id: "noida18", name: "Noida Sector 18", lat: 28.5705, lng: 77.3261, elevationM: 199, ward: "Noida", metro: { station: "Noida Sector 18", line: "Blue", walkM: 200 } },

  /* ── Ring Road south-east / Yamuna bank ───────────────────────────────── */
  { id: "saraikalekhan", name: "Sarai Kale Khan", lat: 28.5885, lng: 77.257, elevationM: 203, ward: "Nizamuddin", metro: { station: "Sarai Kale Khan", line: "Pink", walkM: 300 } },
  { id: "nizamuddin", name: "Hazrat Nizamuddin", lat: 28.59, lng: 77.246, elevationM: 206, ward: "Nizamuddin", metro: { station: "Hazrat Nizamuddin", line: "Pink", walkM: 400 } },
  { id: "ashram", name: "Ashram Chowk", lat: 28.573, lng: 77.259, elevationM: 207, ward: "Ashram", metro: { station: "Ashram", line: "Pink", walkM: 200 } },
  { id: "moolchand", name: "Moolchand", lat: 28.568, lng: 77.2362, elevationM: 214, ward: "Defence Colony", metro: { station: "Moolchand", line: "Violet", walkM: 200 } },
  { id: "lajpatnagar", name: "Lajpat Nagar", lat: 28.5677, lng: 77.2433, elevationM: 213, ward: "Lajpat Nagar", metro: { station: "Lajpat Nagar", line: "Violet / Pink", walkM: 250 } },
  { id: "okhla", name: "Okhla Industrial Area", lat: 28.556, lng: 77.276, elevationM: 204, ward: "Okhla", metro: { station: "Okhla NSIC", line: "Magenta", walkM: 400 } },
  { id: "jasola", name: "Jasola", lat: 28.539, lng: 77.2931, elevationM: 202, ward: "Jasola", metro: { station: "Jasola Vihar Shaheen Bagh", line: "Magenta", walkM: 350 } },
  { id: "kalindikunj", name: "Kalindi Kunj", lat: 28.545, lng: 77.306, elevationM: 199, ward: "Jasola", metro: { station: "Kalindi Kunj", line: "Magenta", walkM: 300 } },
  { id: "saritavihar", name: "Sarita Vihar", lat: 28.529, lng: 77.29, elevationM: 204, ward: "Sarita Vihar", metro: { station: "Sarita Vihar", line: "Violet", walkM: 300 } },
  { id: "badarpur", name: "Badarpur Border", lat: 28.494, lng: 77.302, elevationM: 203, ward: "Badarpur", metro: { station: "Badarpur Border", line: "Violet", walkM: 300 } },
  { id: "pulprahladpur", name: "Pul Prahladpur", lat: 28.5042, lng: 77.2833, elevationM: 202, ward: "Pul Prahladpur" },
  { id: "tughlakabad", name: "Tughlakabad", lat: 28.5093, lng: 77.2601, elevationM: 218, ward: "Tughlakabad", metro: { station: "Tughlakabad", line: "Violet", walkM: 400 } },

  /* ── South Delhi ──────────────────────────────────────────────────────── */
  { id: "nehruplace", name: "Nehru Place", lat: 28.5494, lng: 77.2501, elevationM: 216, ward: "Nehru Place", metro: { station: "Nehru Place", line: "Violet", walkM: 200 } },
  { id: "kalkaji", name: "Kalkaji Mandir", lat: 28.5346, lng: 77.2589, elevationM: 215, ward: "Kalkaji", metro: { station: "Kalkaji Mandir", line: "Violet / Magenta", walkM: 250 } },
  { id: "govindpuri", name: "Govindpuri", lat: 28.5352, lng: 77.2661, elevationM: 212, ward: "Govindpuri", metro: { station: "Govindpuri", line: "Violet", walkM: 250 } },
  { id: "chiragdelhi", name: "Chirag Delhi", lat: 28.5392, lng: 77.2262, elevationM: 220, ward: "Chirag Delhi" },
  { id: "malviyanagar", name: "Malviya Nagar", lat: 28.5353, lng: 77.2131, elevationM: 224, ward: "Malviya Nagar", metro: { station: "Malviya Nagar", line: "Yellow", walkM: 250 } },
  { id: "saket", name: "Saket", lat: 28.5245, lng: 77.2101, elevationM: 226, ward: "Saket", metro: { station: "Saket", line: "Yellow", walkM: 300 } },
  { id: "hauzkhas", name: "Hauz Khas", lat: 28.5494, lng: 77.2001, elevationM: 223, ward: "Hauz Khas", metro: { station: "Hauz Khas", line: "Yellow / Magenta", walkM: 250 } },
  { id: "greenpark", name: "Green Park", lat: 28.5595, lng: 77.2065, elevationM: 221, ward: "Green Park", metro: { station: "Green Park", line: "Yellow", walkM: 250 } },
  { id: "aiims", name: "AIIMS", lat: 28.5672, lng: 77.21, elevationM: 217, ward: "AIIMS", metro: { station: "AIIMS", line: "Yellow", walkM: 200 } },
  { id: "safdarjung", name: "Safdarjung", lat: 28.5731, lng: 77.2053, elevationM: 218, ward: "Safdarjung" },
  { id: "sarojini", name: "Sarojini Nagar", lat: 28.576, lng: 77.196, elevationM: 218, ward: "Sarojini Nagar", metro: { station: "Sarojini Nagar", line: "Pink", walkM: 250 } },
  { id: "motibagh", name: "Moti Bagh", lat: 28.578, lng: 77.172, elevationM: 217, ward: "Moti Bagh", metro: { station: "Moti Bagh", line: "Pink", walkM: 300 } },
  { id: "rkpuram", name: "RK Puram", lat: 28.564, lng: 77.178, elevationM: 220, ward: "RK Puram" },
  { id: "munirka", name: "Munirka", lat: 28.5545, lng: 77.174, elevationM: 222, ward: "Munirka", metro: { station: "Munirka", line: "Magenta", walkM: 250 } },
  { id: "vasantvihar", name: "Vasant Vihar", lat: 28.56, lng: 77.16, elevationM: 224, ward: "Vasant Vihar", metro: { station: "Vasant Vihar", line: "Magenta", walkM: 300 } },
  { id: "vasantkunj", name: "Vasant Kunj", lat: 28.52, lng: 77.158, elevationM: 230, ward: "Vasant Kunj" },
  { id: "chanakyapuri", name: "Chanakyapuri", lat: 28.592, lng: 77.187, elevationM: 218, ward: "Chanakyapuri" },

  /* ── West Delhi ───────────────────────────────────────────────────────── */
  { id: "dhaulakuan", name: "Dhaula Kuan", lat: 28.592, lng: 77.161, elevationM: 214, ward: "Dhaula Kuan", metro: { station: "Durgabai Deshmukh South Campus", line: "Pink", walkM: 600 } },
  { id: "naraina", name: "Naraina", lat: 28.63, lng: 77.14, elevationM: 215, ward: "Naraina", metro: { station: "Naraina Vihar", line: "Pink", walkM: 400 } },
  { id: "motinagar", name: "Moti Nagar", lat: 28.658, lng: 77.1422, elevationM: 214, ward: "Moti Nagar", metro: { station: "Moti Nagar", line: "Blue", walkM: 300 } },
  { id: "patelnagar", name: "Patel Nagar", lat: 28.652, lng: 77.166, elevationM: 215, ward: "Patel Nagar", metro: { station: "Patel Nagar", line: "Blue", walkM: 300 } },
  { id: "zakhira", name: "Zakhira Flyover", lat: 28.6652, lng: 77.1576, elevationM: 211, ward: "Zakhira" },
  { id: "punjabibagh", name: "Punjabi Bagh", lat: 28.6692, lng: 77.1312, elevationM: 216, ward: "Punjabi Bagh", metro: { station: "Punjabi Bagh West", line: "Green", walkM: 400 } },
  { id: "rajourigarden", name: "Rajouri Garden", lat: 28.6492, lng: 77.1206, elevationM: 216, ward: "Rajouri Garden", metro: { station: "Rajouri Garden", line: "Blue / Pink", walkM: 250 } },
  { id: "tilaknagar", name: "Tilak Nagar", lat: 28.6402, lng: 77.0942, elevationM: 214, ward: "Tilak Nagar", metro: { station: "Tilak Nagar", line: "Blue", walkM: 250 } },
  { id: "janakpuri", name: "Janakpuri", lat: 28.629, lng: 77.081, elevationM: 215, ward: "Janakpuri", metro: { station: "Janakpuri West", line: "Blue / Magenta", walkM: 300 } },
  { id: "uttamnagar", name: "Uttam Nagar", lat: 28.62, lng: 77.057, elevationM: 216, ward: "Uttam Nagar", metro: { station: "Uttam Nagar East", line: "Blue", walkM: 350 } },
  { id: "najafgarh", name: "Najafgarh", lat: 28.609, lng: 76.98, elevationM: 213, ward: "Najafgarh", metro: { station: "Najafgarh", line: "Grey", walkM: 600 } },
  { id: "peeragarhi", name: "Peeragarhi", lat: 28.68, lng: 77.0852, elevationM: 217, ward: "Peeragarhi", metro: { station: "Peeragarhi", line: "Green", walkM: 300 } },
  { id: "nangloi", name: "Nangloi", lat: 28.682, lng: 77.062, elevationM: 216, ward: "Nangloi" },
  { id: "mundka", name: "Mundka", lat: 28.682, lng: 77.033, elevationM: 218, ward: "Mundka", metro: { station: "Mundka", line: "Green", walkM: 300 } },
  { id: "pitampura", name: "Pitampura", lat: 28.7, lng: 77.1322, elevationM: 219, ward: "Pitampura", metro: { station: "Pitampura", line: "Red", walkM: 300 } },
  { id: "rohini", name: "Rohini Sector 18", lat: 28.738, lng: 77.12, elevationM: 220, ward: "Rohini" },

  /* ── South-west / Airport / Dwarka ────────────────────────────────────── */
  { id: "mahipalpur", name: "Mahipalpur", lat: 28.545, lng: 77.125, elevationM: 225, ward: "Mahipalpur" },
  { id: "igi", name: "IGI Airport T3", lat: 28.5562, lng: 77.0999, elevationM: 222, ward: "Airport", metro: { station: "Airport (T3)", line: "Orange", walkM: 150 } },
  { id: "palam", name: "Palam", lat: 28.588, lng: 77.085, elevationM: 217, ward: "Palam", metro: { station: "Dashrath Puri", line: "Magenta", walkM: 400 } },
  { id: "dwarka", name: "Dwarka Sector 21", lat: 28.552, lng: 77.058, elevationM: 218, ward: "Dwarka", metro: { station: "Dwarka Sector 21", line: "Blue / Orange", walkM: 200 } },
  { id: "rajokri", name: "Rajokri / Gurugram Border", lat: 28.509, lng: 77.108, elevationM: 226, ward: "Rajokri" },
];
