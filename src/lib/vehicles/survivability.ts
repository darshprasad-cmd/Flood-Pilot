import { clamp } from "@/lib/core/math";
import { depthLabel } from "@/lib/core/format";
import type {
  BodyType,
  DriveType,
  FuelType,
  SurvivabilityAssessment,
  SurvivabilityReason,
  TyreType,
  VehicleProfile,
} from "./types";

/**
 * Vehicle survivability.
 *
 * Ground clearance is the number everybody quotes and it is the wrong one. What
 * stops a car in water is the air intake, and where the intake sits depends on
 * the body far more than on the clearance: a hatchback with 170 mm of clearance
 * drowns at roughly 25 cm, while a motorcycle with identical clearance rides
 * through it. So the model converts the published figure into two derived
 * numbers — the depth this vehicle can cross with reasonable margin, and the
 * depth at which water reaches the intake and destroys the engine — and reasons
 * about both.
 *
 * This matters disproportionately in Delhi, where two-wheelers are the majority
 * of traffic and a stalled scooter in a flooded underpass is the most common
 * flood incident in the city.
 */

/**
 * How the body style translates clearance into wading ability.
 *
 * Two-wheelers score above 1.0 because their limiting height is the exhaust and
 * intake, both well above the axle. Sedans and hatchbacks score below 1.0
 * because a low front bumper pushes a bow wave up over the intake long before
 * the water reaches the sills.
 */
const BODY_FACTOR: Record<BodyType, number> = {
  hatchback: 0.85,
  sedan: 0.82,
  suv: 1.05,
  muv: 0.95,
  motorcycle: 1.55,
  scooter: 1.15,
  auto_rickshaw: 1.2,
  bus: 1.6,
  truck: 1.7,
};

/** Where the air intake sits above the ground, as a multiple of clearance. */
const INTAKE_FACTOR: Record<BodyType, number> = {
  hatchback: 2.4,
  sedan: 2.3,
  suv: 2.6,
  muv: 2.5,
  motorcycle: 2.9,
  scooter: 2.1,
  auto_rickshaw: 2.4,
  bus: 3.4,
  truck: 3.6,
};

const DRIVE_FACTOR: Record<DriveType, number> = {
  fwd: 1.0,
  rwd: 1.0,
  awd: 1.06,
  "4x4": 1.18,
};

/**
 * Fuel type changes what water actually breaks.
 *
 * Diesels have no ignition system to soak, which is a real advantage. CNG cars
 * carry low-mounted valves and regulators. Electric drivetrains are sealed but
 * shut down on high-voltage isolation faults, which strands you in the water
 * rather than destroying the motor.
 */
const FUEL_FACTOR: Record<FuelType, number> = {
  petrol: 1.0,
  diesel: 1.06,
  cng: 0.95,
  electric: 0.92,
  hybrid: 0.94,
};

const TYRE_FACTOR: Record<TyreType, number> = {
  standard: 1.0,
  wet_grip: 1.03,
  all_terrain: 1.05,
  worn: 0.9,
};

const CURRENT_YEAR = 2026;

export function assessSurvivability(
  vehicle: VehicleProfile,
  depthCm: number,
  context: { slopePct?: number; flowing?: boolean } = {},
): SurvivabilityAssessment {
  const reasons: SurvivabilityReason[] = [];

  const bodyFactor = BODY_FACTOR[vehicle.bodyType];
  const driveFactor = DRIVE_FACTOR[vehicle.driveType];
  const fuelFactor = FUEL_FACTOR[vehicle.fuelType];
  const tyreFactor = TYRE_FACTOR[vehicle.tyreType];

  // Seals, door membranes and wiring degrade. Past about eight years this starts
  // to show up as water ingress long before anything mechanical fails.
  const age = Math.max(0, CURRENT_YEAR - vehicle.year);
  const ageFactor = 1 - clamp((age - 8) * 0.012, 0, 0.12);

  const maxSafeWadeMm =
    vehicle.groundClearanceMm *
    bodyFactor *
    driveFactor *
    fuelFactor *
    tyreFactor *
    ageFactor;

  const maxSafeWadeCm = maxSafeWadeMm / 10;
  const intakeHeightCm =
    (vehicle.groundClearanceMm * INTAKE_FACTOR[vehicle.bodyType]) / 10;

  const utilisation = maxSafeWadeCm <= 0 ? 99 : depthCm / maxSafeWadeCm;

  const band: SurvivabilityAssessment["band"] =
    utilisation < 0.55 ? "safe" : utilisation < 0.9 ? "borderline" : "unsafe";

  const score = Math.round(100 * clamp(1 - utilisation / 1.2));

  /* ── Reasons ────────────────────────────────────────────────────────── */

  reasons.push({
    text: `${vehicle.manufacturer} ${vehicle.model} has ${vehicle.groundClearanceMm} mm of ground clearance, which works out to a safe wading depth of about ${depthLabel(maxSafeWadeCm)}.`,
    impact: "neutral",
  });

  if (depthCm >= intakeHeightCm) {
    reasons.push({
      text: `At ${depthLabel(depthCm)} the water is above the air intake — this is the depth that destroys engines, not just stalls them.`,
      impact: "blocks",
    });
  } else if (band === "unsafe") {
    reasons.push({
      text: `${depthLabel(depthCm)} exceeds what this vehicle can cross safely. Even if it gets through, the bow wave will push water higher than the still depth suggests.`,
      impact: "blocks",
    });
  } else if (band === "borderline") {
    reasons.push({
      text: `${depthLabel(depthCm)} is close to this vehicle's limit. It would probably get through slowly and in one gear, with no margin if the water is deeper than modelled.`,
      impact: "increases-risk",
    });
  } else {
    reasons.push({
      text: `${depthLabel(depthCm)} is comfortably within what this vehicle handles.`,
      impact: "reduces-risk",
    });
  }

  if (vehicle.bodyType === "scooter" || vehicle.bodyType === "motorcycle") {
    reasons.push({
      text:
        vehicle.bodyType === "scooter"
          ? "Scooters have a low-mounted exhaust and a small intake — they stall in water that a car would ignore, and restarting a flooded engine usually means a workshop."
          : "The exhaust and intake sit high, but a two-wheeler loses grip and stability in moving water well before it loses the engine.",
      impact: "increases-risk",
    });
  }

  if (vehicle.fuelType === "electric") {
    reasons.push({
      text: "The battery pack is sealed, but the high-voltage system shuts down on an isolation fault. The realistic failure here is being stranded mid-water, not the pack failing.",
      impact: "increases-risk",
    });
  }

  if (vehicle.fuelType === "diesel" && band !== "unsafe") {
    reasons.push({
      text: "A diesel has no ignition system to soak, which buys a little margin over a petrol equivalent.",
      impact: "reduces-risk",
    });
  }

  if (vehicle.fuelType === "cng") {
    reasons.push({
      text: "CNG valves and regulators are mounted low, so water ingress is a real risk before the engine itself is affected.",
      impact: "increases-risk",
    });
  }

  if (vehicle.driveType === "4x4" && band !== "unsafe") {
    reasons.push({
      text: "Four-wheel drive helps with traction on a silted road surface, though it does nothing for water reaching the intake.",
      impact: "reduces-risk",
    });
  }

  if (vehicle.tyreType === "worn") {
    reasons.push({
      text: "Worn tyres aquaplane on standing water and give up grip on the silt left behind afterwards.",
      impact: "increases-risk",
    });
  }

  if (age > 10) {
    reasons.push({
      text: `A ${age}-year-old vehicle has aged door seals and wiring — expect water inside the cabin before the engine is in trouble.`,
      impact: "increases-risk",
    });
  }

  /* ── Moving water ───────────────────────────────────────────────────── */

  let flowWarning: string | null = null;
  const slope = context.slopePct ?? 0;
  if ((context.flowing || slope > 1.5) && depthCm > 15) {
    const light =
      vehicle.bodyType === "scooter" ||
      vehicle.bodyType === "motorcycle" ||
      vehicle.bodyType === "auto_rickshaw";
    flowWarning = light
      ? `The water here is moving. At ${depthLabel(depthCm)}, flowing water will take a two-wheeler off its line before depth ever becomes the problem.`
      : `The water here is moving. Around 30 cm of flowing water is enough to start floating a car, regardless of its clearance.`;
    reasons.push({ text: flowWarning, impact: "increases-risk" });
  }

  return {
    band,
    score,
    maxSafeWadeCm,
    intakeHeightCm,
    againstDepthCm: depthCm,
    utilisation,
    reasons,
    flowWarning,
  };
}

export const BAND_META: Record<
  SurvivabilityAssessment["band"],
  { label: string; color: string; blurb: string }
> = {
  safe: {
    label: "Safe",
    color: "#2fbf6f",
    blurb: "Well within what this vehicle handles.",
  },
  borderline: {
    label: "Borderline",
    color: "#e8b62c",
    blurb: "Passable, but with no margin for error.",
  },
  unsafe: {
    label: "Unsafe",
    color: "#e8503a",
    blurb: "Beyond what this vehicle can cross.",
  },
};

/** Build a full profile from a catalogue entry plus the owner's choices. */
export function buildVehicleProfile(input: {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  bodyType: BodyType;
  groundClearanceMm: number;
  tyreType?: TyreType;
  driveType: DriveType;
  fuelType: FuelType;
  nickname?: string;
}): VehicleProfile {
  return {
    id: input.id,
    manufacturer: input.manufacturer,
    model: input.model,
    year: input.year,
    bodyType: input.bodyType,
    groundClearanceMm: input.groundClearanceMm,
    tyreType: input.tyreType ?? "standard",
    driveType: input.driveType,
    fuelType: input.fuelType,
    nickname: input.nickname,
  };
}

export * from "./types";
export { VEHICLE_CATALOG, findCatalogEntry, DEFAULT_VEHICLE_ID } from "./catalog";
