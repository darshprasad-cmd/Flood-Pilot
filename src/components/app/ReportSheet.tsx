"use client";

import { useState } from "react";
import { Badge, Bar, Card, CardHeader } from "@/components/ui/primitives";
import { REPORT_META, REPORT_TYPES, type ReportType, type Severity } from "@/lib/community/types";
import { useT } from "@/lib/i18n";

interface VerificationDto {
  confidence: number;
  band: string;
  verdict: string;
  actionable: boolean;
  signals: {
    key: string;
    label: string;
    agrees: boolean;
    strength: number;
    weight: number;
    detail: string;
  }[];
}

const BAND_COLOUR: Record<string, string> = {
  low: "#f08a3c",
  moderate: "#e8b62c",
  high: "#8fc93a",
  very_high: "#2fbf6f",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  severe: "Severe",
};

/**
 * Community reporting.
 *
 * The form asks only for what the chosen report type actually needs — depth for
 * water, lanes for an obstruction — because a form that asks a person standing
 * in the rain for six fields gets no reports at all.
 *
 * After submission it shows the verification: how much the report is believed
 * and, signal by signal, why. That is deliberate. A person who reports a flooded
 * road and is told "recorded, but nothing corroborates this yet" understands the
 * system far better than one who is told "thanks".
 */
export function ReportSheet({
  segmentId,
  segmentLanes,
  scenario,
  onReported,
  className = "",
}: {
  segmentId: string;
  segmentLanes: number;
  scenario: string;
  onReported: () => void;
  className?: string;
}) {
  const t = useT();
  const [type, setType] = useState<ReportType | null>(null);
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [depth, setDepth] = useState("");
  const [lanes, setLanes] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerificationDto | null>(null);

  const meta = type ? REPORT_META[type] : null;

  const submit = async () => {
    if (!type) return;
    setBusy(true);
    try {
      const position = await currentPosition();
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentId,
          type,
          severity,
          depthCm: depth ? Number(depth) : null,
          lanesBlocked: lanes ? Number(lanes) : null,
          description: description || null,
          lat: position?.lat,
          lng: position?.lng,
          scenario,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { verification: VerificationDto | null };
        setResult(data.verification);
        setType(null);
        setDepth("");
        setLanes("");
        setDescription("");
        onReported();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader eyebrow={t.report.eyebrow} title={t.report.title} />

      <div className="px-4 py-3">
        {/* Verification result from the last submission. */}
        {result ? (
          <div
            className="mb-4 rounded-lg border p-3"
            style={{
              borderColor: `${BAND_COLOUR[result.band]}44`,
              background: `${BAND_COLOUR[result.band]}0f`,
            }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold text-fg">
                Verification confidence
              </p>
              <span
                className="numeric text-[13px] font-semibold"
                style={{ color: BAND_COLOUR[result.band] }}
              >
                {Math.round(result.confidence * 100)}%
              </span>
            </div>
            <Bar value={result.confidence} color={BAND_COLOUR[result.band]} />
            <p className="mt-2 text-[11.5px] leading-snug text-fg-muted">
              {result.verdict}
            </p>
            <ul className="mt-2.5 space-y-1 border-t border-line pt-2">
              {result.signals.map((s) => (
                <li key={s.key} className="flex gap-2 text-[11px] leading-snug">
                  <span
                    className="mt-1 h-1 w-1 shrink-0 rounded-full"
                    style={{ background: s.agrees ? "#2fbf6f" : "#f08a3c" }}
                    aria-hidden
                  />
                  <span className="text-fg-faint">
                    <span className="text-fg-muted">{s.label}:</span> {s.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Type picker */}
        <div className="grid grid-cols-2 gap-1.5">
          {REPORT_TYPES.map((id) => {
            const item = REPORT_META[id];
            const active = type === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setType(active ? null : id)}
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-start text-[11.5px] font-medium transition-colors ${
                  active
                    ? "border-signal-500 bg-signal-500/15 text-signal-300"
                    : "border-line bg-ink-850 text-fg-muted hover:text-fg"
                }`}
              >
                <span aria-hidden className="text-[15px] leading-none">
                  {item.icon}
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Details, only what this type needs */}
        {meta ? (
          <div className="mt-3 space-y-3 border-t border-line pt-3">
            <div>
              <p className="eyebrow mb-1.5">Severity</p>
              <div className="flex gap-1.5">
                {(["minor", "moderate", "major", "severe"] as Severity[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`min-h-11 flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition-colors ${
                      severity === s
                        ? "border-signal-500 bg-signal-500/15 text-signal-300"
                        : "border-line bg-ink-850 text-fg-muted"
                    }`}
                  >
                    {SEVERITY_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {meta.needsDepth ? (
              <label className="block">
                <span className="eyebrow mb-1.5 block">
                  {t.report.depthPlaceholder}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={400}
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                  placeholder="e.g. 30"
                  className="numeric w-full rounded-lg border border-line bg-ink-850 px-2.5 py-2 outline-none focus:border-signal-500"
                />
              </label>
            ) : null}

            {meta.needsLanes ? (
              <label className="block">
                <span className="eyebrow mb-1.5 block">
                  Lanes blocked (of {segmentLanes})
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={segmentLanes}
                  value={lanes}
                  onChange={(e) => setLanes(e.target.value)}
                  placeholder="e.g. 2"
                  className="numeric w-full rounded-lg border border-line bg-ink-850 px-2.5 py-2 outline-none focus:border-signal-500"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="eyebrow mb-1.5 block">Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="Anything that would help somebody else decide"
                className="w-full resize-none rounded-lg border border-line bg-ink-850 px-2.5 py-2 outline-none focus:border-signal-500"
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="min-h-12 w-full rounded-lg bg-signal-500 px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal-400 disabled:opacity-50"
            >
              {busy ? t.report.sending : t.report.submit}
            </button>

            <p className="text-[10.5px] leading-snug text-fg-faint">
              Your location is used to place the report and is not stored against
              your identity. Reports are verified against rainfall, traffic and
              other reports before they move a prediction.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Best-effort GPS.
 *
 * Falls back to the segment midpoint server-side if the browser refuses or the
 * user declines — a report placed on the right road is still useful.
 */
async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 60_000 },
    );
  });
}

/* -------------------------------------------------------------------------- */

export interface ClusterDto {
  id: string;
  at: { lat: number; lng: number };
  radiusM: number;
  reportCount: number;
  reporterCount: number;
  dominantType: string;
  severity: string;
  confidence: number;
  band: string;
  lanesBlocked: number | null;
  meanDepthCm: number | null;
  locationName: string;
  inferred: {
    kind: string;
    label: string;
    likelihood: number;
    explanation: string;
    recommendation: string;
  };
}

/**
 * Detected events.
 *
 * Shows what the reports *mean* rather than the reports themselves — including,
 * where the pattern supports it, an event nobody actually reported.
 */
export function ClusterList({
  clusters,
  onSelect,
  showRecommendation = false,
  className = "",
}: {
  clusters: ClusterDto[];
  onSelect?: (cluster: ClusterDto) => void;
  showRecommendation?: boolean;
  className?: string;
}) {
  if (clusters.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader
        eyebrow="Detected from community reports"
        title="Live events"
        right={<Badge tone="signal">{clusters.length}</Badge>}
      />
      <ul className="divide-y divide-line">
        {clusters.map((cluster) => (
          <li key={cluster.id}>
            <button
              type="button"
              onClick={() => onSelect?.(cluster)}
              className="w-full px-4 py-3 text-start transition-colors hover:bg-ink-800/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-fg">
                    {cluster.inferred.label}
                  </p>
                  <p className="text-[11px] text-fg-faint">
                    {cluster.locationName}
                  </p>
                </div>
                <span
                  className="numeric shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{
                    background: `${BAND_COLOUR[cluster.band]}22`,
                    color: BAND_COLOUR[cluster.band],
                  }}
                >
                  {Math.round(cluster.confidence * 100)}%
                </span>
              </div>

              <p className="numeric mt-1.5 text-[11px] text-fg-faint">
                {cluster.reportCount} reports · {cluster.reporterCount} people ·
                within {cluster.radiusM} m
                {cluster.lanesBlocked
                  ? ` · ${cluster.lanesBlocked} lane(s) blocked`
                  : ""}
                {cluster.meanDepthCm ? ` · ~${cluster.meanDepthCm} cm` : ""}
              </p>

              <p className="mt-1.5 text-[11.5px] leading-snug text-fg-muted">
                {cluster.inferred.explanation}
              </p>

              {showRecommendation ? (
                <p className="mt-1.5 border-t border-line pt-1.5 text-[11.5px] leading-snug text-signal-300">
                  {cluster.inferred.recommendation}
                </p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
