import type { ProviderId } from "@/lib/cities/types";
import type { LatLng } from "@/lib/core/types";
import type { ScenarioId } from "../scenarios";
import type { WeatherField } from "../types";
import { fetchWeatherField } from "../weather";
import { fetchImdRainfall, type ImdWarning } from "./imd";
import type { ResolvedSignal } from "./types";

export interface RainfallResult {
  field: WeatherField;
  /** IMD colour-coded warnings, when the IMD feed is connected. */
  warnings: ImdWarning[];
}

/**
 * Resolve rainfall from the city's preferred providers in order.
 *
 * For Delhi that means IMD first — it is the authoritative source and the one
 * the city's own flood response keys off — then Open-Meteo's global model. A
 * simulated scenario short-circuits the whole chain, because the point of a
 * scenario is to replace the forecast.
 */
export async function resolveRainfall(
  points: LatLng[],
  preference: ProviderId[],
  scenario: ScenarioId,
  now: Date = new Date(),
): Promise<ResolvedSignal<RainfallResult>> {
  const skipped: { id: ProviderId; reason: string }[] = [];

  if (scenario !== "live") {
    return {
      data: { field: await fetchWeatherField(points, scenario, now), warnings: [] },
      usedProvider: "internal-model",
      skipped: preference.map((id) => ({
        id,
        reason: "A simulated scenario is active, so no live forecast was requested.",
      })),
    };
  }

  for (const provider of preference) {
    if (provider === "imd") {
      const result = await fetchImdRainfall(points, now);
      if (result) {
        return { data: result, usedProvider: "imd", skipped };
      }
      skipped.push({
        id: "imd",
        reason: process.env.IMD_API_KEY
          ? "IMD is configured but did not return a usable forecast."
          : "IMD requires a registered API key (IMD_API_KEY).",
      });
      continue;
    }

    if (provider === "open-meteo") {
      const field = await fetchWeatherField(points, "live", now);
      return { data: { field, warnings: [] }, usedProvider: "open-meteo", skipped };
    }
  }

  // Nothing in the preference list answered; fall back rather than fail.
  const field = await fetchWeatherField(points, "live", now);
  return { data: { field, warnings: [] }, usedProvider: "open-meteo", skipped };
}
