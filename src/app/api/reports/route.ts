import { NextResponse } from "next/server";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import { getStore } from "@/lib/db";
import { REPORT_TYPES, type ReportType } from "@/lib/db/types";
import { invalidateEngineCache, runFloodEngine } from "@/lib/engine";
import { getCityGraph } from "@/lib/graph";
import { resolveScenario } from "@/lib/signals/scenarios";

export const dynamic = "force-dynamic";

/** Recent citizen reports for a city. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cityId = url.searchParams.get("city") ?? DEFAULT_CITY_ID;
  const segmentId = url.searchParams.get("segment") ?? undefined;
  const withinMin = Number(url.searchParams.get("withinMin") ?? "1440");

  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  const reports = await getStore().listReports({
    cityId,
    segmentId,
    withinMin: Number.isFinite(withinMin) ? withinMin : 1440,
    limit: 200,
  });

  return NextResponse.json({ reports, count: reports.length });
}

interface ReportBody {
  city?: string;
  segmentId?: string;
  type?: ReportType;
  depthCm?: number | null;
  note?: string | null;
  lat?: number;
  lng?: number;
  reporterId?: string;
  scenario?: string;
}

/**
 * Submit a citizen report.
 *
 * This is the live-learning loop closing. A report does three things: it feeds
 * the report signal that adjusts predictions immediately, it records an outcome
 * against whatever the model predicted for that road, and — through the
 * calibration term — it makes the next prediction on that road better.
 *
 * Reports are deliberately not trusted individually. Corroboration and
 * contradiction from nearby reports weight them, and the signal decays with a
 * half-life matched to how fast the underlying thing changes.
 */
export async function POST(request: Request) {
  let body: ReportBody;
  try {
    body = (await request.json()) as ReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cityId = body.city ?? DEFAULT_CITY_ID;
  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  if (!body.type || !REPORT_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${REPORT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const graph = getCityGraph(cityId);
  const segment = body.segmentId ? graph.getSegment(body.segmentId) : undefined;
  if (!segment) {
    return NextResponse.json(
      { error: "segmentId must reference a known road segment" },
      { status: 400 },
    );
  }

  const depthCm =
    typeof body.depthCm === "number" && Number.isFinite(body.depthCm)
      ? Math.max(0, Math.min(400, body.depthCm))
      : null;

  const store = getStore();

  const report = await store.addReport({
    type: body.type,
    cityId,
    segmentId: segment.id,
    at:
      typeof body.lat === "number" && typeof body.lng === "number"
        ? { lat: body.lat, lng: body.lng }
        : segment.midpoint,
    depthCm,
    note: typeof body.note === "string" ? body.note.slice(0, 400) : null,
    reporterId: body.reporterId?.slice(0, 64) ?? "anonymous",
  });

  // Record the outcome against the live prediction for this road, so the
  // calibration term has something to learn from.
  try {
    const scenario = resolveScenario(body.scenario);
    const result = await runFloodEngine(cityId, scenario);
    const state = result.graph.getState(segment.id);

    if (state) {
      await store.recordOutcome({
        cityId,
        segmentId: segment.id,
        predictedProbability: state.floodProbability,
        predictedDepthCm: state.depthCm,
        observedFlooded:
          body.type === "flooded_road" || body.type === "vehicle_stalled",
        observedDepthCm: depthCm,
        modelId: state.modelId,
        scenario,
        sourceReportId: report.id,
      });
    }
  } catch (error) {
    // A failure to record the outcome must not lose the report itself.
    console.error("[api/reports] outcome recording failed", error);
  }

  // The next prediction should reflect this report rather than a cached one.
  invalidateEngineCache(cityId);

  return NextResponse.json({ report }, { status: 201 });
}
