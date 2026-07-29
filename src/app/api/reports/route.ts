import { NextResponse } from "next/server";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import {
  REPORT_META,
  REPORT_TYPES,
  SEVERITIES,
  type ReportType,
  type Severity,
} from "@/lib/community/types";
import { verifyReport } from "@/lib/community/verification";
import { getStore } from "@/lib/db";
import { invalidateEngineCache, runFloodEngine } from "@/lib/engine";
import { invalidateCalibration } from "@/lib/engine/calibration";
import { getCityGraph } from "@/lib/graph";
import { sampleWeather } from "@/lib/signals";
import { resolveScenario } from "@/lib/signals/scenarios";

export const dynamic = "force-dynamic";

/** Recent community reports for a city. */
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
    limit: 300,
  });

  return NextResponse.json({ reports, count: reports.length });
}

interface ReportBody {
  city?: string;
  segmentId?: string;
  type?: ReportType;
  severity?: Severity;
  depthCm?: number | null;
  lanesBlocked?: number | null;
  description?: string | null;
  photoUrl?: string | null;
  lat?: number;
  lng?: number;
  reporterId?: string;
  scenario?: string;
}

/**
 * Submit a community report.
 *
 * The report is stored, then **verified** — corroboration from other reporters,
 * consistency with rainfall, consistency with observed traffic, historical
 * pattern, model agreement and reporter standing. The verification comes back in
 * the response so the person who submitted it can see exactly how much weight
 * their report carries and why.
 *
 * A report below moderate confidence is recorded and shown but does not move a
 * prediction on its own. That is the anti-spam property: volume from one device
 * cannot manufacture confidence, because corroboration counts distinct
 * reporters.
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

  const meta = REPORT_META[body.type];
  const severity: Severity =
    body.severity && SEVERITIES.includes(body.severity)
      ? body.severity
      : "moderate";

  const depthCm =
    meta.needsDepth && typeof body.depthCm === "number" && Number.isFinite(body.depthCm)
      ? Math.max(0, Math.min(400, body.depthCm))
      : null;

  const lanesBlocked =
    meta.needsLanes &&
    typeof body.lanesBlocked === "number" &&
    Number.isFinite(body.lanesBlocked)
      ? Math.max(0, Math.min(segment.lanes, Math.round(body.lanesBlocked)))
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
    severity,
    depthCm,
    lanesBlocked,
    description:
      typeof body.description === "string" ? body.description.slice(0, 400) : null,
    photoUrl: typeof body.photoUrl === "string" ? body.photoUrl.slice(0, 600) : null,
    reporterId: body.reporterId?.slice(0, 64) ?? "anonymous",
  });

  /* ── Verify ────────────────────────────────────────────────────────── */

  const scenario = resolveScenario(body.scenario);
  let verification = null;

  try {
    const result = await runFloodEngine(cityId, scenario);
    const neighbours = await store.listReports({
      cityId,
      withinMin: meta.halfLifeMin * 3,
      limit: 300,
    });

    verification = verifyReport({
      report,
      neighbours,
      segment,
      state: result.graph.getState(segment.id),
      weather: sampleWeather(result.bundle, report.at),
      now: new Date(),
    });

    // Record the outcome only for reports that actually claim something about
    // water — the rest are not evidence about the flood model's accuracy.
    const state = result.graph.getState(segment.id);
    if (state && (meta.waterRelated || body.type === "road_clear")) {
      await store.recordOutcome({
        cityId,
        segmentId: segment.id,
        predictedProbability: state.floodProbability,
        predictedDepthCm: state.depthCm,
        observedFlooded: meta.waterRelated,
        observedDepthCm: depthCm,
        modelId: state.modelId,
        scenario,
        sourceReportId: report.id,
      });
    }
  } catch (error) {
    // Verification failing must not lose the report itself.
    console.error("[api/reports] verification failed", error);
  }

  invalidateCalibration(cityId);
  invalidateEngineCache(cityId);

  return NextResponse.json({ report, verification }, { status: 201 });
}
