"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Card,
  CardHeader,
  ConfidenceMeter,
  Empty,
  Metric,
  RiskPill,
  Skeleton,
} from "@/components/ui/primitives";
import {
  BlockageList,
  SourcePanel,
  WhyPanel,
  type BlockageDto,
  type ExplanationDto,
  type SourceUsageDto,
} from "./panels";
import { ReportSheet } from "./ReportSheet";
import { useT, type Messages } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";

interface SegmentDetail {
  segment: {
    id: string;
    name: string;
    corridor: string;
    lanes: number;
    elevationM: number;
    slopePct: number;
    isUnderpass: boolean;
    populationExposure: number;
    basementParking: number;
    pumpStations: number;
    criticalFacilities: string[];
    floodplainExposure: number;
    hotspot: {
      name: string;
      severity: string;
      typicalDepthCm: number;
      typicalDurationHr: number;
      source: string;
      note: string;
    } | null;
    majorDrain: {
      name: string;
      distanceM: number;
      siltationIndex: number;
      capacityCumecs: number;
    } | null;
    state: {
      probability: number;
      depthCm: number;
      peakDepthCm: number;
      riskLevel: string;
      timeToFloodMin: number | null;
      timeToImpassableMin: number | null;
      recoveryMin: number | null;
      drainOverflowLikelihood: number;
      confidence: number;
      confidenceBand: string;
      drainCapacity: number;
      trafficDensity: number;
    };
  };
  prediction: {
    explanations: ExplanationDto[];
    confidence: { score: number; band: string; limitations: string[] };
    onsetCurve: { minutesFromNow: number; value: number; forcing: number }[];
    drivers: {
      feature: string;
      label: string;
      value: number;
      unit: string;
      share: number;
      direction: string;
    }[];
  };
  waterlogging: { blockages: BlockageDto[] };
  history: { date: string; depthCm: number; durationHr: number; source: string }[];
  reports: {
    id: string;
    type: string;
    depthCm: number | null;
    note: string | null;
    createdAt: string;
  }[];
  sources: SourceUsageDto[];
}

/** Everything the browser would normally put in the Tab order. */
const FOCUS_STOPS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Dialog behaviour for a slide-over.
 *
 * Focus capture and restore get their own mount-only effect deliberately. The
 * callers pass inline `onClose` arrows, so an effect that depended on `onClose`
 * would tear down and re-run on every parent render — pulling focus back to the
 * button behind the sheet while somebody is still typing a depth into the report
 * form. The key handler reads the latest `onClose` from a ref for the same
 * reason, so the listener is bound once and stays bound.
 *
 * Tab is trapped rather than merely wrapped: on a phone the sheet is full-bleed,
 * so a focus stop that lands on the page behind it is a button the person cannot
 * see but can still activate.
 */
function useDialogFocus(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const stops = panel.querySelectorAll<HTMLElement>(FOCUS_STOPS);

      // Nothing to land on yet — the sheet is still a skeleton — so hold the
      // caret on the panel rather than let it fall through to the hidden page.
      if (stops.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return panelRef;
}

/**
 * Road detail and reporting.
 *
 * This is where the full "Why?" lives — every driver the model used, the flood
 * history, the drainage condition, and the citizen reports. It is also where the
 * live-learning loop is closed: a report submitted here immediately re-weights
 * the prediction and is recorded as an outcome against what was forecast.
 */
export function SegmentSheet({
  segmentId,
  scenario,
  onClose,
  onReported,
}: {
  segmentId: string;
  scenario: string;
  onClose: () => void;
  onReported: () => void;
}) {
  const t = useT();
  const panelRef = useDialogFocus(onClose);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);

  const load = useCallback(async () => {
    setDetail(null);
    try {
      const res = await fetch(`/api/segment/${segmentId}?scenario=${scenario}`);
      if (res.ok) setDetail((await res.json()) as SegmentDetail);
    } catch {
      /* leave the sheet in its loading state rather than showing a broken one */
    }
  }, [segmentId, scenario]);

  useEffect(() => {
    void load();
  }, [load]);

  const recovery =
    detail && detail.segment.state.recoveryMin !== null
      ? formatDuration(detail.segment.state.recoveryMin, t)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* The panel's own close control is the labelled one; this is the
          click-anywhere shortcut, so assistive tech has no use for it. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      {/* aria-modal is what takes the rest of the app out of the reading order;
          the Tab trap does the same for the keyboard. The label is static
          because the heading below only exists once `detail` has loaded. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.segment.roadDetails}
        tabIndex={-1}
        className="animate-rise safe-top safe-bottom relative flex h-full w-full max-w-[460px] flex-col border-l border-line-bright bg-ink-900 shadow-2xl outline-none"
      >
        {!detail ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <>
            <header className="flex items-start gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-1">{detail.segment.corridor}</p>
                <h2 className="text-sm font-semibold leading-snug">
                  {detail.segment.name}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <RiskPill level={detail.segment.state.riskLevel} />
                  {detail.segment.isUnderpass ? (
                    <Badge tone="warn">{t.route.underpass}</Badge>
                  ) : null}
                  {detail.segment.hotspot ? (
                    <Badge tone="danger">
                      {hotspotBadge(t, detail.segment.hotspot.severity)}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <ShareRoad
                segmentId={segmentId}
                name={detail.segment.name}
                depthCm={detail.segment.state.peakDepthCm}
              />
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-ink-800 hover:text-fg"
                aria-label={t.common.closePanel}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-3">
              {/* Headline numbers */}
              <Card>
                <div className="grid grid-cols-2 gap-4 px-4 py-4">
                  <Metric
                    label={t.segment.floodProbability}
                    value={Math.round(detail.segment.state.probability * 100)}
                    unit="%"
                    tone={detail.segment.state.probability > 0.5 ? "risk" : "default"}
                  />
                  <Metric
                    label={t.segment.peakDepth}
                    value={detail.segment.state.peakDepthCm.toFixed(0)}
                    unit={t.common.cm}
                  />
                  <Metric
                    label={t.segment.timeToFlood}
                    value={
                      detail.segment.state.timeToFloodMin === null
                        ? "—"
                        : `${detail.segment.state.timeToFloodMin}`
                    }
                    unit={
                      detail.segment.state.timeToFloodMin === null ? "" : t.common.min
                    }
                  />
                  <Metric
                    label={t.segment.recovery}
                    value={recovery?.value ?? "—"}
                    unit={recovery?.unit}
                  />
                </div>
                <div className="border-t border-line px-4 py-3">
                  <ConfidenceMeter
                    score={detail.prediction.confidence.score}
                    band={detail.prediction.confidence.band}
                    limitations={detail.prediction.confidence.limitations}
                  />
                </div>
              </Card>

              {/* Onset curve */}
              <Card>
                <CardHeader
                  eyebrow={t.timeline.next12h}
                  title={t.segment.modelledDepth}
                />
                <div className="px-4 py-4">
                  <DepthChart points={detail.prediction.onsetCurve} />
                </div>
              </Card>

              <WhyPanel
                title={t.explain.predictionTitle}
                explanations={detail.prediction.explanations}
                limit={10}
              />

              <BlockageList blockages={detail.waterlogging.blockages} />

              {/* Infrastructure */}
              <Card>
                <CardHeader
                  eyebrow={t.segment.infrastructure}
                  title={t.segment.whatIsHere}
                />
                <dl className="divide-y divide-line">
                  <Row
                    label={t.segment.elevation}
                    value={`${detail.segment.elevationM} ${t.common.m}`}
                  />
                  <Row
                    label={t.segment.slope}
                    value={`${detail.segment.slopePct.toFixed(2)}%`}
                  />
                  <Row
                    label={t.segment.drainCapacity}
                    value={fill(t.segment.percentOfDesign, {
                      pct: Math.round(detail.segment.state.drainCapacity * 100),
                    })}
                  />
                  {detail.segment.majorDrain ? (
                    <Row
                      label={detail.segment.majorDrain.name}
                      value={fill(t.segment.drainDistance, {
                        distance: Math.round(detail.segment.majorDrain.distanceM),
                        silt: Math.round(
                          detail.segment.majorDrain.siltationIndex * 100,
                        ),
                      })}
                    />
                  ) : null}
                  {detail.segment.floodplainExposure > 0.1 ? (
                    <Row
                      label={t.segment.floodplainExposure}
                      value={`${Math.round(detail.segment.floodplainExposure * 100)}%`}
                    />
                  ) : null}
                  {detail.segment.basementParking > 0 ? (
                    <Row
                      label={t.segment.basementParking}
                      value={`${detail.segment.basementParking} ${t.segment.buildings}`}
                    />
                  ) : null}
                  {detail.segment.pumpStations > 0 ? (
                    <Row
                      label={t.segment.pumpStations}
                      value={String(detail.segment.pumpStations)}
                    />
                  ) : null}
                  <Row
                    label={t.stats.peopleExposed}
                    value={detail.segment.populationExposure.toLocaleString()}
                  />
                </dl>
              </Card>

              {/* Hotspot register */}
              {detail.segment.hotspot ? (
                <Card>
                  <CardHeader
                    eyebrow={t.segment.register}
                    title={detail.segment.hotspot.name}
                  />
                  <div className="px-4 py-3">
                    <p className="text-[12.5px] leading-relaxed text-fg-muted">
                      {detail.segment.hotspot.note}
                    </p>
                    <p className="mt-2 text-[11px] text-fg-faint">
                      {fill(t.segment.typicalDepth, {
                        depth: detail.segment.hotspot.typicalDepthCm,
                        hours: detail.segment.hotspot.typicalDurationHr,
                      })}{" "}
                      · {detail.segment.hotspot.source}
                    </p>
                  </div>
                </Card>
              ) : null}

              {/* History */}
              {detail.history.length > 0 ? (
                <Card>
                  <CardHeader
                    eyebrow={t.segment.recordedEvents}
                    title={t.segment.floodHistory}
                  />
                  <ul className="divide-y divide-line">
                    {detail.history.map((event) => (
                      <li
                        key={event.date}
                        className="flex items-baseline justify-between px-4 py-2 text-[12px]"
                      >
                        <span className="numeric text-fg-muted">{event.date}</span>
                        <span className="numeric text-fg">
                          {event.depthCm} {t.common.cm} · {event.durationHr}{" "}
                          {t.common.hr}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {/* Reporting and live learning */}
              <ReportSheet
                segmentId={segmentId}
                segmentLanes={detail.segment.lanes ?? 4}
                scenario={scenario}
                onReported={() => {
                  onReported();
                  void load();
                }}
              />

              {detail.reports.length > 0 ? (
                <Card>
                  <CardHeader
                    eyebrow={t.segment.fromThisRoad}
                    title={t.segment.recentReports}
                    right={<Badge tone="signal">{detail.reports.length}</Badge>}
                  />
                  <ul className="divide-y divide-line">
                    {detail.reports.slice(0, 8).map((report) => (
                      <li key={report.id} className="px-4 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[12px] capitalize text-fg-muted">
                            {report.type.replace(/_/g, " ")}
                            {report.depthCm !== null
                              ? ` · ${report.depthCm} ${t.common.cm}`
                              : ""}
                          </span>
                          <span className="shrink-0 text-[10.5px] text-fg-faint">
                            {timeAgo(report.createdAt, t)}
                          </span>
                        </div>
                        {report.note ? (
                          <p className="mt-0.5 text-[11px] text-fg-faint">
                            {report.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <SourcePanel sources={detail.sources} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Sparkline of modelled depth over the horizon. */
function DepthChart({
  points,
}: {
  points: { minutesFromNow: number; value: number; forcing: number }[];
}) {
  const t = useT();
  if (points.length < 2) return <Empty>{t.segment.noCurve}</Empty>;

  const width = 380;
  const height = 92;
  const maxDepth = Math.max(4, ...points.map((p) => p.value));
  const maxRain = Math.max(1, ...points.map((p) => p.forcing));
  const maxMin = points[points.length - 1].minutesFromNow || 1;

  const x = (min: number) => (min / maxMin) * width;
  const yDepth = (v: number) => height - (v / maxDepth) * (height - 8);

  const depthPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.minutesFromNow).toFixed(1)},${yDepth(p.value).toFixed(1)}`)
    .join(" ");

  const areaPath = `${depthPath} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${t.segment.modelledDepth} — ${t.timeline.next12h}`}
      >
        {/* Rainfall as background bars — the forcing behind the curve. */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={x(p.minutesFromNow)}
            y={height - (p.forcing / maxRain) * height * 0.45}
            width={Math.max(1, width / points.length - 1)}
            height={(p.forcing / maxRain) * height * 0.45}
            fill="rgba(74,168,255,0.16)"
          />
        ))}

        {/* Action threshold */}
        <line
          x1="0"
          x2={width}
          y1={yDepth(8)}
          y2={yDepth(8)}
          stroke="#e8b62c"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.6"
        />
        {/* Impassable threshold */}
        {maxDepth > 24 ? (
          <line
            x1="0"
            x2={width}
            y1={yDepth(30)}
            y2={yDepth(30)}
            stroke="#e8503a"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
        ) : null}

        <path d={areaPath} fill="rgba(74,168,255,0.12)" />
        <path
          d={depthPath}
          fill="none"
          stroke="var(--color-signal-400)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <div className="mt-1.5 flex justify-between text-[10px] text-fg-faint">
        <span>{t.common.now}</span>
        <span className="numeric">
          {t.segment.peak} {maxDepth.toFixed(0)} {t.common.cm}
        </span>
        <span>
          +{Math.round(maxMin / 60)} {t.common.hr}
        </span>
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-fg-faint">
        <Legend color="#e8b62c" label={t.segment.standingWater} />
        {maxDepth > 24 ? (
          <Legend color="#e8503a" label={t.segment.impassableAt} />
        ) : null}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-px w-3" style={{ background: color }} />
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2">
      <dt className="text-[11.5px] text-fg-faint">{label}</dt>
      <dd className="numeric text-[12px] text-fg-muted">{value}</dd>
    </div>
  );
}

/**
 * How long the water takes to go, in whichever unit keeps it readable.
 *
 * Number and unit come back separately so the unit can be a translated word
 * next to a Latin numeral — the compact "45m / 2.1h / 1.2d" this used to emit
 * reads as English to a Hindi or Bengali speaker, and "h" is not a unit anybody
 * outside a Latin script recognises on sight.
 */
function formatDuration(
  minutes: number,
  t: Messages,
): { value: string; unit: string } {
  if (minutes < 60) {
    return { value: String(Math.round(minutes)), unit: t.common.min };
  }
  const hrs = minutes / 60;
  return hrs < 24
    ? { value: hrs.toFixed(1), unit: t.common.hr }
    : { value: (hrs / 24).toFixed(1), unit: t.common.day };
}

function timeAgo(iso: string, t: Messages): string {
  const min = (Date.now() - Date.parse(iso)) / 60_000;
  if (min < 1) return t.segment.justNow;
  if (min < 60) return fill(t.segment.minAgo, { n: Math.round(min) });
  if (min < 1440) return fill(t.segment.hrAgo, { n: Math.round(min / 60) });
  return fill(t.segment.dayAgo, { n: Math.round(min / 1440) });
}

/** The register grades a hotspot by how often it goes under, not how deep. */
function hotspotBadge(t: Messages, severity: string): string {
  const grade =
    t.segment.hotspotSeverity[
      severity as keyof Messages["segment"]["hotspotSeverity"]
    ] ?? severity;
  return fill(t.segment.hotspotBadge, { severity: grade });
}

/**
 * Share this road.
 *
 * In Delhi, flood information already travels by WhatsApp — somebody sees the
 * water at Minto Bridge and tells forty people in a group chat, and that
 * message is what most people actually act on. The product should hand them a
 * better version of the message they were going to send anyway: the road, the
 * modelled depth, and a link that opens on exactly this road.
 *
 * Native share sheet where there is one, clipboard where there is not.
 */
function ShareRoad({
  segmentId,
  name,
  depthCm,
}: {
  segmentId: string;
  name: string;
  depthCm: number;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/app?road=${encodeURIComponent(segmentId)}`;
    const text = fill(t.segment.shareBody, {
      name,
      depth: Math.round(depthCm),
    });

    try {
      if (navigator.share) {
        await navigator.share({ title: name, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A cancelled share sheet lands here too, which is not an error worth
      // telling anybody about.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={t.common.share}
      title={copied ? t.common.copied : t.common.share}
      className="shrink-0 rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-ink-800 hover:text-fg"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 10.5V2.5m0 0L5.2 5.3M8 2.5l2.8 2.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3.5 9.5v3a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
