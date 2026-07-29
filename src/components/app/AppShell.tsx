"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TodayPanel } from "./TodayPanel";
import { ClusterList, type ClusterDto } from "./ReportSheet";
import {
  LayersControl,
  defaultLayerState,
  type LayerState,
} from "@/components/map/LayersControl";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Lockup } from "@/components/brand/Logo";
import { AlertBell, AlertSheet } from "./AlertCenter";
import {
  OfflineBanner,
  ServiceWorkerRegistrar,
  UpdatedStamp,
  useOnlineState,
} from "./OfflineGuard";
import { useT } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";
import { buildWatchAlerts } from "@/lib/alerts/watch";
import { notifyNew } from "@/lib/alerts/notify";
import { warrantsNotification } from "@/lib/alerts/types";
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
    // Needed by Today to decide which roads count as "near you".
    midpoint: { lat: number; lng: number };
    state: MapSegment["state"] & {
      depthCm: number;
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

type Tab = "journey" | "city" | "community";

interface CommunityPayload {
  clusters: ClusterDto[];
  reportCount: number;
  congestionForecast: {
    segmentId: string;
    name: string;
    headline: string;
    onsetInMin: number | null;
    peakDensity: number;
    confidence: number;
    drivers: { key: string; label: string; detail: string }[];
  }[];
  signalDelays: {
    nodeId: string;
    name: string;
    estimatedDelaySec: number;
    confidence: number;
    basis: string[];
  }[];
}

/**
 * Which surface a phone is showing.
 *
 * The desktop three-column layout does not survive a 390 px viewport — stacking
 * it vertically buries the map between a long form and a long panel. On mobile
 * the map is the base layer and the other two become full-screen surfaces over
 * it, switched from a bottom bar within thumb reach.
 */
type MobilePane = "today" | "map" | "plan" | "brief";

/** Which surface the left column is showing on a wide screen. */
type LeftTab = "today" | "plan";

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

export default function AppShell({ onEditSetup }: { onEditSetup?: () => void }) {
  const t = useT();
  const { profile, update } = useProfile();
  // The app opens on the answer, not on the instrument. Somebody who has told
  // us where they live has already asked their question by opening the app.
  const [mobilePane, setMobilePane] = useState<MobilePane>("today");
  const [leftTab, setLeftTab] = useState<LeftTab>("today");
  const [cityData, setCityData] = useState<CityPayload | null>(null);
  const [predict, setPredict] = useState<PredictPayload | null>(null);
  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [scenario, setScenario] = useState("live");
  // Seeded from what onboarding was told. The first plan the app runs should
  // be the person's actual commute in their actual vehicle, not a demo.
  const [form, setForm] = useState<JourneyFormState>(() => ({
    ...DEFAULT_FORM,
    origin: profile.homeNodeId ?? DEFAULT_FORM.origin,
    destination: profile.workNodeId ?? DEFAULT_FORM.destination,
    vehicleId: profile.vehicleId ?? DEFAULT_FORM.vehicleId,
    vehicleYear: profile.vehicleYear,
    tyreType: profile.tyreType,
  }));
  const [tab, setTab] = useState<Tab>("journey");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [community, setCommunity] = useState<CommunityPayload | null>(null);
  const [layers, setLayers] = useState<LayerState>(defaultLayerState);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const online = useOnlineState();
  /**
   * Alerts already pushed to the operating system this session.
   *
   * Deliberately a ref rather than part of the stored profile: a notification
   * is a moment, not a record. After a reload, water that is still rising is
   * worth saying again.
   */
  const notifiedRef = useRef<Set<string>>(new Set());

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

  /* ── Community intelligence ──────────────────────────────────────────── */
  const loadCommunity = useCallback(async () => {
    try {
      const res = await fetch(`/api/community?scenario=${scenario}`);
      if (res.ok) setCommunity((await res.json()) as CommunityPayload);
    } catch {
      // Community intelligence is additive; the app works without it.
    }
  }, [scenario]);

  useEffect(() => {
    void loadCommunity();
  }, [loadCommunity]);

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
      // On a phone, planning is an explicit act — show the result rather than
      // leaving the user on the form wondering whether anything happened.
      setMobilePane((pane) => (pane === "plan" ? "brief" : pane));
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

    // Detected events, not raw pins — one marker per cluster.
    for (const cluster of community?.clusters ?? []) {
      const layer = LAYER_FOR_EVENT[cluster.inferred.kind] ?? "alerts";
      if (!layers[layer as keyof LayerState]) continue;
      out.push({
        id: cluster.id,
        at: cluster.at,
        label: `${cluster.inferred.label} — ${cluster.reportCount} reports from ${cluster.reporterCount} people`,
        kind: "hotspot",
      });
    }

    return out;
  }, [cityData, form.origin, form.destination, community, layers]);

  /* ── What is worth interrupting this person for ──────────────────────── */

  const watchAlerts = useMemo(
    () =>
      buildWatchAlerts({
        profile,
        nodes: cityData?.nodes ?? [],
        segments: predict?.segments ?? [],
        brief,
        gauges: predict?.gauges ?? [],
        t,
      }),
    [profile, cityData, predict, brief, t],
  );

  const unread = watchAlerts.filter((a) => !profile.seenAlertIds.includes(a.id));

  // Push the serious ones out to the operating system as they appear.
  useEffect(() => {
    const already = [...notifiedRef.current];
    notifyNew(watchAlerts, already);
    for (const alert of watchAlerts) {
      if (warrantsNotification(alert)) notifiedRef.current.add(alert.id);
    }
  }, [watchAlerts]);

  /**
   * Keep the picture current while the app sits open.
   *
   * Without this the alert layer only ever sees the conditions that existed
   * when the tab was opened, which is precisely wrong for a product whose
   * whole claim is that it tells you before the window shuts.
   */
  useEffect(() => {
    const timer = setInterval(
      () => {
        void loadPrediction();
        void loadCommunity();
      },
      5 * 60_000,
    );
    return () => clearInterval(timer);
  }, [loadPrediction, loadCommunity]);

  const selectedSegment = predict?.segments.find((s) => s.id === selectedSegmentId);

  /* ── Render ──────────────────────────────────────────────────────────── */

  const scenarioMeta = cityData?.scenarios.find((s) => s.id === scenario);

  /**
   * Progressive disclosure.
   *
   * In simple mode the working is hidden, not removed — confidence, feature
   * contributions, provenance and the agent trace are all still computed and
   * are one toggle away. Hiding a confidence score you did not earn would be
   * dishonest; hiding one from somebody who only asked whether they can get to
   * work is just good manners.
   */
  const detail = profile.detail;
  const showWorking = detail === "detailed";

  // One source of truth for what the left column renders. The phone's bottom
  // bar and the desktop tab strip both write to it, so the two never disagree
  // when a window is resized across the breakpoint mid-session.
  const showToday = leftTab === "today";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink-950">
      {/* Top bar */}
      <header className="glass safe-top z-30 flex shrink-0 items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <Link href="/">
          <Lockup size={14} />
        </Link>

        <span className="hidden items-baseline gap-2 text-[11px] text-fg-faint md:flex">
          {cityData?.city.name ?? "Delhi NCR"}
          <UpdatedStamp computedAt={predict?.computedAt} />
        </span>

        <div className="ms-auto flex items-center gap-2">
          {scenarioMeta?.simulated ? (
            <Badge tone="warn" className="hidden sm:inline-flex">
              {t.common.simulated}
            </Badge>
          ) : (
            <Badge tone="good" className="hidden sm:inline-flex">
              {t.common.live}
            </Badge>
          )}

          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="max-w-[9.5rem] rounded-lg border border-line bg-ink-850 px-2 py-1.5 text-[12px] text-fg outline-none focus:border-signal-500"
            aria-label="Rainfall scenario"
          >
            {cityData?.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <DetailToggle
            value={detail}
            onChange={(next) => update({ detail: next })}
            simpleLabel={t.common.simple}
            detailedLabel={t.common.detailed}
          />

          <AlertBell
            unread={unread.length}
            highest={unread[0]?.severity ?? null}
            label={t.alerts.title}
            onOpen={() => {
              setAlertsOpen(true);
              // Seen is seen. Anything that later escalates gets a new id and
              // comes back unread on its own.
              update({
                seenAlertIds: Array.from(
                  new Set([...profile.seenAlertIds, ...watchAlerts.map((a) => a.id)]),
                ).slice(-40),
              });
            }}
          />

          <LanguageSwitcher compact />
        </div>
      </header>

      <ServiceWorkerRegistrar />
      <OfflineBanner online={online} />

      {error ? (
        <div className="shrink-0 border-b border-risk-severe/30 bg-risk-severe/10 px-4 py-2 text-[12px] text-risk-severe">
          {error}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 lg:flex-row">
        {/* Left: Today, and the journey form behind it. Full-screen on mobile. */}
        <aside
          className={`absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-ink-950 lg:static lg:z-auto lg:block lg:w-[344px] lg:shrink-0 lg:border-e lg:border-line lg:bg-transparent ${
            mobilePane === "today" || mobilePane === "plan" ? "block" : "hidden"
          }`}
        >
          {/* On a wide screen this column carries both surfaces, so it needs
              its own switch. On a phone the bottom bar already made the choice. */}
          <div className="sticky top-0 z-10 hidden gap-1 border-b border-line bg-ink-950/95 px-3 py-2 backdrop-blur lg:flex">
            {(["today", "plan"] as LeftTab[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setLeftTab(id)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  leftTab === id ? "bg-ink-800 text-fg" : "text-fg-faint hover:text-fg-muted"
                }`}
              >
                {id === "today" ? t.dashboard.tabToday : t.dashboard.tabJourney}
              </button>
            ))}
          </div>

          {!cityData ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : showToday ? (
            <TodayPanel
              profile={profile}
              nodes={cityData.nodes}
              segments={predict?.segments ?? []}
              comparison={brief?.comparison ?? null}
              survivability={brief?.survivability ?? null}
              decision={brief?.decision ?? null}
              alerts={brief?.alerts ?? []}
              congestion={community?.congestionForecast ?? []}
              recommendedDepartureClock={
                brief?.timeline.recommendedDepartureClock ?? null
              }
              onPlanJourney={() => {
                setLeftTab("plan");
                setMobilePane("plan");
              }}
              onOpenMap={() => setMobilePane("map")}
              onSelectSegment={setSelectedSegmentId}
              onEditSetup={() => onEditSetup?.()}
            />
          ) : (
            <JourneyForm
              nodes={cityData.nodes}
              vehicles={cityData.vehicles}
              purposes={cityData.journeyPurposes}
              value={form}
              onChange={setForm}
              onSubmit={planJourney}
              busy={planning}
            />
          )}
        </aside>

        {/* Centre: map. Always mounted — it is the base layer on mobile. */}
        <main className="absolute inset-0 lg:static lg:min-h-[320px] lg:flex-1">
          {cityData && predict ? (
            <RiskMap
              center={cityData.city.center}
              bounds={cityData.city.bounds}
              segments={predict.segments}
              drains={cityData.drains}
              routes={routes}
              markers={markers}
              selectedSegmentId={selectedSegmentId}
              showDrains={layers.drains}
              onSelectSegment={(id) => {
                setSelectedSegmentId(id);
              }}
              resizeSignal={mobilePane}
            />
          ) : (
            <div className="grid-backdrop h-full w-full" />
          )}

          {/* Map legend and layer toggle */}
          <div className="glass pointer-events-auto absolute bottom-3 start-3 z-20 rounded-xl px-3 py-2.5 lg:bottom-4 lg:start-4">
            <p className="eyebrow mb-2">{t.stats.floodRisk}</p>
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
              <span>{t.risk.safe}</span>
              <span>{t.risk.critical}</span>
            </div>
          </div>

          <LayersControl
            state={layers}
            onChange={setLayers}
            className="absolute bottom-3 end-3 z-20 lg:bottom-4 lg:end-4"
          />

          {/* City status strip */}
          {predict ? (
            <div className="glass pointer-events-none absolute end-3 top-3 z-20 rounded-xl px-3 py-2.5 lg:end-4 lg:top-4 lg:px-4 lg:py-3">
              <div className="flex gap-4 lg:gap-6">
                <Metric
                  label={t.stats.roadsAtRisk}
                  value={predict.summary.segmentsAtRisk}
                  size="sm"
                  tone={predict.summary.segmentsAtRisk > 0 ? "risk" : "safe"}
                />
                <Metric
                  label={t.stats.deepest}
                  value={predict.summary.peakDepthCm.toFixed(0)}
                  unit="cm"
                  size="sm"
                />
                <Metric
                  label={t.stats.peopleExposed}
                  value={compact(predict.summary.peopleExposed)}
                  size="sm"
                />
              </div>
            </div>
          ) : null}
        </main>

        {/* Right: intelligence. Full-screen overlay on mobile. */}
        <aside
          className={`absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-ink-950 lg:static lg:z-auto lg:block lg:w-[400px] lg:shrink-0 lg:border-s lg:border-line lg:bg-transparent ${
            mobilePane === "brief" ? "block" : "hidden"
          }`}
        >
          <div className="sticky top-0 z-10 flex gap-1 border-b border-line bg-ink-950/95 px-3 py-2 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none">
            {(["journey", "city", "community"] as Tab[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  tab === id
                    ? "bg-ink-800 text-fg"
                    : "text-fg-faint hover:text-fg-muted"
                }`}
              >
                {id === "journey"
                  ? t.app.thisJourney
                  : id === "city"
                    ? t.app.cityConditions
                    : "Community"}
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

                  {/* The working. Present for anyone who wants it, absent for
                      anyone who just asked whether they can get to work. */}
                  {showWorking ? (
                    <>
                      <WhyPanel
                        explanations={
                          (brief.comparison?.explanations ?? []) as ExplanationDto[]
                        }
                      />
                      <SourcePanel sources={brief.sources} />
                      <AgentTracePanel trace={brief.trace} />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => update({ detail: "detailed" })}
                      className="w-full rounded-xl border border-line px-4 py-3 text-[12.5px] text-fg-faint transition-colors hover:border-line-bright hover:text-fg-muted"
                    >
                      {t.common.showWorking}
                    </button>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-40" />
                  <Skeleton className="h-52" />
                </div>
              )
            ) : tab === "city" ? (
              predict ? (
                <CityConditions
                  predict={predict}
                  onSelect={setSelectedSegmentId}
                  showWorking={showWorking}
                />
              ) : (
                <Skeleton className="h-64" />
              )
            ) : community ? (
              <CommunityPanel community={community} />
            ) : (
              <Skeleton className="h-64" />
            )}
          </div>
        </aside>
      </div>

      {/* Mobile pane switcher — thumb-reachable, above the home indicator. */}
      <nav className="glass safe-bottom z-30 flex shrink-0 border-t lg:hidden">
        {(
          [
            ["today", t.dashboard.tabToday, <TodayIcon key="t" />],
            ["map", t.app.tabMap, <MapIcon key="m" />],
            ["plan", t.app.tabPlan, <PlanIcon key="p" />],
            ["brief", t.app.tabBrief, <BriefIcon key="b" />],
          ] as [MobilePane, string, React.ReactNode][]
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMobilePane(id);
              if (id === "today" || id === "plan") setLeftTab(id);
            }}
            aria-current={mobilePane === id ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              mobilePane === id ? "text-signal-300" : "text-fg-faint"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {alertsOpen ? (
        <AlertSheet
          alerts={watchAlerts}
          canAskForNotifications={profile.proactiveAlerts || profile.emergencyAlerts}
          onClose={() => setAlertsOpen(false)}
        />
      ) : null}

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

function TodayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6.2v4l2.6 1.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 5h12M4 10h12M4 15h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M2.5 5.5 7.5 3.5v11l-5 2v-11ZM7.5 3.5l5 2v11l-5-2M12.5 5.5l5-2v11l-5 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BriefIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="3"
        width="13"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

function CityConditions({
  predict,
  onSelect,
  showWorking,
}: {
  predict: PredictPayload;
  onSelect: (id: string) => void;
  showWorking: boolean;
}) {
  const t = useT();
  const worst = [...predict.segments]
    .sort((a, b) => b.state.peakDepthCm - a.state.peakDepthCm)
    .slice(0, 12);

  return (
    <>
      <Card>
        <CardHeader
          eyebrow={t.stats.rightNow}
          title={t.app.cityConditions}
          right={
            predict.degraded ? <Badge tone="warn">Degraded inputs</Badge> : null
          }
        />
        <div className="grid grid-cols-2 gap-4 px-4 py-4">
          <Metric
            label={t.stats.roadsAtRisk}
            value={predict.summary.segmentsAtRisk}
            tone={predict.summary.segmentsAtRisk > 0 ? "risk" : "safe"}
          />
          <Metric
            label={t.stats.impassable}
            value={predict.summary.segmentsImpassable}
            tone={predict.summary.segmentsImpassable > 0 ? "risk" : "safe"}
          />
          <Metric
            label={t.stats.underpassesAtRisk}
            value={predict.summary.underpassesAtRisk}
          />
          <Metric
            label={t.stats.hotspotsActive}
            value={predict.summary.hotspotsActive}
          />
        </div>
        {showWorking ? (
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
        ) : null}
      </Card>

      {predict.gauges.length > 0 ? (
        <Card>
          <CardHeader eyebrow="Yamuna" title={t.gov.gaugeReadings} />
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
        <CardHeader
          eyebrow={t.stats.worstFirst}
          title={t.stats.highestRiskRoads}
        />
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

      {showWorking ? <SourcePanel sources={predict.signalSources} /> : null}
    </>
  );
}

/**
 * Simple / Detailed.
 *
 * A segmented control rather than a settings item, because the whole point is
 * that switching is cheap and reversible — somebody should be able to look at
 * the working, satisfy themselves, and put it away again without hunting.
 */
function DetailToggle({
  value,
  onChange,
  simpleLabel,
  detailedLabel,
}: {
  value: "simple" | "detailed";
  onChange: (next: "simple" | "detailed") => void;
  simpleLabel: string;
  detailedLabel: string;
}) {
  return (
    <div
      className="hidden rounded-lg border border-line bg-ink-850 p-0.5 sm:flex"
      role="group"
    >
      {(
        [
          ["simple", simpleLabel],
          ["detailed", detailedLabel],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={`rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
            value === id ? "bg-ink-750 text-fg" : "text-fg-faint hover:text-fg-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Community panel.
 *
 * Leads with detected events rather than a report feed, then the two forward
 * looking pieces: where congestion is about to appear, and which junctions are
 * costing the most time.
 */
function CommunityPanel({ community }: { community: CommunityPayload }) {
  return (
    <>
      <ClusterList clusters={community.clusters} />

      {community.congestionForecast.length > 0 ? (
        <Card>
          <CardHeader
            eyebrow="Next two hours"
            title="Predicted congestion"
            right={<Badge tone="warn">{community.congestionForecast.length}</Badge>}
          />
          <ul className="divide-y divide-line">
            {community.congestionForecast.slice(0, 8).map((f) => (
              <li key={f.segmentId} className="px-4 py-2.5">
                <p className="text-[12.5px] leading-snug text-fg">{f.headline}</p>
                {f.drivers.length > 0 ? (
                  <p className="mt-1 text-[11px] leading-snug text-fg-faint">
                    {f.drivers[0].detail}
                  </p>
                ) : null}
                <p className="numeric mt-1 text-[10.5px] text-fg-faint">
                  Confidence {Math.round(f.confidence * 100)}%
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {community.signalDelays.length > 0 ? (
        <Card>
          <CardHeader
            eyebrow="AI-estimated, not published timing"
            title="Intersection delay"
          />
          <ul className="divide-y divide-line">
            {community.signalDelays.slice(0, 8).map((d) => (
              <li
                key={d.nodeId}
                className="flex items-baseline justify-between gap-3 px-4 py-2"
              >
                <span className="truncate text-[12px] text-fg-muted">{d.name}</span>
                <span className="numeric shrink-0 text-[12px] font-semibold text-fg">
                  {d.estimatedDelaySec}s
                  <span className="ms-1.5 text-[10px] font-normal text-fg-faint">
                    ±{Math.round((1 - d.confidence) * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-[10.5px] leading-snug text-fg-faint">
            Delhi&apos;s signals are adaptive and no timing schedule is published.
            These are estimates of how long you will actually wait, derived from
            junction size, road class, time of day and congestion — not cycle
            times.
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="px-4 py-3">
          <p className="text-[11.5px] leading-snug text-fg-faint">
            {community.reportCount} community report
            {community.reportCount === 1 ? "" : "s"} in the last 30 days. Select
            any road on the map to report conditions there.
          </p>
        </div>
      </Card>
    </>
  );
}

/** Which map layer a detected event belongs to. */
const LAYER_FOR_EVENT: Record<string, string> = {
  major_flood_event: "waterlogging",
  drain_failure: "waterlogging",
  likely_accident: "accidents",
  construction_bottleneck: "construction",
  infrastructure_defect: "construction",
  road_blocked: "closures",
  emergency_response: "alerts",
  localised_congestion: "congestion",
  unclassified: "alerts",
};

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

