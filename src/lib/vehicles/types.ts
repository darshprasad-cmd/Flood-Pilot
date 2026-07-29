export const BODY_TYPES = [
  "hatchback",
  "sedan",
  "suv",
  "muv",
  "motorcycle",
  "scooter",
  "auto_rickshaw",
  "bus",
  "truck",
] as const;

export type BodyType = (typeof BODY_TYPES)[number];

export const TYRE_TYPES = ["standard", "wet_grip", "all_terrain", "worn"] as const;
export type TyreType = (typeof TYRE_TYPES)[number];

export const DRIVE_TYPES = ["fwd", "rwd", "awd", "4x4"] as const;
export type DriveType = (typeof DRIVE_TYPES)[number];

export const FUEL_TYPES = [
  "petrol",
  "diesel",
  "cng",
  "electric",
  "hybrid",
] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

/** A vehicle as the user configures it. */
export interface VehicleProfile {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  bodyType: BodyType;
  /** Millimetres, unladen. */
  groundClearanceMm: number;
  tyreType: TyreType;
  driveType: DriveType;
  fuelType: FuelType;
  /** Optional label the owner gives it. */
  nickname?: string;
}

/** A catalogue entry — the known-good defaults for a model. */
export interface VehicleCatalogEntry {
  id: string;
  manufacturer: string;
  model: string;
  bodyType: BodyType;
  groundClearanceMm: number;
  driveType: DriveType;
  fuelTypes: FuelType[];
  /** Years this generation was on sale, for a sensible year default. */
  years: [number, number];
  popularInDelhi?: boolean;
}

export type SurvivabilityBand = "safe" | "borderline" | "unsafe";

export interface SurvivabilityReason {
  text: string;
  impact: "increases-risk" | "reduces-risk" | "blocks" | "neutral";
}

export interface SurvivabilityAssessment {
  band: SurvivabilityBand;
  /** 0..100, where 100 means the water is nowhere near mattering. */
  score: number;
  /** Depth this vehicle can cross with reasonable safety, in cm. */
  maxSafeWadeCm: number;
  /** Depth at which water reaches the air intake — engine-destroying. */
  intakeHeightCm: number;
  /** The depth the assessment was made against. */
  againstDepthCm: number;
  /** Ratio of depth to safe wading depth. */
  utilisation: number;
  reasons: SurvivabilityReason[];
  /** Set when moving water, not depth, is the binding constraint. */
  flowWarning: string | null;
}
