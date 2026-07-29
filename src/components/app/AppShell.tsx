"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  AgentTracePanel,
  AlertList,
  BlockageList,
  SourcePanel,
  TimelinePanel,
  WhyPanel,
  type AgentTraceDto,
  type AlertDto,
  type ExplanationDto,
  type SourceUsageDto,
  type TimelineEventDto,
} from "./panels";
import {
  DecisionCard,
  RouteComparison,
  VehicleCard,
  type ComparisonDto,
  type DecisionOptionDto,
  type SurvivabilityDto,
} from "./route-vehicle";
import { SegmentSheet } from "./SegmentSheet";
import { JourneyForm, type JourneyFormState } from "./JourneyForm";
import type { MapDrain, MapMarker, MapRoute, MapSegment } from "@/components/map/RiskMap";

const RiskMap = dynamic(() => import("@/components/map/RiskMap"), {
  ssr: false,
  loading: () => <div className="grid-backdrop h-full w-full bg-ink-950" />,
});

/* -------------------------------------------------------------------------- */
/*  Types matching the API                                                    */
/* -------------------------------------------------------------------------- */

interface CityPayload {
  city: {
    id: string;
    name: string;
    center: { lat: number; lng: number };
    bounds: [number, number, number, number];
    floodCharacter: string;
  };
  cities: { id: string; name: string; isDefault: boolean }[];
  nodes: {
    id: string;
    name: string;
    at: { lat: number; lng: number };
    ward: string;
    metro: { station: string; line: string; walkM: number } | null;
  }[];
  drains: MapDrain[];
  gauges: {
    id: string;
    name: string;
    river: string;
    warningLevelM: number;
    dangerLevelM: number;
    at: { lat: number; lng: number };
  }[];
  hotspots: {
    id: string;
    name: string;
    at: { lat: number; lng: number };
    severity: string;
    kind: string;
  }[];
  scenarios: { id: string; label: string; blurb: string; simulated: boolean }[];
  vehicles: {
    id: string;
    manufacturer: string;
    model: string;
    bodyType: string;
    groundClearanceMm: number;
    years: [number, number];
    fuelTypes: string[];
    driveType: string;
    popularInDelhi?: boolean;
  }[];
  journeyPurposes: { id: string; label: string; blurb: string }[];
}

interface PredictPayload {
  segments: (MapSegment & {
    corridor: string;
    populationExposure: number;
    state: MapSegment["state"] & {
      confidence: number;
      confidenceBand: string;
      recoveryMin: number | null;
      drainOverflowLikelihood: number;
    };
  })[];
  summary: {
    segmentsAtRisk: number;
    segmentsImpassable: number;
    peakDepthCm: number;
    peakProbability: number;
    meanConfidence: number;
    peopleExposed: number;
    underpassesAtRisk: number;
    hotspotsActive: number;
    nextOnsetMin: number | null;
    worstSegment: { id: string; name: string; depthCm: number } | null;
  };
  signalSources: SourceUsageDto[];
  gauges: {
    station: { name: string; river: string; dangerLevelM: number };
    levelM: number;
    status: string;
  }[];
  computedAt: string;
  degraded: boolean;
}

interface BriefPayload {
  comparison: ComparisonDto | null;
  timeline: {
    events: TimelineEventDto[];
    recommendedDepartureClock: string | null;
    latestSafeDepartureMin: number | null;
    noSafeWindow: boolean;
  };
  decision: {
    primary: DecisionOptionDto;
    alternatives: DecisionOptionDto[];
    parallel: DecisionOptionDto[];
    emergencyContacts: { name: string; authority: string; phone: string[] }[];
  };
  survivability: SurvivabilityDto | null;
  alerts: AlertDto[];
  trace: AgentTraceDto[];
  sources: SourceUsageDto[];
}

type Tab = "journey" | "city";

const DEFAULT_FORM: JourneyFormState = {
  origin: "dwarka",
  destination: "ito",
  vehicleId: "swift",
  vehicleYear: 2021,
  tyreType: "standard",
  purpose: "commute",
  urgency: "flexible",
  canWorkRemotely: true,
  departInMin: 0,
};

/* -------------------------------------------------------------------------- */

export default function AppShell() {
  const [cityData, setCityData] = useState<CityPayload | null>(null);
  const [predict, setPredict] = useState<PredictPayload | null>(null);
  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [scenario, setScenario] = useState("live");
  const [form, setForm] = useState<JourneyFormState>(DEFAULT_FORM);
  const [tab, setTab] = useState<Tab>("journey");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [showDrains, setShowDrains] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Static city data ────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/city")
      .then((r) => r.json())
      .then((data: CityPayload) => {
        if (!cancelled) setCityData(data);
      })
      .catch(() => setError("Could not load the city network."));
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── City-wide prediction ────────────────────────────────────────────── */
  const loadPrediction = useCallback(async () => {
    try {
      const res = await fetch(`/api/predict?scenario=${scenario}`);
      if (!res.ok) throw new Error(String(res.status));
      setPredict((await res.json()) as PredictPayload);
    } catch {
      setError("Could not load current flood conditions.");
    }
  }, [scenario]);

  useEffect(() => {
    void loadPrediction();
  }, [loadPrediction]);

  /* ── Journey brief ───────────────────────────────────────────────────── */
  const planJourney = useCallback(async () => {
    if (form.origin === form.destination) {
      setError("Pick two different points.");
      return;
    }
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch("/api/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          origin: form.origin,
          destination: form.destination,
          departInMin: form.departInMin,
          vehicle: {
            catalogId: form.vehicleId,
            year: form.vehicleYear,
            tyreType: form.tyreType,
          },
          journey: {
            purpose: form.purpose,
            urgency: form.urgency,
            canWorkRemotely: form.canWorkRemotely,
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setBrief((await res.json()) as BriefPayload);
      setTab("journey");
    } catch {
      setError("Journey planning failed. Try again.");
    } finally {
      setPlanning(false);
    }
  }, [form, scenario]);

  // Plan once the network is available, so the app opens with something real
  // on screen rather than an empty state waiting to be configured.
  useEffect(() => {
    if (cityData && !brief && !planning) void planJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityData]);

  // Re-plan when the scenario changes; conditions have changed underneath.
  useEffect(() => {
    if (cityData && brief) void planJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  /* ── Map layers ──────────────────────────────────────────────────────── */

  const routes: MapRoute[] = useMemo(() => {
    if (!brief?.comparison) return [];
    const { fastest, safest } = brief.comparison;
    const geometryOf = (legs: { segmentId: string }[]) => {
      const points: { lat: number; lng: number }[] = [];
      for (const leg of legs) {
        const segment = predict?.segments.find((s) => s.id === leg.segmentId);
        if (!segment) continue;
        points.push(...(points.length ? segment.geometry.slice(1) : segment.geometry));
      }
      return points;
    };

    const layers: MapRoute[] = [];
    if (!brief.comparison.identical) {
      layers.push({
        id: "fastest",
        geometry: geometryOf(fastest.legs),
        color: "#f08a3c",
        dashed: true,
        width: 4,
      });
    }
    layers.push({
      id: "safest",
      geometry: geometryOf(safest.legs),
      color: brief.comparison.safeRouteExists ? "#2fbf6f" : "#e8503a",
      width: 6,
    });
    return layers;
  }, [brief, predict]);

  const markers: MapMarker[] = useMemo(() => {
    if (!cityData) return [];
    const out: MapMarker[] = [];
    const origin = cityData.nodes.find((n) => n.id === form.origin);
    const destination = cityData.nodes.find((n) => n.id === form.destination);
    if (origin) out.push({ id: "o", at: origin.at, label: origin.name, kind: "origin" });
    if (destination)
      out.push({ id: "d", at: destination.at, label: destination.name, kind: "destination" });
    for (const gauge of cityData.gauges) {
      out.push({ id: gauge.id, at: gauge.at, label: `${gauge.name} · ${gauge.river}`, kind: "gauge" });
    }
    return out;
  }, [cityData, form.origin, form.destination]);

  const selectedSegment = predict?.segments.find((s) => s.id === selectedSegmentId);

  /* ── Render ──────────────────────────────────────────────────────────── */

  const scenarioMeta = cityData?.scenarios.find((s) => s.id === scenario);

  return (
    <div className="flex h-dvh flex-col bg-ink-950">
      {/* Top bar */}
      <header className="glass z-30 flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">FloodPilot</span>
        </Link>

        <span className="hidden text-[11px] text-fg-faint sm:inline">
          {cityData?.city.name ?? "Delhi NCR"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {scenarioMeta?.simulated ? (
            <Badge tone="warn">Simulated scenario</Badge>
          ) : (
            <Badge tone="good">Live data</Badge>
          )}

          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="rounded-lg border border-line bg-ink-850 px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-signal-500"
            aria-label="Rainfall scenario"
          >
            {cityData?.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? (
        <div className="shrink-0 border-b border-risk-severe/30 bg-risk-severe/10 px-4 py-2 text-[12px] text-risk-severe">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left: journey controls */}
        <aside className="shrink-0 overflow-y-auto border-line lg:w-[320px] lg:border-r">
          {cityData ? (
            <JourneyForm
              nodes={cityData.nodes}
              vehicles={cityData.vehicles}
              purposes={cityData.journeyPurposes}
              value={form}
              onChange={setForm}
              onSubmit={planJourney}
              busy={planning}
            />
          ) : (
            <div className="space-y-3 p-4">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          )}
        </aside>

        {/* Centre: map */}
        <main className="relative min-h-[320px] flex-1">
          {cityData && predict ? (
            <RiskMap
              center={cityData.city.center}
              bounds={cityData.city.bounds}
              segments={predict.segments}
              drains={cityData.drains}
              routes={routes}
              markers={markers}
              selectedSegmentId={selectedSegmentId}
              showDrains={showDrains}
              onSelectSegment={setSelectedSegmentId}
            />
          ) : (
            <div className="grid-backdrop h-full w-full" />
          )}

          {/* Map legend and layer toggle */}
          <div className="glass pointer-events-auto absolute bottom-4 left-4 z-20 rounded-xl px-3 py-2.5">
            <p className="eyebrow mb-2">Flood risk</p>
            <div className="flex items-center gap-1">
              {["safe", "low", "moderate", "high", "severe", "critical"].map((level) => (
                <span
                  key={level}
                  className="h-1.5 w-6 rounded-full"
                  style={{ background: RISK_COLORS[level] }}
                  title={level}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-fg-faint">
              <span>Safe</span>
              <span>Critical</span>
            </div>
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[11px] text-fg-muted">
              <input
                type="checkbox"
                checked={showDrains}
                onChange={(e) => setShowDrains(e.target.checked)}
                className="accent-signal-500"
              />
              Trunk drains &amp; Yamuna
            </label>
          </div>

          {/* City status strip */}
          {predict ? (
            <div className="glass pointer-events-none absolute right-4 top-4 z-20 rounded-xl px-4 py-3">
              <div className="flex gap-6">
                <Metric
                  label="Roads at risk"
                  value={predict.summary.segmentsAtRisk}
                  size="sm"
                  tone={predict.summary.segmentsAtRisk > 0 ? "risk" : "safe"}
                />
                <Metric
                  label="Deepest"
                  value={predict.summary.peakDepthCm.toFixed(0)}
                  unit="cm"
                  size="sm"
                />
                <Metric
                  label="People exposed"
                  value={compact(predict.summary.peopleExposed)}
                  size="sm"
                />
              </div>
            </div>
          ) : null}
        </main>

        {/* Right: intelligence */}
        <aside className="shrink-0 overflow-y-auto border-line lg:w-[400px] lg:border-l">
          <div className="flex gap-1 border-b border-line px-3 py-2">
            {(["journey", "city"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                  tab === t
                    ? "bg-ink-800 text-fg"
                    : "text-fg-faint hover:text-fg-muted"
                }`}
              >
                {t === "journey" ? "This journey" : "City conditions"}
              </button>
            ))}
          </div>

          <div className="space-y-4 p-3">
            {tab === "journey" ? (
              brief ? (
                <>
                  <DecisionCard
                    primary={brief.decision.primary}
                    alternatives={brief.decision.alternatives}
                    parallel={brief.decision.parallel}
                    emergencyContacts={brief.decision.emergencyContacts}
                  />

                  <AlertList alerts={brief.alerts.slice(1)} />

                  {brief.comparison ? (
                    <RouteComparison
                      comparison={brief.comparison}
                      onSelectLeg={setSelectedSegmentId}
                    />
                  ) : (
                    <Empty>
                      No route could be planned between these two junctions.
                    </Empty>
                  )}

                  {brief.survivability ? (
                    <VehicleCard
                      vehicleName={vehicleName(cityData, form.vehicleId, form.vehicleYear)}
                      survivability={brief.survivability}
                    />
                  ) : null}

                  <TimelinePanel
                    events={brief.timeline.events}
                    recommendedDepartureClock={brief.timeline.recommendedDepartureClock}
                    latestSafeDepartureMin={brief.timeline.latestSafeDepartureMin}
                    noSafeWindow={brief.timeline.noSafeWindow}
                  />

                  <WhyPanel
                    explanations={
                      (brief.comparison?.explanations ?? []) as ExplanationDto[]
                    }
                  />

                  <SourcePanel sources={brief.sources} />
                  <AgentTracePanel trace={brief.trace} />
                </>
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-40" />
                  <Skeleton className="h-52" />
                </div>
              )
            ) : predict ? (
              <CityConditions predict={predict} onSelect={setSelectedSegmentId} />
            ) : (
              <Skeleton className="h-64" />
            )}
          </div>
        </aside>
      </div>

      {selectedSegment ? (
        <SegmentSheet
          segmentId={selectedSegment.id}
          scenario={scenario}
          onClose={() => setSelectedSegmentId(null)}
          onReported={() => {
            void loadPrediction();
            void planJourney();
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CityConditions({
  predict,
  onSelect,
}: {
  predict: PredictPayload;
  onSelect: (id: string) => void;
}) {
  const worst = [...predict.segments]
    .sort((a, b) => b.state.peakDepthCm - a.state.peakDepthCm)
    .slice(0, 12);

  return (
    <>
      <Card>
        <CardHeader
          eyebrow="Right now"
          title="City conditions"
          right={
            predict.degraded ? <Badge tone="warn">Degraded inputs</Badge> : null
          }
        />
        <div className="grid grid-cols-2 gap-4 px-4 py-4">
          <Metric
            label="Roads at risk"
            value={predict.summary.segmentsAtRisk}
            tone={predict.summary.segmentsAtRisk > 0 ? "risk" : "safe"}
          />
          <Metric
            label="Impassable"
            value={predict.summary.segmentsImpassable}
            tone={predict.summary.segmentsImpassable > 0 ? "risk" : "safe"}
          />
          <Metric
            label="Underpasses at risk"
            value={predict.summary.underpassesAtRisk}
          />
          <Metric label="Hotspots active" value={predict.summary.hotspotsActive} />
        </div>
        <div className="border-t border-line px-4 py-3">
          <ConfidenceMeter
            score={predict.summary.meanConfidence}
            band={
              predict.summary.meanConfidence >= 0.75
                ? "high"
                : predict.summary.meanConfidence >= 0.5
                  ? "moderate"
                  : "low"
            }
            compact
          />
        </div>
      </Card>

      {predict.gauges.length > 0 ? (
        <Card>
          <CardHeader eyebrow="River" title="Gauge readings" />
          <ul className="divide-y divide-line">
            {predict.gauges.map((gauge) => (
              <li key={gauge.station.name} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12.5px] font-medium text-fg">
                    {gauge.station.river}
                  </p>
                  <span className="numeric text-sm font-semibold text-fg">
                    {gauge.levelM.toFixed(2)} m
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-fg-faint">
                  {gauge.station.name} · danger {gauge.station.dangerLevelM} m ·{" "}
                  <span className="capitalize">{gauge.status.replace("_", " ")}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader eyebrow="Worst first" title="Highest risk roads" />
        <ul className="divide-y divide-line">
          {worst.map((segment) => (
            <li key={segment.id}>
              <button
                type="button"
                onClick={() => onSelect(segment.id)}
                className="w-full px-4 py-2.5 text-left transition-colors hover:bg-ink-800/70"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[12.5px] font-medium text-fg">
                    {segment.name}
                  </p>
                  <RiskPill level={segment.state.riskLevel} />
                </div>
                <p className="numeric mt-1 text-[11px] text-fg-faint">
                  {Math.round(segment.state.probability * 100)}% ·{" "}
                  {segment.state.peakDepthCm.toFixed(0)} cm peak
                  {segment.state.timeToImpassableMin !== null
                    ? ` · impassable in ${segment.state.timeToImpassableMin} min`
                    : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <SourcePanel sources={predict.signalSources} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

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

function vehicleName(
  cityData: CityPayload | null,
  vehicleId: string,
  year: number,
): string {
  const entry = cityData?.vehicles.find((v) => v.id === vehicleId);
  if (!entry) return "Your vehicle";
  return `${entry.manufacturer} ${entry.model} · ${year}`;
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5c3.6 4.2 6 7.6 6 10.6a6 6 0 1 1-12 0c0-3 2.4-6.4 6-10.6Z"
        stroke="var(--color-signal-400)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 14.2c1 .9 2 .9 3 0s2-.9 3 0"
        stroke="var(--color-aqua-400)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
