import { NextResponse } from "next/server";
import { serializePrediction, serializeSegment } from "@/lib/api/serialize";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import { runFloodEngine } from "@/lib/engine";
import { getStore } from "@/lib/db";
import { resolveScenario } from "@/lib/signals/scenarios";

export const dynamic = "force-dynamic";

/**
 * Full detail for one road segment.
 *
 * Separate from `/api/predict` because this is where the expensive parts live —
 * every explanation, every driver, the whole onset curve, the flood history and
 * the citizen reports. The map needs 120 segments cheaply; the "Why?" panel needs
 * one segment completely.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const cityId = url.searchParams.get("city") ?? DEFAULT_CITY_ID;
  const scenario = resolveScenario(url.searchParams.get("scenario"));

  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  try {
    const result = await runFloodEngine(cityId, scenario);
    const segment = result.graph.getSegment(id);
    const state = result.graph.getState(id);
    const prediction = result.predictions.get(id);

    if (!segment || !state || !prediction) {
      return NextResponse.json(
        { error: `Unknown segment "${id}" in ${cityId}` },
        { status: 404 },
      );
    }

    const reports = await getStore().listReports({
      cityId,
      segmentId: id,
      withinMin: 7 * 24 * 60,
      limit: 20,
    });

    return NextResponse.json({
      segment: serializeSegment(segment, state),
      prediction: serializePrediction(prediction),
      waterlogging: {
        drainOverflowLikelihood: state.drainOverflowLikelihood,
        timeToImpassableMin: state.timeToImpassableMin,
        recoveryMin: state.recoveryMin,
        blockages: state.blockages,
      },
      history: segment.floodHistory,
      drains: segment.drains.map((d) => ({
        id: d.id,
        at: d.at,
        type: d.type,
        designCapacityLps: d.designCapacityLps,
        siltingIndex: Math.round(d.siltingIndex * 100) / 100,
        lastCleanedDaysAgo: d.lastCleanedDaysAgo,
      })),
      reports,
      sources: result.bundle.sources,
      timezone: result.graph.city.timezone,
    });
  } catch (error) {
    console.error("[api/segment]", error);
    return NextResponse.json(
      {
        error: "Segment lookup failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
