"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  Badge,
  Card,
  CardHeader,
  ConfidenceMeter,
  Empty,
  Metric,
  RiskPill,
  Skeleton,
} from "@/components/ui/primitives";
import { SourcePanel, WhyPanel, type ExplanationDto, type SourceUsageDto } from "@/components/app/panels";
import type { MapDrain, MapMarker, MapSegment } from "@/components/map/RiskMap";

const RiskMap = dynamic(() => import("@/components/map/RiskMap"), {
  ssr: false,
  loading: () => <div className="grid-backdrop h-full w-full bg-ink-950" />,
});

interface GovPayload {
  city: {
    name: string;
    center: { lat: number; lng: number };
    bounds: [number, number, number, number];
  };
  scenario: string;
  computedAt: string;
  insights: {
    highRiskRoads: {
      segmentId: string;
      name: string;
      corridor: string;
      probability: number;
      peakDepthCm: number;
      riskLevel: string;
      peopleExposed: number;
      timeToImpassableMin: number | null;
      recoveryMin: number | null;
      isHotspot: boolean;
      hotspotName: string | null;
      criticalFacilities: string[];
    }[];
    drainFailures: {
      segmentId: string;
      roadName: string;
      drainName: string;
      drainDistanceM: number;
      siltationPct: number;
      overflowLikelihood: number;
      peopleAffected: number;
      reason: string;
    }[];
    deployments: {
      rank: number;
      segmentId: string;
      location: string;
      midpoint: { lat: number; lng: number };
      pumps: number;
      teams: number;
      deployByMin: number | null;
      priority: string;
      rationale: string;
      peopleProtected: number;
      existingPumps: number;
    }[];
    hotspots: {
      id: string;
      name: string;
      kind: string;
      severity: string;
      at: { lat: number; lng: number };
      worstDepthCm: number;
      probability: number;
      peopleExposed: number;
      source: string;
    }[];
    citizenReports: {
      id: string;
      type: string;
      segmentId: string;
      depthCm: number | null;
      note: string | null;
      createdAt: string;
      at: { lat: number; lng: number };
    }[];
    totals: {
      roadsAtRisk: number;
      roadsImpassable: number;
      peopleExposed: number;
      underpassesAtRisk: number;
      basementsAtRisk: number;
      pumpsRecommended: number;
      teamsRecommended: number;
    };
  };
  explanations: ExplanationDto[];
  confidence: { score: number; band: string; limitations: string[] };
  segments: MapSegment[];
  drains: MapDrain[];
  gauges: {
    station: { name: string; river: string; warningLevelM: number; dangerLevelM: number };
    levelM: number;
    status: string;
    trendM24h: number;
    note: string;
  }[];
  controlRooms: { name: string; authority: string; phone: string[]; note?: string }[];
  signalSources: SourceUsageDto[];
}

const SCENARIOS = [
  { id: "live", label: "Live forecast" },
  { id: "monsoon-evening", label: "Evening monsoon cell" },
  { id: "cloudburst", label: "Cloudburst" },
  { id: "sustained-depression", label: "Sustained depression" },
  { id: "clear", label: "Dry baseline" },
];

type Panel = "deployment" | "roads" | "drains" | "hotspots" | "reports";

/**
 * Flood operations dashboard.
 *
 * Same predictions as the citizen app, reframed around a different question. A
 * citizen asks whether they can get there; a control room asks where the pumps
 * go and what fails next. Everything here is ranked by people affected rather
 * than by depth, because a metre of water on an empty service road matters less
 * than thirty centimetres across an arterial carrying twenty thousand people.
 */
export default function GovDashboard() {
  const [data, setData] = useState<GovPayload | null>(null);
  const [scenario, setScenario] = useState("live");
  const [panel, setPanel] = useState<Panel>("deployment");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/gov/insights?scenario=${scenario}`);
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as GovPayload);
      setError(null);
    } catch {
      setError("Could not load operational data.");
    }
  }, [scenario]);

  useEffect(() => {
    void load();
  }, [load]);

  // Operations needs a picture that does not go stale while nobody is clicking.
  useEffect(() => {
    const timer = setInterval(() => void load(), 120_000);
    return () => clearInterval(timer);
  }, [load]);

  const markers: MapMarker[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.insights.deployments.map((d) => ({
        id: `dep_${d.segmentId}`,
        at: d.midpoint,
        label: `${d.location} — ${d.pumps} pumps, ${d.teams} teams`,
        kind: "hotspot" as const,
      })),
      ...data.insights.citizenReports.map((r) => ({
        id: `rep_${r.id}`,
        at: r.at,
        label: `${r.type.replace("_", " ")}${r.depthCm ? ` · ${r.depthCm} cm` : ""}`,
        kind: "report" as const,
      })),
    ];
  }, [data]);

  const signOut = async () => {
    await fetch("/api/gov/auth", { method: "DELETE" });
    window.location.href = "/";
  };

  return (
    <div className="flex h-dvh flex-col bg-ink-950">
      <header className="glass z-30 flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          FloodPilot
        </Link>
        <Badge tone="danger">Operations</Badge>
        <span className="hidden text-[11px] text-fg-faint sm:inline">
          {data?.city.name ?? "Delhi NCR"} · flood control
        </span>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="rounded-lg border border-line bg-ink-850 px-2.5 py-1.5 text-[12px] outline-none focus:border-signal-500"
            aria-label="Scenario"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-fg-muted transition-colors hover:text-fg"
          >
            Sign out
          </button>
        </div>
      </header>

      {error ? (
        <div className="shrink-0 border-b border-risk-severe/30 bg-risk-severe/10 px-4 py-2 text-[12px] text-risk-severe">
          {error}
        </div>
      ) : null}

      {!data ? (
        <div className="grid flex-1 place-items-center p-8">
          <Skeleton className="h-64 w-full max-w-4xl" />
        </div>
      ) : (
        <>
          {/* Top metrics */}
          <div className="grid shrink-0 grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4 lg:grid-cols-7">
            <Tile
              label="Roads at risk"
              value={data.insights.totals.roadsAtRisk}
              tone={data.insights.totals.roadsAtRisk > 0 ? "risk" : "safe"}
            />
            <Tile
              label="Impassable"
              value={data.insights.totals.roadsImpassable}
              tone={data.insights.totals.roadsImpassable > 0 ? "risk" : "safe"}
            />
            <Tile
              label="People exposed"
              value={compact(data.insights.totals.peopleExposed)}
            />
            <Tile label="Underpasses" value={data.insights.totals.underpassesAtRisk} />
            <Tile label="Basements" value={data.insights.totals.basementsAtRisk} />
            <Tile
              label="Pumps to deploy"
              value={data.insights.totals.pumpsRecommended}
              tone="signal"
            />
            <Tile
              label="Teams to deploy"
              value={data.insights.totals.teamsRecommended}
              tone="signal"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Map */}
            <main className="relative min-h-[300px] flex-1">
              <RiskMap
                center={data.city.center}
                bounds={data.city.bounds}
                segments={data.segments}
                drains={data.drains}
                markers={markers}
                selectedSegmentId={selectedSegmentId}
                onSelectSegment={setSelectedSegmentId}
              />
              <div className="glass pointer-events-none absolute bottom-4 left-4 z-20 rounded-xl px-3 py-2.5">
                <p className="eyebrow mb-2">Live flood heatmap</p>
                <div className="flex items-center gap-1">
                  {["safe", "low", "moderate", "high", "severe", "critical"].map(
                    (level) => (
                      <span
                        key={level}
                        className="h-1.5 w-7 rounded-full"
                        style={{ background: RISK_COLORS[level] }}
                      />
                    ),
                  )}
                </div>
                <p className="mt-2 text-[10px] text-fg-faint">
                  Red pins: recommended deployments · Amber pins: citizen reports
                </p>
              </div>
            </main>

            {/* Operational panels */}
            <aside className="shrink-0 overflow-y-auto border-line lg:w-[520px] lg:border-l">
              <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
                {(
                  [
                    ["deployment", "Deployment"],
                    ["roads", "High-risk roads"],
                    ["drains", "Drain failures"],
                    ["hotspots", "Hotspots"],
                    ["reports", "Citizen reports"],
                  ] as [Panel, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPanel(id)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                      panel === id
                        ? "bg-ink-800 text-fg"
                        : "text-fg-faint hover:text-fg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-4 p-3">
                {panel === "deployment" ? (
                  <DeploymentPanel data={data} onSelect={setSelectedSegmentId} />
                ) : null}
                {panel === "roads" ? (
                  <RoadsPanel data={data} onSelect={setSelectedSegmentId} />
                ) : null}
                {panel === "drains" ? (
                  <DrainPanel data={data} onSelect={setSelectedSegmentId} />
                ) : null}
                {panel === "hotspots" ? <HotspotPanel data={data} /> : null}
                {panel === "reports" ? <ReportsPanel data={data} /> : null}

                <WhyPanel
                  title="Why these priorities?"
                  explanations={data.explanations}
                />

                <Card>
                  <CardHeader eyebrow="River" title="Yamuna gauges" />
                  {data.gauges.length === 0 ? (
                    <Empty>No gauge configured for this city.</Empty>
                  ) : (
                    <ul className="divide-y divide-line">
                      {data.gauges.map((gauge) => (
                        <li key={gauge.station.name} className="px-4 py-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[12.5px] font-medium">
                              {gauge.station.name}
                            </p>
                            <span className="numeric text-sm font-semibold">
                              {gauge.levelM.toFixed(2)} m
                            </span>
                          </div>
                          <div className="mt-2 flex gap-4 text-[11px] text-fg-faint">
                            <span>
                              Warning{" "}
                              <span className="numeric">
                                {gauge.station.warningLevelM}
                              </span>
                            </span>
                            <span>
                              Danger{" "}
                              <span className="numeric">
                                {gauge.station.dangerLevelM}
                              </span>
                            </span>
                            <span>
                              24 hr{" "}
                              <span className="numeric">
                                {gauge.trendM24h >= 0 ? "+" : ""}
                                {gauge.trendM24h.toFixed(2)} m
                              </span>
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-snug text-fg-faint">
                            {gauge.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <div className="px-4 py-3">
                    <ConfidenceMeter
                      score={data.confidence.score}
                      band={data.confidence.band}
                      limitations={data.confidence.limitations}
                    />
                  </div>
                </Card>

                <SourcePanel sources={data.signalSources} />

                <Card>
                  <CardHeader eyebrow="Escalation" title="Control rooms" />
                  <ul className="divide-y divide-line">
                    {data.controlRooms.map((room) => (
                      <li key={room.name} className="px-4 py-2.5">
                        <p className="text-[12.5px] font-medium">{room.name}</p>
                        <p className="text-[11px] text-fg-faint">{room.authority}</p>
                        <p className="numeric mt-1 text-[12px] text-signal-300">
                          {room.phone.join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DeploymentPanel({
  data,
  onSelect,
}: {
  data: GovPayload;
  onSelect: (id: string) => void;
}) {
  const { deployments } = data.insights;
  if (deployments.length === 0) {
    return <Empty>No location currently meets the threshold for deployment.</Empty>;
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Ranked by people protected"
        title="Resource deployment"
        right={
          <Badge tone="signal">
            {data.insights.totals.pumpsRecommended} pumps
          </Badge>
        }
      />
      <ol className="divide-y divide-line">
        {deployments.map((deployment) => (
          <li key={deployment.segmentId}>
            <button
              type="button"
              onClick={() => onSelect(deployment.segmentId)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-ink-800/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className="numeric text-fg-faint">{deployment.rank}</span>
                    <span className="truncate">{deployment.location}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-fg-faint">
                    Protects ~{compact(deployment.peopleProtected)} people
                    {deployment.existingPumps > 0
                      ? ` · ${deployment.existingPumps} pumps already on site`
                      : ""}
                  </p>
                </div>
                <Badge
                  tone={
                    deployment.priority === "immediate"
                      ? "danger"
                      : deployment.priority === "high"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {deployment.priority}
                </Badge>
              </div>

              <div className="mt-2 flex gap-5">
                <span className="numeric text-[12px] text-fg-muted">
                  {deployment.pumps} pumps
                </span>
                <span className="numeric text-[12px] text-fg-muted">
                  {deployment.teams} teams
                </span>
                {deployment.deployByMin !== null ? (
                  <span className="numeric text-[12px] text-risk-high">
                    by +{deployment.deployByMin} min
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-[11px] leading-snug text-fg-muted">
                {deployment.rationale}
              </p>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RoadsPanel({
  data,
  onSelect,
}: {
  data: GovPayload;
  onSelect: (id: string) => void;
}) {
  const roads = data.insights.highRiskRoads;
  if (roads.length === 0) return <Empty>No road is currently at risk.</Empty>;

  return (
    <Card>
      <CardHeader eyebrow="Ranked by exposure" title="High-risk roads" />
      <ul className="divide-y divide-line">
        {roads.map((road) => (
          <li key={road.segmentId}>
            <button
              type="button"
              onClick={() => onSelect(road.segmentId)}
              className="w-full px-4 py-2.5 text-left transition-colors hover:bg-ink-800/70"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-[12.5px] font-medium">{road.name}</p>
                <RiskPill level={road.riskLevel} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-faint">
                <span className="numeric">
                  {Math.round(road.probability * 100)}% · {road.peakDepthCm.toFixed(0)} cm
                </span>
                <span className="numeric">{compact(road.peopleExposed)} people</span>
                {road.timeToImpassableMin !== null ? (
                  <span className="numeric text-risk-high">
                    impassable +{road.timeToImpassableMin} min
                  </span>
                ) : null}
                {road.recoveryMin ? (
                  <span className="numeric">clears in {formatMin(road.recoveryMin)}</span>
                ) : null}
              </div>
              {road.criticalFacilities.length > 0 ? (
                <p className="mt-1 text-[11px] text-fg-muted">
                  Cuts access to {road.criticalFacilities.join(", ")}
                </p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DrainPanel({
  data,
  onSelect,
}: {
  data: GovPayload;
  onSelect: (id: string) => void;
}) {
  const failures = data.insights.drainFailures;
  if (failures.length === 0) {
    return <Empty>No drain is currently predicted to surcharge.</Empty>;
  }

  return (
    <Card>
      <CardHeader eyebrow="Predicted failures" title="Drainage" />
      <ul className="divide-y divide-line">
        {failures.map((failure) => (
          <li key={failure.segmentId}>
            <button
              type="button"
              onClick={() => onSelect(failure.segmentId)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-ink-800/70"
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <p className="truncate text-[12.5px] font-medium">
                  {failure.drainName}
                </p>
                <span className="numeric shrink-0 text-[12px] font-semibold text-risk-high">
                  {Math.round(failure.overflowLikelihood * 100)}%
                </span>
              </div>
              <Bar value={failure.overflowLikelihood} color="#f08a3c" />
              <p className="mt-2 text-[11.5px] text-fg-muted">
                at {failure.roadName}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-fg-faint">
                {failure.reason}
              </p>
              <p className="numeric mt-1 text-[11px] text-fg-faint">
                {failure.siltationPct}% silted · {failure.drainDistanceM} m from the road
                · {compact(failure.peopleAffected)} people
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HotspotPanel({ data }: { data: GovPayload }) {
  const hotspots = data.insights.hotspots;
  if (hotspots.length === 0) {
    return <Empty>No registered hotspot is currently active.</Empty>;
  }

  return (
    <Card>
      <CardHeader eyebrow="Waterlogging register" title="Flood hotspots" />
      <ul className="divide-y divide-line">
        {hotspots.map((hotspot) => (
          <li key={hotspot.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12.5px] font-medium">{hotspot.name}</p>
              <Badge
                tone={
                  hotspot.severity === "chronic"
                    ? "danger"
                    : hotspot.severity === "recurring"
                      ? "warn"
                      : "neutral"
                }
              >
                {hotspot.severity}
              </Badge>
            </div>
            <p className="numeric mt-1 text-[11px] text-fg-faint">
              {Math.round(hotspot.probability * 100)}% ·{" "}
              {hotspot.worstDepthCm.toFixed(0)} cm ·{" "}
              {compact(hotspot.peopleExposed)} people ·{" "}
              <span className="capitalize">{hotspot.kind.replace("_", " ")}</span>
            </p>
            <p className="mt-1 text-[10.5px] leading-snug text-fg-faint">
              {hotspot.source}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReportsPanel({ data }: { data: GovPayload }) {
  const reports = data.insights.citizenReports;
  if (reports.length === 0) {
    return (
      <Empty>
        No citizen reports in the last 24 hours. Reports submitted in the app appear
        here and feed the prediction.
      </Empty>
    );
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Last 24 hours"
        title="Citizen reports"
        right={<Badge tone="signal">{reports.length}</Badge>}
      />
      <ul className="divide-y divide-line">
        {reports.map((report) => (
          <li key={report.id} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12.5px] font-medium capitalize">
                {report.type.replace("_", " ")}
                {report.depthCm !== null ? (
                  <span className="numeric ml-2 text-fg-muted">
                    {report.depthCm} cm
                  </span>
                ) : null}
              </p>
              <span className="text-[11px] text-fg-faint">
                {timeAgo(report.createdAt)}
              </span>
            </div>
            <p className="text-[11px] text-fg-faint">{report.segmentId}</p>
            {report.note ? (
              <p className="mt-1 text-[11.5px] text-fg-muted">{report.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function Tile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "risk" | "safe" | "signal";
}) {
  const color =
    tone === "risk"
      ? "text-risk-severe"
      : tone === "safe"
        ? "text-risk-safe"
        : tone === "signal"
          ? "text-signal-300"
          : "text-fg";

  return (
    <div className="bg-ink-900 px-4 py-3">
      <p className="eyebrow mb-1.5">{label}</p>
      <p className={`numeric text-xl font-semibold leading-none ${color}`}>{value}</p>
    </div>
  );
}

const RISK_COLORS: Record<string, string> = {
  safe: "#2fbf6f",
  low: "#8fc93a",
  moderate: "#e8b62c",
  high: "#f08a3c",
  severe: "#e8503a",
  critical: "#b32b1d",
};

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatMin(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = minutes / 60;
  return hrs < 24 ? `${hrs.toFixed(1)} hr` : `${(hrs / 24).toFixed(1)} d`;
}

function timeAgo(iso: string): string {
  const min = (Date.now() - Date.parse(iso)) / 60_000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)} min ago`;
  return `${Math.round(min / 60)} hr ago`;
}

// Metric is re-exported for parity with the citizen app's panel imports.
void Metric;
