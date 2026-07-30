import { NextResponse } from "next/server";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import { clusterReports } from "@/lib/community/clustering";
import {
  LAYER_META,
  MAP_LAYERS,
  REPORT_META,
  REPORT_TYPES,
  publishedReport,
} from "@/lib/community/types";
import { verifyReport } from "@/lib/community/verification";
import { getStore } from "@/lib/db";
import { runFloodEngine } from "@/lib/engine";
import { loadCalibration } from "@/lib/engine/calibration";
import { localMonthIndex, tzOffsetMinutes } from "@/lib/core/time";
import { forecastCongestion } from "@/lib/intelligence/congestion";
import { buildRoadIntelligence } from "@/lib/intelligence/road-attributes";
import { estimateIntersectionDelays } from "@/lib/intelligence/signal-delay";
import { sampleWeather } from "@/lib/signals";
import { resolveScenario } from "@/lib/signals/scenarios";

export const dynamic = "force-dynamic";

/**
 * Community intelligence for a city.
 *
 * Returns clustered events rather than a stream of pins, because seventeen pins
 * is not information. Each cluster carries what the pattern of reports implies —
 * often something nobody actually reported, like an accident inferred from a
 * wall of congestion reports with no stated cause.
 *
 * Also returns the derived road intelligence that routing consumes, the
 * intersection delay estimates, and the congestion forecast.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cityId = url.searchParams.get("city") ?? DEFAULT_CITY_ID;
  const scenario = resolveScenario(url.searchParams.get("scenario"));

  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  try {
    const now = new Date();
    const result = await runFloodEngine(cityId, scenario, now);
    const { graph, bundle } = result;

    const reports = await getStore().listReports({
      cityId,
      withinMin: 30 * 24 * 60,
      limit: 800,
    });

    const weatherAt = (at: { lat: number; lng: number }) =>
      sampleWeather(bundle, at);

    /* Clusters ---------------------------------------------------------- */
    const clusters = clusterReports(reports, graph, weatherAt, now);

    /* Per-report verification for the ones shown individually ------------ */
    const recent = reports.slice(0, 60);
    // `publishedReport` and not the raw row: the reporter id is a stable device
    // identity, and this list pairs it with a coordinate and a timestamp.
    const verified = recent.map((report) => ({
      report: publishedReport(report),
      verification: verifyReport({
        report,
        neighbours: reports,
        segment: graph.getSegment(report.segmentId),
        state: graph.getState(report.segmentId),
        weather: weatherAt(report.at),
        now,
      }),
    }));

    /* Intersection delay ------------------------------------------------- */
    const offsetMin = tzOffsetMinutes(graph.city.timezone, now);
    const local = new Date(now.getTime() + offsetMin * 60_000);
    const localHour = local.getUTCHours() + local.getUTCMinutes() / 60;

    const delays = estimateIntersectionDelays(graph, localHour, (nodeId) => {
      // Congestion at a junction is the worst of the roads that meet there.
      const edges = graph.neighbours(nodeId);
      return edges.reduce((worst, edge) => {
        const state = graph.getState(edge.segmentId);
        return Math.max(worst, state?.trafficDensity ?? 0);
      }, 0);
    });

    const delayMap = new Map(delays.map((d) => [d.nodeId, d]));

    /* Congestion forecast ------------------------------------------------ */
    const congestion = forecastCongestion({
      graph,
      weatherAt: (segment) => weatherAt(segment.midpoint),
      clusters,
      localHour,
      timezone: graph.city.timezone,
      now,
    });
    const congestionMap = new Map(congestion.map((c) => [c.segmentId, c]));

    /* Road intelligence -------------------------------------------------- */
    const calibration = await loadCalibration(cityId);
    const intelligence = buildRoadIntelligence({
      graph,
      clusters,
      reports,
      delays: delayMap,
      congestion: congestionMap,
      calibration,
      now,
    });

    return NextResponse.json({
      cityId,
      scenario,
      computedAt: now.toISOString(),
      month: localMonthIndex(now, graph.city.timezone),

      clusters,
      reports: verified,
      reportCount: reports.length,

      layers: MAP_LAYERS.map((id) => LAYER_META[id]),
      reportTypes: REPORT_TYPES.map((id) => REPORT_META[id]),

      signalDelays: delays
        .filter((d) => d.signalised)
        .sort((a, b) => b.estimatedDelaySec - a.estimatedDelaySec)
        .slice(0, 40),

      congestionForecast: congestion
        .filter((c) => c.onsetInMin !== null)
        .slice(0, 25),

      roadIntelligence: [...intelligence.values()].sort(
        (a, b) => b.estimatedDelayMin - a.estimatedDelayMin,
      ),
    });
  } catch (error) {
    console.error("[api/community]", error);
    return NextResponse.json(
      {
        error: "Community intelligence failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
