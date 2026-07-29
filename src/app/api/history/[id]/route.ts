import { NextResponse } from "next/server";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import { getStore } from "@/lib/db";
import { computeCalibration } from "@/lib/engine/calibration";
import { getCityGraph } from "@/lib/graph";

export const dynamic = "force-dynamic";

/**
 * Everything the platform has learned about one road.
 *
 * Two kinds of history, kept apart because they mean different things: recorded
 * flooding events (what happened) and prediction outcomes (what we said would
 * happen, and whether we were right). The second is what makes the system get
 * better; the first is what it was seeded with.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const cityId = url.searchParams.get("city") ?? DEFAULT_CITY_ID;

  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  const graph = getCityGraph(cityId);
  const segment = graph.getSegment(id);
  if (!segment) {
    return NextResponse.json({ error: `Unknown segment "${id}"` }, { status: 404 });
  }

  const store = getStore();
  const [outcomes, reports] = await Promise.all([
    store.listOutcomes(cityId, id),
    store.listReports({ cityId, segmentId: id, limit: 100 }),
  ]);

  const calibration = computeCalibration(outcomes).get(id) ?? null;

  const disruptionHours = segment.floodHistory.reduce(
    (sum, event) => sum + (event.disruptionHr ?? event.durationHr),
    0,
  );

  return NextResponse.json({
    segment: {
      id: segment.id,
      name: segment.name,
      corridor: segment.corridor,
    },
    recordedEvents: segment.floodHistory,
    stats: {
      eventCount: segment.floodHistory.length,
      eventsPerYear: Math.round(segment.floodFrequencyPerYear * 100) / 100,
      deepestCm: segment.floodHistory.reduce(
        (max, event) => Math.max(max, event.depthCm),
        0,
      ),
      meanDurationHr:
        segment.floodHistory.length > 0
          ? Math.round(
              (segment.floodHistory.reduce((sum, e) => sum + e.durationHr, 0) /
                segment.floodHistory.length) *
                10,
            ) / 10
          : 0,
      totalDisruptionHr: Math.round(disruptionHours),
    },
    predictionAccuracy: calibration
      ? {
          verifiedPredictions: calibration.sampleCount,
          meanAbsoluteError: Math.round(calibration.meanAbsError * 1000) / 1000,
          logitBias: Math.round(calibration.logitBias * 1000) / 1000,
          depthMultiplier: Math.round(calibration.depthMultiplier * 1000) / 1000,
          note:
            calibration.sampleCount === 0
              ? "No prediction on this road has been verified against an outcome yet."
              : `The model has been corrected by ${calibration.logitBias >= 0 ? "+" : ""}${calibration.logitBias.toFixed(2)} log-odds on this road from ${calibration.sampleCount} verified outcomes.`,
        }
      : {
          verifiedPredictions: 0,
          meanAbsoluteError: 0,
          logitBias: 0,
          depthMultiplier: 1,
          note: "No prediction on this road has been verified against an outcome yet.",
        },
    outcomes: outcomes.slice(0, 50),
    reports: reports.slice(0, 50),
    store: store.name,
  });
}
