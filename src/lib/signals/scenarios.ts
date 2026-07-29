/**
 * Rainfall scenarios.
 *
 * `live` is the real forecast. The others exist because two different audiences
 * need them: a city engineer planning drain capacity has to ask "what happens if
 * we get another cloudburst", and anyone evaluating the product on a dry day
 * needs to see the system actually reason. Simulated scenarios are always
 * labelled as such in provenance, and they lower the confidence score.
 */
export const SCENARIOS = {
  live: {
    id: "live",
    label: "Live forecast",
    blurb: "Real forecast from the Open-Meteo global weather model.",
    simulated: false,
    peakMmPerHr: 0,
    peakInMin: 0,
    durationMin: 0,
  },
  "monsoon-evening": {
    id: "monsoon-evening",
    label: "Evening monsoon cell",
    blurb:
      "A routine convective storm: heavy for about an hour, then clears. The kind of rain that closes one underpass, not the city.",
    simulated: true,
    peakMmPerHr: 34,
    peakInMin: 45,
    durationMin: 100,
  },
  cloudburst: {
    id: "cloudburst",
    label: "Cloudburst",
    blurb:
      "An extreme short-duration event that overwhelms drainage citywide — the scenario that produces the images people remember.",
    simulated: true,
    peakMmPerHr: 88,
    peakInMin: 35,
    durationMin: 150,
  },
  "sustained-depression": {
    id: "sustained-depression",
    label: "Sustained depression",
    blurb:
      "Lower intensity over many hours. Less dramatic, but saturated ground means it floods places a short burst never would.",
    simulated: true,
    peakMmPerHr: 17,
    peakInMin: 90,
    durationMin: 480,
  },
  clear: {
    id: "clear",
    label: "Dry baseline",
    blurb: "No rainfall. Useful for seeing the network's structural risk alone.",
    simulated: true,
    peakMmPerHr: 0,
    peakInMin: 0,
    durationMin: 0,
  },
} as const;

export type ScenarioId = keyof typeof SCENARIOS;

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

export function isScenarioId(value: string | null | undefined): value is ScenarioId {
  return !!value && (SCENARIO_IDS as string[]).includes(value);
}

export function resolveScenario(value: string | null | undefined): ScenarioId {
  return isScenarioId(value) ? value : "live";
}
