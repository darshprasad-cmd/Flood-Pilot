import { NextResponse } from "next/server";
import { infrastructureAgent } from "@/lib/agents/orchestrator";
import { serializeSegment, summarise } from "@/lib/api/serialize";
import { DEFAULT_CITY_ID, cityExists, getCityPlugin } from "@/lib/cities/registry";
import { getStore } from "@/lib/db";
import { runFloodEngine } from "@/lib/engine";
import { resolveScenario } from "@/lib/signals/scenarios";

export const dynamic = "force-dynamic";

/**
 * Operations dashboard data.
 *
 * Behind the middleware gate. Same predictions as the citizen view, reframed
 * around deployment, drain failure and population exposure.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cityId = url.searchParams.get("city") ?? DEFAULT_CITY_ID;
  const scenario = resolveScenario(url.searchParams.get("scenario"));

  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  try {
    const result = await runFloodEngine(cityId, scenario);
    const reports = await getStore().listReports({
      cityId,
      withinMin: 24 * 60,
      limit: 100,
    });

    const insights = await infrastructureAgent.run({ result, reports });
    const plugin = getCityPlugin(cityId);

    const segments = result.states
      .map((state) => {
        const segment = result.graph.getSegment(state.segmentId);
        return segment ? serializeSegment(segment, state) : null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return NextResponse.json({
      city: {
        id: result.graph.city.id,
        name: result.graph.city.name,
        center: result.graph.city.center,
        bounds: result.graph.city.bounds,
        timezone: result.graph.city.timezone,
      },
      scenario,
      computedAt: result.computedAt,
      insights: insights.data,
      explanations: insights.explanations,
      confidence: insights.confidence,
      meta: insights.meta,
      summary: summarise(result),
      segments,
      drains: plugin.majorDrains.map((d) => ({
        id: d.id,
        name: d.name,
        kind: d.kind,
        path: d.path,
        siltationIndex: d.siltationIndex,
        designCapacityCumecs: d.designCapacityCumecs,
        operator: d.operator,
      })),
      gauges: result.bundle.gauges,
      warnings: result.bundle.warnings,
      controlRooms: plugin.controlRooms,
      sources: result.sources,
      signalSources: result.bundle.sources,
    });
  } catch (error) {
    console.error("[api/gov/insights]", error);
    return NextResponse.json(
      {
        error: "Insight generation failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
