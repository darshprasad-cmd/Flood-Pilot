"use client";

import { useCallback, useEffect, useState } from "react";
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

interface SegmentDetail {
  segment: {
    id: string;
    name: string;
    corridor: string;
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

const REPORT_OPTIONS = [
  { type: "flooded_road", label: "Flooded", needsDepth: true },
  { type: "road_clear", label: "Clear", needsDepth: false },
  { type: "drain_blockage", label: "Drain blocked", needsDepth: false },
  { type: "vehicle_stalled", label: "Vehicle stalled", needsDepth: true },
];

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
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [reportType, setReportType] = useState<string | null>(null);
  const [depth, setDepth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    setSubmitted(false);
    setReportType(null);
    setDepth("");
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitReport = async () => {
    if (!reportType) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentId,
          type: reportType,
          depthCm: depth ? Number(depth) : null,
          scenario,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setReportType(null);
        setDepth("");
        onReported();
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const needsDepth = REPORT_OPTIONS.find((o) => o.type === reportType)?.needsDepth;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      <div className="animate-rise relative flex h-full w-full max-w-[460px] flex-col border-l border-line-bright bg-ink-900 shadow-2xl">
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
                    <Badge tone="warn">Underpass</Badge>
                  ) : null}
                  {detail.segment.hotspot ? (
                    <Badge tone="danger">
                      {detail.segment.hotspot.severity} hotspot
                    </Badge>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-ink-800 hover:text-fg"
                aria-label="Close panel"
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
                    label="Flood probability"
                    value={Math.round(detail.segment.state.probability * 100)}
                    unit="%"
                    tone={detail.segment.state.probability > 0.5 ? "risk" : "default"}
                  />
                  <Metric
                    label="Peak depth"
                    value={detail.segment.state.peakDepthCm.toFixed(0)}
                    unit="cm"
                  />
                  <Metric
                    label="Time to flood"
                    value={
                      detail.segment.state.timeToFloodMin === null
                        ? "—"
                        : `${detail.segment.state.timeToFloodMin}`
                    }
                    unit={detail.segment.state.timeToFloodMin === null ? "" : "min"}
                  />
                  <Metric
                    label="Recovery"
                    value={
                      detail.segment.state.recoveryMin === null
                        ? "—"
                        : formatMinutes(detail.segment.state.recoveryMin)
                    }
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
                <CardHeader eyebrow="Next 12 hours" title="Modelled water depth" />
                <div className="px-4 py-4">
                  <DepthChart points={detail.prediction.onsetCurve} />
                </div>
              </Card>

              <WhyPanel
                title="Why this prediction?"
                explanations={detail.prediction.explanations}
                limit={10}
              />

              <BlockageList blockages={detail.waterlogging.blockages} />

              {/* Infrastructure */}
              <Card>
                <CardHeader eyebrow="Infrastructure" title="What is here" />
                <dl className="divide-y divide-line">
                  <Row label="Elevation" value={`${detail.segment.elevationM} m`} />
                  <Row label="Slope" value={`${detail.segment.slopePct.toFixed(2)}%`} />
                  <Row
                    label="Drain capacity"
                    value={`${Math.round(detail.segment.state.drainCapacity * 100)}% of design`}
                  />
                  {detail.segment.majorDrain ? (
                    <Row
                      label={detail.segment.majorDrain.name}
                      value={`${Math.round(detail.segment.majorDrain.distanceM)} m away · ${Math.round(
                        detail.segment.majorDrain.siltationIndex * 100,
                      )}% silted`}
                    />
                  ) : null}
                  {detail.segment.floodplainExposure > 0.1 ? (
                    <Row
                      label="Floodplain exposure"
                      value={`${Math.round(detail.segment.floodplainExposure * 100)}%`}
                    />
                  ) : null}
                  {detail.segment.basementParking > 0 ? (
                    <Row
                      label="Basement parking"
                      value={`${detail.segment.basementParking} buildings`}
                    />
                  ) : null}
                  {detail.segment.pumpStations > 0 ? (
                    <Row
                      label="Pumping stations"
                      value={String(detail.segment.pumpStations)}
                    />
                  ) : null}
                  <Row
                    label="People exposed"
                    value={detail.segment.populationExposure.toLocaleString()}
                  />
                </dl>
              </Card>

              {/* Hotspot register */}
              {detail.segment.hotspot ? (
                <Card>
                  <CardHeader
                    eyebrow="Waterlogging register"
                    title={detail.segment.hotspot.name}
                  />
                  <div className="px-4 py-3">
                    <p className="text-[12.5px] leading-relaxed text-fg-muted">
                      {detail.segment.hotspot.note}
                    </p>
                    <p className="mt-2 text-[11px] text-fg-faint">
                      Typically {detail.segment.hotspot.typicalDepthCm} cm for about{" "}
                      {detail.segment.hotspot.typicalDurationHr} hours ·{" "}
                      {detail.segment.hotspot.source}
                    </p>
                  </div>
                </Card>
              ) : null}

              {/* History */}
              {detail.history.length > 0 ? (
                <Card>
                  <CardHeader eyebrow="Recorded events" title="Flood history" />
                  <ul className="divide-y divide-line">
                    {detail.history.map((event) => (
                      <li
                        key={event.date}
                        className="flex items-baseline justify-between px-4 py-2 text-[12px]"
                      >
                        <span className="numeric text-fg-muted">{event.date}</span>
                        <span className="numeric text-fg">
                          {event.depthCm} cm · {event.durationHr} hr
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {/* Reports */}
              <Card>
                <CardHeader
                  eyebrow="Live learning"
                  title="Report conditions here"
                  right={
                    detail.reports.length > 0 ? (
                      <Badge tone="signal">{detail.reports.length}</Badge>
                    ) : null
                  }
                />
                <div className="px-4 py-3">
                  {submitted ? (
                    <p className="text-[12px] text-risk-safe">
                      Thank you — the prediction for this road has been updated and
                      your report is recorded against what was forecast.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-1.5">
                    {REPORT_OPTIONS.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() =>
                          setReportType(reportType === option.type ? null : option.type)
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                          reportType === option.type
                            ? "border-signal-500 bg-signal-500/15 text-signal-300"
                            : "border-line bg-ink-850 text-fg-muted hover:text-fg"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {reportType ? (
                    <div className="mt-3 space-y-2">
                      {needsDepth ? (
                        <input
                          type="number"
                          min={0}
                          max={400}
                          value={depth}
                          onChange={(e) => setDepth(e.target.value)}
                          placeholder="Depth in cm (optional)"
                          className="numeric w-full rounded-lg border border-line bg-ink-850 px-2.5 py-2 text-[12.5px] outline-none focus:border-signal-500"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={submitReport}
                        disabled={submitting}
                        className="w-full rounded-lg bg-signal-500 px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-signal-400 disabled:opacity-50"
                      >
                        {submitting ? "Sending…" : "Submit report"}
                      </button>
                    </div>
                  ) : null}

                  {detail.reports.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                      {detail.reports.slice(0, 5).map((report) => (
                        <li key={report.id} className="text-[11.5px] text-fg-muted">
                          <span className="capitalize">
                            {report.type.replace("_", " ")}
                          </span>
                          {report.depthCm !== null ? ` · ${report.depthCm} cm` : ""}
                          <span className="ml-1.5 text-fg-faint">
                            {timeAgo(report.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 border-t border-line pt-3 text-[11px] text-fg-faint">
                      No reports from this road yet. Reports change the prediction
                      immediately and are decayed over time.
                    </p>
                  )}
                </div>
              </Card>

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
  if (points.length < 2) return <Empty>No depth curve available.</Empty>;

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
        aria-label="Modelled water depth over the next twelve hours"
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
        <span>Now</span>
        <span className="numeric">Peak {maxDepth.toFixed(0)} cm</span>
        <span>+{Math.round(maxMin / 60)} hr</span>
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-fg-faint">
        <Legend color="#e8b62c" label="8 cm — standing water" />
        {maxDepth > 24 ? <Legend color="#e8503a" label="30 cm — impassable" /> : null}
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

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = minutes / 60;
  return hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d`;
}

function timeAgo(iso: string): string {
  const min = (Date.now() - Date.parse(iso)) / 60_000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)} min ago`;
  if (min < 1440) return `${Math.round(min / 60)} hr ago`;
  return `${Math.round(min / 1440)} d ago`;
}
