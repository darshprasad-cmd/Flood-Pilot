import { NextResponse } from "next/server";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import { runFloodEngine } from "@/lib/engine";
import { serializeSegment, summarise } from "@/lib/api/serialize";
import { resolveScenario } from "@/lib/signals/scenarios";

export const dynamic = "force-dynamic";

/**
 * City-wide flood state.
 *
 * One call returns every road segment with its risk, timing and top failure
 * modes, plus which data sources actually answered. This is what the map, the
 * dashboards and the government view all read.
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
    const { graph } = result;

    const segments = result.states
      .map((state) => {
        const segment = graph.getSegment(state.segmentId);
        return segment ? serializeSegment(segment, state) : null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return NextResponse.json({
      city: {
        id: graph.city.id,
        name: graph.city.name,
        center: graph.city.center,
        bounds: graph.city.bounds,
        timezone: graph.city.timezone,
        floodCharacter: graph.floodCharacter,
      },
      scenario,
      computedAt: result.computedAt,
      computeMs: result.computeMs,
      segments,
      summary: summarise(result),
      sources: result.sources,
      signalSources: result.bundle.sources,
      gauges: result.bundle.gauges,
      warnings: result.bundle.warnings,
      floodplainPressure: result.bundle.floodplainPressure,
      degraded: result.bundle.degraded,
    });
  } catch (error) {
    console.error("[api/predict]", error);
    return NextResponse.json(
      {
        error: "Prediction failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
