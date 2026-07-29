import type { VehicleCatalogEntry } from "./types";

/**
 * Vehicle catalogue, weighted to what is actually on Delhi's roads.
 *
 * Ground clearances are manufacturer-published unladen figures. They are the
 * headline number everybody quotes, and on their own they are close to useless
 * for flood safety — a hatchback with 170 mm of clearance drowns at roughly
 * 25 cm because its air intake is barely above the bonnet line, while a
 * motorcycle with the same clearance keeps going. The survivability model exists
 * to turn this number into the one that matters.
 *
 * Two-wheelers lead the list because they are the majority of Delhi's traffic and
 * the most exposed: a scooter stalling in a flooded underpass is the single most
 * common flood incident in the city.
 */
export const VEHICLE_CATALOG: VehicleCatalogEntry[] = [
  /* ── Two-wheelers ───────────────────────────────────────────────────── */
  { id: "activa", manufacturer: "Honda", model: "Activa", bodyType: "scooter", groundClearanceMm: 171, driveType: "rwd", fuelTypes: ["petrol"], years: [2015, 2026], popularInDelhi: true },
  { id: "jupiter", manufacturer: "TVS", model: "Jupiter", bodyType: "scooter", groundClearanceMm: 163, driveType: "rwd", fuelTypes: ["petrol"], years: [2015, 2026], popularInDelhi: true },
  { id: "access125", manufacturer: "Suzuki", model: "Access 125", bodyType: "scooter", groundClearanceMm: 160, driveType: "rwd", fuelTypes: ["petrol"], years: [2016, 2026] },
  { id: "ola_s1", manufacturer: "Ola", model: "S1 Pro", bodyType: "scooter", groundClearanceMm: 165, driveType: "rwd", fuelTypes: ["electric"], years: [2021, 2026], popularInDelhi: true },
  { id: "chetak", manufacturer: "Bajaj", model: "Chetak", bodyType: "scooter", groundClearanceMm: 155, driveType: "rwd", fuelTypes: ["electric"], years: [2020, 2026] },
  { id: "splendor", manufacturer: "Hero", model: "Splendor Plus", bodyType: "motorcycle", groundClearanceMm: 165, driveType: "rwd", fuelTypes: ["petrol"], years: [2015, 2026], popularInDelhi: true },
  { id: "pulsar150", manufacturer: "Bajaj", model: "Pulsar 150", bodyType: "motorcycle", groundClearanceMm: 165, driveType: "rwd", fuelTypes: ["petrol"], years: [2015, 2026] },
  { id: "classic350", manufacturer: "Royal Enfield", model: "Classic 350", bodyType: "motorcycle", groundClearanceMm: 170, driveType: "rwd", fuelTypes: ["petrol"], years: [2016, 2026], popularInDelhi: true },
  { id: "himalayan", manufacturer: "Royal Enfield", model: "Himalayan", bodyType: "motorcycle", groundClearanceMm: 220, driveType: "rwd", fuelTypes: ["petrol"], years: [2016, 2026] },
  { id: "apache160", manufacturer: "TVS", model: "Apache RTR 160", bodyType: "motorcycle", groundClearanceMm: 180, driveType: "rwd", fuelTypes: ["petrol"], years: [2018, 2026] },

  /* ── Hatchbacks ─────────────────────────────────────────────────────── */
  { id: "swift", manufacturer: "Maruti Suzuki", model: "Swift", bodyType: "hatchback", groundClearanceMm: 163, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2018, 2026], popularInDelhi: true },
  { id: "baleno", manufacturer: "Maruti Suzuki", model: "Baleno", bodyType: "hatchback", groundClearanceMm: 170, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2019, 2026], popularInDelhi: true },
  { id: "wagonr", manufacturer: "Maruti Suzuki", model: "Wagon R", bodyType: "hatchback", groundClearanceMm: 165, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2019, 2026], popularInDelhi: true },
  { id: "alto_k10", manufacturer: "Maruti Suzuki", model: "Alto K10", bodyType: "hatchback", groundClearanceMm: 160, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2022, 2026], popularInDelhi: true },
  { id: "i20", manufacturer: "Hyundai", model: "i20", bodyType: "hatchback", groundClearanceMm: 170, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2020, 2026] },
  { id: "grand_i10", manufacturer: "Hyundai", model: "Grand i10 Nios", bodyType: "hatchback", groundClearanceMm: 170, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2019, 2026] },
  { id: "tiago", manufacturer: "Tata", model: "Tiago", bodyType: "hatchback", groundClearanceMm: 168, driveType: "fwd", fuelTypes: ["petrol", "cng", "electric"], years: [2020, 2026] },
  { id: "altroz", manufacturer: "Tata", model: "Altroz", bodyType: "hatchback", groundClearanceMm: 165, driveType: "fwd", fuelTypes: ["petrol", "diesel", "cng"], years: [2020, 2026] },
  { id: "kwid", manufacturer: "Renault", model: "Kwid", bodyType: "hatchback", groundClearanceMm: 184, driveType: "fwd", fuelTypes: ["petrol"], years: [2019, 2026] },

  /* ── Sedans ─────────────────────────────────────────────────────────── */
  { id: "dzire", manufacturer: "Maruti Suzuki", model: "Dzire", bodyType: "sedan", groundClearanceMm: 163, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2020, 2026], popularInDelhi: true },
  { id: "city", manufacturer: "Honda", model: "City", bodyType: "sedan", groundClearanceMm: 165, driveType: "fwd", fuelTypes: ["petrol", "hybrid"], years: [2020, 2026] },
  { id: "amaze", manufacturer: "Honda", model: "Amaze", bodyType: "sedan", groundClearanceMm: 170, driveType: "fwd", fuelTypes: ["petrol"], years: [2018, 2026] },
  { id: "virtus", manufacturer: "Volkswagen", model: "Virtus", bodyType: "sedan", groundClearanceMm: 179, driveType: "fwd", fuelTypes: ["petrol"], years: [2022, 2026] },
  { id: "slavia", manufacturer: "Skoda", model: "Slavia", bodyType: "sedan", groundClearanceMm: 179, driveType: "fwd", fuelTypes: ["petrol"], years: [2022, 2026] },
  { id: "verna", manufacturer: "Hyundai", model: "Verna", bodyType: "sedan", groundClearanceMm: 170, driveType: "fwd", fuelTypes: ["petrol"], years: [2023, 2026] },
  { id: "c_class", manufacturer: "Mercedes-Benz", model: "C-Class", bodyType: "sedan", groundClearanceMm: 141, driveType: "rwd", fuelTypes: ["petrol", "diesel"], years: [2022, 2026] },
  { id: "bmw_3", manufacturer: "BMW", model: "3 Series", bodyType: "sedan", groundClearanceMm: 140, driveType: "rwd", fuelTypes: ["petrol", "diesel"], years: [2022, 2026] },

  /* ── Compact SUVs and crossovers ────────────────────────────────────── */
  { id: "nexon", manufacturer: "Tata", model: "Nexon", bodyType: "suv", groundClearanceMm: 209, driveType: "fwd", fuelTypes: ["petrol", "diesel", "electric"], years: [2020, 2026], popularInDelhi: true },
  { id: "punch", manufacturer: "Tata", model: "Punch", bodyType: "suv", groundClearanceMm: 187, driveType: "fwd", fuelTypes: ["petrol", "cng", "electric"], years: [2021, 2026] },
  { id: "brezza", manufacturer: "Maruti Suzuki", model: "Brezza", bodyType: "suv", groundClearanceMm: 198, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2022, 2026], popularInDelhi: true },
  { id: "fronx", manufacturer: "Maruti Suzuki", model: "Fronx", bodyType: "suv", groundClearanceMm: 190, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2023, 2026] },
  { id: "venue", manufacturer: "Hyundai", model: "Venue", bodyType: "suv", groundClearanceMm: 195, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2019, 2026] },
  { id: "creta", manufacturer: "Hyundai", model: "Creta", bodyType: "suv", groundClearanceMm: 190, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2020, 2026], popularInDelhi: true },
  { id: "seltos", manufacturer: "Kia", model: "Seltos", bodyType: "suv", groundClearanceMm: 190, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2019, 2026] },
  { id: "sonet", manufacturer: "Kia", model: "Sonet", bodyType: "suv", groundClearanceMm: 205, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2020, 2026] },
  { id: "magnite", manufacturer: "Nissan", model: "Magnite", bodyType: "suv", groundClearanceMm: 205, driveType: "fwd", fuelTypes: ["petrol"], years: [2020, 2026] },
  { id: "xuv3xo", manufacturer: "Mahindra", model: "XUV 3XO", bodyType: "suv", groundClearanceMm: 201, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2024, 2026] },
  { id: "hyryder", manufacturer: "Toyota", model: "Urban Cruiser Hyryder", bodyType: "suv", groundClearanceMm: 210, driveType: "fwd", fuelTypes: ["petrol", "hybrid", "cng"], years: [2022, 2026] },

  /* ── Larger SUVs and MUVs ───────────────────────────────────────────── */
  { id: "xuv700", manufacturer: "Mahindra", model: "XUV700", bodyType: "suv", groundClearanceMm: 200, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2021, 2026], popularInDelhi: true },
  { id: "scorpio_n", manufacturer: "Mahindra", model: "Scorpio-N", bodyType: "suv", groundClearanceMm: 187, driveType: "rwd", fuelTypes: ["petrol", "diesel"], years: [2022, 2026], popularInDelhi: true },
  { id: "thar", manufacturer: "Mahindra", model: "Thar", bodyType: "suv", groundClearanceMm: 226, driveType: "4x4", fuelTypes: ["petrol", "diesel"], years: [2020, 2026] },
  { id: "fortuner", manufacturer: "Toyota", model: "Fortuner", bodyType: "suv", groundClearanceMm: 220, driveType: "4x4", fuelTypes: ["diesel"], years: [2021, 2026] },
  { id: "compass", manufacturer: "Jeep", model: "Compass", bodyType: "suv", groundClearanceMm: 178, driveType: "awd", fuelTypes: ["diesel"], years: [2021, 2026] },
  { id: "hector", manufacturer: "MG", model: "Hector", bodyType: "suv", groundClearanceMm: 192, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2021, 2026] },
  { id: "innova", manufacturer: "Toyota", model: "Innova Crysta", bodyType: "muv", groundClearanceMm: 178, driveType: "rwd", fuelTypes: ["diesel"], years: [2020, 2026], popularInDelhi: true },
  { id: "ertiga", manufacturer: "Maruti Suzuki", model: "Ertiga", bodyType: "muv", groundClearanceMm: 180, driveType: "fwd", fuelTypes: ["petrol", "cng"], years: [2019, 2026], popularInDelhi: true },
  { id: "carens", manufacturer: "Kia", model: "Carens", bodyType: "muv", groundClearanceMm: 195, driveType: "fwd", fuelTypes: ["petrol", "diesel"], years: [2022, 2026] },

  /* ── Electric ───────────────────────────────────────────────────────── */
  { id: "nexon_ev", manufacturer: "Tata", model: "Nexon EV", bodyType: "suv", groundClearanceMm: 205, driveType: "fwd", fuelTypes: ["electric"], years: [2022, 2026], popularInDelhi: true },
  { id: "tigor_ev", manufacturer: "Tata", model: "Tigor EV", bodyType: "sedan", groundClearanceMm: 172, driveType: "fwd", fuelTypes: ["electric"], years: [2021, 2026] },
  { id: "mg_zs_ev", manufacturer: "MG", model: "ZS EV", bodyType: "suv", groundClearanceMm: 177, driveType: "fwd", fuelTypes: ["electric"], years: [2022, 2026] },

  /* ── Shared and commercial ──────────────────────────────────────────── */
  { id: "auto", manufacturer: "Bajaj", model: "RE Auto Rickshaw", bodyType: "auto_rickshaw", groundClearanceMm: 200, driveType: "rwd", fuelTypes: ["cng"], years: [2015, 2026], popularInDelhi: true },
  { id: "dtc_bus", manufacturer: "DTC", model: "Low-floor bus", bodyType: "bus", groundClearanceMm: 200, driveType: "rwd", fuelTypes: ["cng", "electric"], years: [2015, 2026] },
  { id: "tata_ace", manufacturer: "Tata", model: "Ace", bodyType: "truck", groundClearanceMm: 160, driveType: "rwd", fuelTypes: ["diesel", "cng"], years: [2015, 2026] },
];

export function findCatalogEntry(id: string): VehicleCatalogEntry | undefined {
  return VEHICLE_CATALOG.find((v) => v.id === id);
}

export function catalogManufacturers(): string[] {
  return [...new Set(VEHICLE_CATALOG.map((v) => v.manufacturer))].sort();
}

/** A sensible starting vehicle: the single most common car on Delhi's roads. */
export const DEFAULT_VEHICLE_ID = "swift";
