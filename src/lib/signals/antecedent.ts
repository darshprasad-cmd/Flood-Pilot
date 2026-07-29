import { clamp, hashRange } from "@/lib/core/math";
import type { LatLng } from "@/lib/core/types";
import { asArray, fetchJson } from "./fetcher";
import type { ScenarioId } from "./scenarios";
import type { AntecedentCell, AntecedentField } from "./types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface DailyPayload {
  daily?: { time: string[]; precipitation_sum?: (number | null)[] };
}

/**
 * Recent rainfall history — the single most under-used input in flood apps.
 *
 * The same 30 mm of rain behaves completely differently on ground that has been
 * dry for a fortnight versus ground that has been soaked for five days. Dry soil
 * absorbs a large share of the first hour; saturated soil sends nearly all of it
 * straight into the drains as runoff.
 */
export async function fetchAntecedentField(
  points: LatLng[],
  monthlyNormalMm: number,
  scenario: ScenarioId,
  now: Date = new Date(),
): Promise<AntecedentField> {
  const url =
    `${FORECAST_URL}?latitude=${points.map((p) => p.lat.toFixed(4)).join(",")}` +
    `&longitude=${points.map((p) => p.lng.toFixed(4)).join(",")}` +
    `&daily=precipitation_sum&past_days=30&forecast_days=1&timezone=GMT`;

  const res = await fetchJson<DailyPayload | DailyPayload[]>(url, {
    // Yesterday's rainfall does not change; refresh a few times a day.
    revalidate: 6 * 3600,
    timeoutMs: 6500,
    label: "open-meteo/daily-history",
  });

  const payloads = asArray(res.data);
  const live = res.ok && payloads.length === points.length;

  const cells: AntecedentCell[] = live
    ? payloads.map((p, i) => buildCell(points[i], p, now))
    : points.map((p, i) => simulateCell(p, i, scenario));

  const mean30 =
    cells.reduce((sum, c) => sum + c.last30dMm, 0) / Math.max(1, cells.length);

  return {
    provenance: {
      source: live ? "open-meteo/daily-history" : "floodpilot/antecedent-model",
      kind: live ? "measured" : "modelled",
      fetchedAt: now.toISOString(),
      reliability: live ? 0.82 : 0.45,
      live,
      note: live
        ? "30-day observed rainfall from the reanalysis-backed daily archive."
        : res.error ??
          "Observed rainfall unavailable; antecedent wetness is modelled from the scenario.",
    },
    cells,
    climatologyMonthlyMm: monthlyNormalMm,
    seasonalAnomaly: monthlyNormalMm > 0 ? mean30 / monthlyNormalMm : 1,
  };
}

function buildCell(at: LatLng, payload: DailyPayload, now: Date): AntecedentCell {
  const times = payload.daily?.time ?? [];
  const sums = payload.daily?.precipitation_sum ?? [];
  const nowMs = now.getTime();

  const days = times
    .map((t, i) => ({
      ageDays: (nowMs - Date.parse(`${t}T12:00:00Z`)) / 86_400_000,
      mm: sums[i] ?? 0,
    }))
    .filter((d) => d.ageDays >= 0);

  const within = (n: number) =>
    days.filter((d) => d.ageDays <= n).reduce((sum, d) => sum + d.mm, 0);

  const last3 = within(3);
  const last7 = within(7);
  const last30 = within(30);

  let consecutiveWetDays = 0;
  for (const d of [...days].sort((a, b) => a.ageDays - b.ageDays)) {
    if (d.mm >= 2.5) consecutiveWetDays++;
    else break;
  }

  return {
    at,
    last3dMm: last3,
    last7dMm: last7,
    last30dMm: last30,
    wetnessIndex: wetnessFrom(last3, last7),
    consecutiveWetDays,
  };
}

/**
 * Soil saturation proxy, 0..1.
 *
 * Weighted towards the last three days because that is what governs infiltration
 * capacity; the seven-day term keeps a long wet spell from decaying too quickly.
 */
function wetnessFrom(last3Mm: number, last7Mm: number): number {
  const short = clamp(last3Mm / 55);
  const long = clamp(last7Mm / 130);
  return clamp(short * 0.65 + long * 0.35);
}

function simulateCell(at: LatLng, index: number, scenario: ScenarioId): AntecedentCell {
  // A dry-baseline scenario should also mean dry ground, otherwise the
  // structural-risk view is misleading.
  const wet = scenario === "clear" ? 0.15 : 0.72;
  const seed = `${scenario}:ante:${index}`;
  const last3 = hashRange(`${seed}:3`, 6, 48) * wet;
  const last7 = last3 + hashRange(`${seed}:7`, 10, 70) * wet;
  const last30 = last7 + hashRange(`${seed}:30`, 40, 190) * wet;

  return {
    at,
    last3dMm: last3,
    last7dMm: last7,
    last30dMm: last30,
    wetnessIndex: wetnessFrom(last3, last7),
    consecutiveWetDays: Math.round(hashRange(`${seed}:c`, 0, 5) * wet),
  };
}
