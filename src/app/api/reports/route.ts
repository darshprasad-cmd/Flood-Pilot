import { NextResponse, type NextRequest } from "next/server";
import {
  consumeRateLimit,
  ipRateLimitKey,
  type RateLimitRule,
} from "@/lib/api/rate-limit";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import {
  REPORT_META,
  REPORT_TYPES,
  SEVERITIES,
  publishedReport as published,
  type ReportType,
  type Severity,
} from "@/lib/community/types";
import { verifyReport } from "@/lib/community/verification";
import type { LatLng } from "@/lib/core/types";
import { getStore, type CitizenReport } from "@/lib/db";
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

  return NextResponse.json({
    reports: reports.map(published),
    count: reports.length,
  });
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
 * prediction on its own. That is the anti-spam property, and it holds because
 * three things hold together: corroboration counts distinct reporters, the
 * reporter is identified by a cookie this server issues rather than by a field
 * in the request, and how many reports one device or one address can file is
 * capped.
 */
export async function POST(request: NextRequest) {
  let body: ReportBody;
  try {
    body = (await request.json()) as ReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reporter = await resolveReporter(request);

  const perReporter = consumeRateLimit(`report:${reporter.id}`, PER_REPORTER);
  const perAddress = consumeRateLimit(
    `report:addr:${await ipRateLimitKey(request)}`,
    PER_ADDRESS,
  );

  if (!perReporter.allowed || !perAddress.allowed) {
    const retryAfterSec = Math.max(
      perReporter.allowed ? 0 : perReporter.retryAfterSec,
      perAddress.allowed ? 0 : perAddress.retryAfterSec,
    );
    return withReporterCookie(
      NextResponse.json(
        { error: "Too many reports from here just now. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      ),
      reporter,
    );
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
    at: reportedPoint(body, segment.midpoint),
    severity,
    depthCm,
    lanesBlocked,
    description:
      typeof body.description === "string" ? body.description.slice(0, 400) : null,
    photoUrl: typeof body.photoUrl === "string" ? body.photoUrl.slice(0, 600) : null,
    reporterId: reporter.id,
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
    // water — the rest are not evidence about the flood model's accuracy — and
    // only when the claim is verified. An outcome is a *persistent* lever: it
    // feeds `logitBias`, which outlives the report's forty-minute half-life and
    // unwinds only after dozens of newer outcomes. Something that lasts that
    // long has to clear a higher bar than a report that decays on its own.
    const state = result.graph.getState(segment.id);
    if (
      state &&
      verification.confidence >= OUTCOME_CONFIDENCE_MIN &&
      (meta.waterRelated || body.type === "road_clear")
    ) {
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

  return withReporterCookie(
    NextResponse.json({ report: published(report), verification }, { status: 201 }),
    reporter,
  );
}

/* `published` is `publishedReport` from @/lib/community/types — shared, because
   /api/community serves reports too and one endpoint forgetting is the leak. */

/* -------------------------------------------------------------------------- */
/*  Reporter identity                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Who filed a report.
 *
 * Everything that counts *people* rather than reports — corroboration, cluster
 * witness counts, community confidence, reporter standing — keys off this, so
 * it is issued by the server and never read from the request body. A signed
 * httpOnly cookie rather than a hash of address and User-Agent: NCR mobile
 * traffic is CGNAT'd hard enough that hundreds of genuine reporters would share
 * a handful of hashes, and every distinct-reporter count would look repaired
 * while staying broken.
 *
 * It is an identity for counting, not an account. It says "the same device
 * filed these two reports" and nothing whatsoever about who that is.
 */
const REPORTER_COOKIE = "fp_reporter";
/** Browsers cap cookie lifetime at 400 days; standing should last that long. */
const REPORTER_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * How many reports one device may file, and how many one address may carry.
 *
 * The per-address limit is the loose one on purpose: during a storm a single
 * CGNAT address genuinely is many different people standing in the same water.
 * The per-device limit is the tight one, because somebody on the ground files a
 * handful of reports, not a stream.
 */
const PER_REPORTER: RateLimitRule = { limit: 6, windowMs: 10 * 60_000 };
const PER_ADDRESS: RateLimitRule = { limit: 20, windowMs: 10 * 60_000 };

/**
 * Confidence a report needs before it may record an outcome.
 *
 * Above the `actionable` threshold on purpose — it is verification's "high"
 * band. An actionable report moves the current prediction and then decays; an
 * outcome trains the per-segment correction and stays.
 */
const OUTCOME_CONFIDENCE_MIN = 0.62;

interface Reporter {
  id: string;
  /** Set only when the identity was minted for this request. */
  cookie: string | null;
}

async function resolveReporter(request: NextRequest): Promise<Reporter> {
  const existing = await readReporterCookie(
    request.cookies.get(REPORTER_COOKIE)?.value,
  );
  if (existing) return { id: existing, cookie: null };

  const id = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return { id, cookie: `${id}.${await signReporterId(id)}` };
}

function withReporterCookie(
  response: NextResponse,
  reporter: Reporter,
): NextResponse {
  if (!reporter.cookie) return response;
  response.cookies.set({
    name: REPORTER_COOKIE,
    value: reporter.cookie,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REPORTER_COOKIE_MAX_AGE,
  });
  return response;
}

/** The id inside a cookie this server signed, or null for anything else. */
async function readReporterCookie(
  value: string | undefined,
): Promise<string | null> {
  const [id, signature] = value?.split(".") ?? [];
  if (!id || !signature || !/^[0-9a-f]{32}$/.test(id)) return null;

  const expected = await signReporterId(id);
  if (signature.length !== expected.length) return null;
  // Constant-time-ish comparison; both sides are fixed-length hex.
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? id : null;
}

async function signReporterId(id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(
      // With no secret configured the signature still proves the cookie was
      // issued by this codebase rather than typed by the caller, which is the
      // property the counting depends on. A deployment that wants reporter
      // standing to be forgery-proof should set one.
      process.env.REPORTER_ID_SECRET?.trim() || "dishaai-reporter-id-v1",
    ),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  return toHex(new Uint8Array(mac));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Where the report says it is, coarsened to three decimals — about 110 m.
 *
 * The form asks the device for a high-accuracy fix, and reports are public:
 * `at`, the description and the timestamp go to any anonymous caller and get
 * cached onto other people's devices. Rounding happens here, before the point
 * reaches the store, because rounding on the way out still leaves a
 * metre-accurate fix sitting in the store and in the geography column.
 *
 * Three decimals rather than the segment midpoint: every consumer is already
 * coarser than this — corroboration works at 600 m, verification at 400 m,
 * clustering at 250 m — while snapping to the midpoint would give every cluster
 * the same radius and throw away the sub-segment detail clustering exists for.
 */
function reportedPoint(body: ReportBody, fallback: LatLng): LatLng {
  if (
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    !Number.isFinite(body.lat) ||
    !Number.isFinite(body.lng)
  ) {
    return fallback;
  }

  return {
    lat: Math.round(body.lat * 1000) / 1000,
    lng: Math.round(body.lng * 1000) / 1000,
  };
}
