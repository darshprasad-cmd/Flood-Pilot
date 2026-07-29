import type { HazardKind, HazardModel } from "./types";

/**
 * Registry of hazard models.
 *
 * New hazards — heatwaves, dust storms, air quality, power outages, water
 * shortages — are added by registering a model here. No caller needs to know
 * which hazards exist at compile time, which is what keeps the platform from
 * ossifying around flooding.
 */
const registry = new Map<HazardKind, HazardModel<never, never>>();

export function registerHazardModel<TSubject, TSignals>(
  model: HazardModel<TSubject, TSignals>,
): void {
  registry.set(model.kind, model as unknown as HazardModel<never, never>);
}

export function getHazardModel<TSubject, TSignals>(
  kind: HazardKind,
): HazardModel<TSubject, TSignals> {
  const model = registry.get(kind);
  if (!model) {
    throw new Error(
      `No hazard model registered for "${kind}". Registered: ${
        [...registry.keys()].join(", ") || "none"
      }`,
    );
  }
  return model as unknown as HazardModel<TSubject, TSignals>;
}

export function hasHazardModel(kind: HazardKind): boolean {
  return registry.has(kind);
}

export function listHazardModels(): {
  kind: HazardKind;
  label: string;
  version: string;
  specVersion: string;
}[] {
  return [...registry.values()].map((m) => ({
    kind: m.kind,
    label: m.label,
    version: m.version,
    specVersion: m.spec.version,
  }));
}
