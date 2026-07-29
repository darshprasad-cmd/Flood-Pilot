/**
 * What दिशाAI knows about the person using it.
 *
 * Everything here is answered during onboarding and lives in the browser. None
 * of it is sent anywhere: there is no account, no server-side profile and no
 * identifier, which is the correct default for a product that knows where
 * somebody sleeps and what time they leave the house.
 *
 * The shape is versioned because it will change, and a stored profile from an
 * older version has to be either migrated or discarded rather than trusted.
 */

export type CommuteMode =
  | "car"
  | "two_wheeler"
  | "metro"
  | "bus"
  | "auto"
  | "walk";

/**
 * How much the interface explains itself.
 *
 * "simple" shows a risk level, an action, a route and a timeline. "detailed"
 * adds probabilities, confidence, hydrology, feature contributions, sources and
 * the agent trace. Both are honest; they differ in how much of the working the
 * reader is shown, not in what the model concluded.
 */
export type DetailMode = "simple" | "detailed";

export interface UserProfile {
  version: 1;
  /** Junction id nearest home. */
  homeNodeId: string | null;
  /** Junction id for the trip they make most often. */
  workNodeId: string | null;
  /** Other places worth watching — school, parents, clinic. */
  frequentNodeIds: string[];
  commuteMode: CommuteMode | null;
  vehicleId: string | null;
  vehicleYear: number;
  tyreType: string;
  /**
   * Delhi-specific and genuinely consequential: a basement fills from the ramp
   * long before the road above becomes impassable, so "move your car" is often
   * the first useful action of a monsoon evening and the last one people think of.
   */
  basementParking: boolean;
  proactiveAlerts: boolean;
  emergencyAlerts: boolean;
  /**
   * Alerts already shown to this person.
   *
   * Ids carry their severity, so an alert that escalates gets a new id and
   * surfaces again rather than staying quietly marked as read.
   */
  seenAlertIds: string[];
  detail: DetailMode;
  /** ISO timestamp, or null if onboarding has not been finished. */
  completedAt: string | null;
}

export const DEFAULT_PROFILE: UserProfile = {
  version: 1,
  homeNodeId: null,
  workNodeId: null,
  frequentNodeIds: [],
  commuteMode: null,
  vehicleId: null,
  vehicleYear: 2021,
  tyreType: "standard",
  basementParking: false,
  proactiveAlerts: true,
  emergencyAlerts: true,
  seenAlertIds: [],
  detail: "simple",
  completedAt: null,
};

/**
 * A profile for somebody who skipped setup.
 *
 * Deliberately a real, usable configuration rather than an empty one: skipping
 * a questionnaire should get you into the product, not into a broken version of
 * it. Dwarka to ITO crosses the city west to east through Dhaula Kuan and the
 * Ring Road, which is a fair demonstration of what the routing is for.
 */
export const DEMO_PROFILE: Omit<UserProfile, "completedAt"> = {
  ...DEFAULT_PROFILE,
  homeNodeId: "dwarka",
  workNodeId: "ito",
  frequentNodeIds: ["cp"],
  commuteMode: "car",
  vehicleId: "swift",
  basementParking: true,
};

/** Whether a stored profile is complete enough to build a dashboard from. */
export function isUsable(profile: UserProfile): boolean {
  return profile.completedAt !== null && profile.homeNodeId !== null;
}

export const COMMUTE_MODES: {
  id: CommuteMode;
  /** Whether this mode makes the vehicle questions worth asking. */
  ownsVehicle: boolean;
}[] = [
  { id: "car", ownsVehicle: true },
  { id: "two_wheeler", ownsVehicle: true },
  { id: "metro", ownsVehicle: false },
  { id: "bus", ownsVehicle: false },
  { id: "auto", ownsVehicle: false },
  { id: "walk", ownsVehicle: false },
];
