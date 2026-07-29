"use client";

import { useMemo } from "react";
import { haversineM } from "@/lib/core/math";
import { useT } from "@/lib/i18n";
import type { UserProfile } from "@/lib/profile";
import type { AlertDto } from "./panels";
import type { ComparisonDto, DecisionOptionDto, SurvivabilityDto } from "./route-vehicle";

/**
 * Today.
 *
 * The screen somebody opens at 07:40 with rain on the window. It answers five
 * questions in the order a person actually asks them, and it answers them in
 * words — no probability, no confidence interval, no feature contribution. All
 * of that still exists and is one tap away under "show the working"; it is just
 * not what belongs on the first screen.
 *
 * Everything here is derived from the same agent output the detailed panels
 * read. This is a different presentation of one answer, not a second opinion.
 */

export interface TodaySegment {
  id: string;
  name: string;
  midpoint: { lat: number; lng: number };
  state: {
    riskLevel: string;
    riskColor: string;
    probability: number;
    peakDepthCm: number;
    depthCm: number;
    timeToImpassableMin: number | null;
  };
}

interface TodayPanelProps {
  profile: UserProfile;
  nodes: { id: string; name: string; at: { lat: number; lng: number }; ward: string }[];
  segments: TodaySegment[];
  comparison: ComparisonDto | null;
  survivability: SurvivabilityDto | null;
  decision: {
    primary: DecisionOptionDto;
    alternatives: DecisionOptionDto[];
    parallel: DecisionOptionDto[];
  } | null;
  alerts: AlertDto[];
  congestion: { segmentId: string; headline: string }[];
  recommendedDepartureClock: string | null;
  onPlanJourney: () => void;
  onOpenMap: () => void;
  onSelectSegment: (id: string) => void;
  onEditSetup: () => void;
}

type Verdict = "yes" | "caution" | "wait" | "no";

const VERDICT_TONE: Record<Verdict, { color: string; bg: string }> = {
  yes: { color: "#2fbf6f", bg: "rgba(47,191,111,0.10)" },
  caution: { color: "#e8b62c", bg: "rgba(232,182,44,0.10)" },
  wait: { color: "#f08a3c", bg: "rgba(240,138,60,0.10)" },
  no: { color: "#e8503a", bg: "rgba(232,80,58,0.10)" },
};

export function TodayPanel({
  profile,
  nodes,
  segments,
  comparison,
  survivability,
  decision,
  alerts,
  congestion,
  recommendedDepartureClock,
  onPlanJourney,
  onOpenMap,
  onSelectSegment,
  onEditSetup,
}: TodayPanelProps) {
  const t = useT();

  const home = nodes.find((n) => n.id === profile.homeNodeId) ?? null;
  const work = nodes.find((n) => n.id === profile.workNodeId) ?? null;

  /* ── What is happening around home ───────────────────────────────────── */
  const area = useMemo(() => nearby(segments, home?.at, 3200), [segments, home]);
  const areaWorst = area[0] ?? null;

  const areaState: "clear" | "watch" | "flooding" = !areaWorst
    ? "clear"
    : areaWorst.state.peakDepthCm >= 15 && areaWorst.state.probability >= 0.45
      ? "flooding"
      : areaWorst.state.peakDepthCm >= 6
        ? "watch"
        : "clear";

  /* ── Can they go? ────────────────────────────────────────────────────── */
  const verdict = deriveVerdict(comparison, survivability, decision);
  const tone = VERDICT_TONE[verdict];
  const verdictText =
    verdict === "yes"
      ? t.dashboard.answerYes
      : verdict === "caution"
        ? t.dashboard.answerCaution
        : verdict === "wait"
          ? t.dashboard.answerWait
          : t.dashboard.answerNo;

  /* ── The car ─────────────────────────────────────────────────────────── */
  const moveOption =
    decision === null
      ? null
      : [decision.primary, ...decision.alternatives, ...decision.parallel].find(
          (o) => o.action === "move_vehicle" && o.feasible,
        ) ?? null;
  const shouldMoveCar =
    profile.basementParking &&
    (moveOption !== null || (areaWorst?.state.peakDepthCm ?? 0) >= 20);

  // The first alert is the decision agent restating its own recommendation,
  // which is already the largest thing on this screen. Repeating it under
  // "what should I expect" tells somebody nothing they did not just read.
  const disruptions = [
    ...alerts.slice(1, 3).map((a) => ({ id: a.id, text: a.title, detail: a.body })),
    ...congestion.slice(0, 2).map((c) => ({ id: c.segmentId, text: c.headline, detail: "" })),
  ].slice(0, 3);

  return (
    <div className="space-y-3 p-3">
      {/* ── 1. Is it safe to travel? ─────────────────────────────────────── */}
      <section
        className="animate-arrive overflow-hidden rounded-[var(--radius-panel)] border"
        style={{ borderColor: `${tone.color}40`, background: tone.bg }}
      >
        <div className="px-5 pb-4 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-fg-faint">
            {greeting(t)} · {t.dashboard.qSafeToTravel}
          </p>
          <p
            className="mt-2 text-balance text-[22px] font-semibold leading-[1.18] tracking-tight"
            style={{ color: tone.color }}
          >
            {verdictText}
          </p>
          {decision ? (
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              {decision.primary.headline}
            </p>
          ) : null}

          {recommendedDepartureClock ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-ink-950/40 px-2.5 py-1.5 text-[12px] text-fg">
              <ClockIcon />
              {t.timeline.recommendedDeparture}
              <span className="numeric font-semibold">{recommendedDepartureClock}</span>
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: `${tone.color}26` }}>
          <button
            type="button"
            onClick={onPlanJourney}
            className="min-h-11 flex-1 rounded-xl bg-signal-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-signal-400"
          >
            {t.dashboard.planJourney}
          </button>
          <button
            type="button"
            onClick={onOpenMap}
            className="min-h-11 rounded-xl border border-line-bright bg-ink-950/30 px-4 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            {t.dashboard.checkArea}
          </button>
        </div>
      </section>

      {/* ── 2. Move the car — only if there is a basement to move it out of ─ */}
      {profile.basementParking ? (
        <AnswerRow
          question={t.dashboard.qMyCar}
          answer={shouldMoveCar ? t.dashboard.carMove : t.dashboard.carSafe}
          urgent={shouldMoveCar}
          detail={
            shouldMoveCar
              ? (moveOption?.headline ??
                `${areaWorst?.name} is modelled at ${Math.round(
                  areaWorst?.state.peakDepthCm ?? 0,
                )} cm — basements fill from the ramp before the road does.`)
              : undefined
          }
        />
      ) : null}

      {/* ── 3. Is my area at risk? ───────────────────────────────────────── */}
      <section className="surface overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
          <p className="eyebrow">{t.dashboard.qMyArea}</p>
          {home ? (
            <span className="text-[11px] text-fg-faint">{home.ward}</span>
          ) : null}
        </div>
        <p className="px-4 pb-3 pt-1.5 text-[14px] font-medium">
          {areaState === "flooding"
            ? t.dashboard.areaFlooding
            : areaState === "watch"
              ? t.dashboard.areaWatch
              : t.dashboard.areaClear}
        </p>

        {area.length > 0 ? (
          <ul className="divide-y divide-line border-t border-line">
            {area.slice(0, 4).map((segment) => (
              <li key={segment.id}>
                <button
                  type="button"
                  onClick={() => onSelectSegment(segment.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-ink-800/60"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: segment.state.riskColor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
                    {segment.name}
                  </span>
                  <span className="numeric shrink-0 text-[11.5px] text-fg-faint">
                    {segment.state.peakDepthCm < 1
                      ? "—"
                      : `${Math.round(segment.state.peakDepthCm)} ${t.common.cm}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ── 4. Which route is safest? ────────────────────────────────────── */}
      <section className="surface overflow-hidden">
        <p className="eyebrow px-4 pt-3.5">{t.dashboard.qRoute}</p>
        {comparison ? (
          <div className="px-4 pb-4 pt-2">
            <p className="text-[14px] font-medium">
              {comparison.safeRouteExists
                ? t.route.recommended
                : t.route.leastDangerous}
            </p>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
              <Figure
                value={`${Math.round(comparison.safest.durationMin)}`}
                unit={t.common.min}
              />
              {/* "0 cm of water" is not a fact worth a headline figure. On a
                  dry route the absence of a depth is the good news. */}
              {comparison.safest.maxDepthCm >= 1 ? (
                <Figure
                  value={`${Math.round(comparison.safest.maxDepthCm)}`}
                  unit={t.common.cm}
                  muted
                />
              ) : null}
              {comparison.extraMinutes > 0 ? (
                <span className="text-[11.5px] text-fg-faint">
                  +{Math.round(comparison.extraMinutes)} {t.common.min} vs{" "}
                  {t.route.fastest.toLowerCase()}
                </span>
              ) : null}
            </div>
            {home && work ? (
              <p className="mt-2.5 text-[11.5px] text-fg-faint">
                {home.name} → {work.name}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="px-4 pb-4 pt-1.5 text-[13px] text-fg-muted">
            {t.dashboard.noJourneyYet}
          </p>
        )}
      </section>

      {/* ── 5. What should I expect? ─────────────────────────────────────── */}
      <section className="surface overflow-hidden">
        <p className="eyebrow px-4 pt-3.5">{t.dashboard.qDisruptions}</p>
        {disruptions.length === 0 ? (
          <p className="px-4 pb-4 pt-1.5 text-[13px] text-fg-muted">
            {t.dashboard.nothingExpected}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {disruptions.map((item) => (
              <li key={item.id} className="px-4 py-2.5">
                <p className="text-[12.5px] leading-snug text-fg">{item.text}</p>
                {item.detail ? (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-fg-faint">
                    {item.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Your places ──────────────────────────────────────────────────── */}
      <section className="surface overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <p className="eyebrow">{t.dashboard.yourPlaces}</p>
          <button
            type="button"
            onClick={onEditSetup}
            className="text-[11px] text-fg-faint transition-colors hover:text-fg-muted"
          >
            {t.dashboard.editSetup}
          </button>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {[
            home ? { node: home, role: t.dashboard.home } : null,
            work ? { node: work, role: t.dashboard.work } : null,
            ...profile.frequentNodeIds.map((id) => {
              const node = nodes.find((n) => n.id === id);
              return node ? { node, role: node.ward } : null;
            }),
          ]
            .filter((x): x is { node: (typeof nodes)[number]; role: string } => x !== null)
            .map(({ node, role }) => {
              const worst = nearby(segments, node.at, 2000)[0] ?? null;
              return (
                <li
                  key={node.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: worst?.state.riskColor ?? "#2fbf6f" }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
                    {node.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-fg-faint">{role}</span>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AnswerRow({
  question,
  answer,
  detail,
  urgent,
}: {
  question: string;
  answer: string;
  detail?: string;
  urgent: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--radius-card)] border px-4 py-3.5 ${
        urgent
          ? "border-risk-severe/40 bg-risk-severe/[0.08]"
          : "border-line bg-ink-900/50"
      }`}
    >
      <p className="eyebrow">{question}</p>
      <p
        className={`mt-1.5 text-[15px] font-semibold ${
          urgent ? "text-risk-severe" : "text-fg"
        }`}
      >
        {answer}
      </p>
      {detail ? (
        <p className="mt-1.5 text-[12px] leading-snug text-fg-muted">{detail}</p>
      ) : null}
    </section>
  );
}

function Figure({
  value,
  unit,
  muted = false,
}: {
  value: string;
  unit: string;
  muted?: boolean;
}) {
  return (
    <span className={`numeric text-[19px] font-semibold ${muted ? "text-fg-muted" : "text-fg"}`}>
      {value}
      <span className="ms-1 text-[11px] font-normal text-fg-faint">{unit}</span>
    </span>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.8V8l2.2 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

/** Segments whose midpoint is within `radiusM`, worst first. */
function nearby(
  segments: TodaySegment[],
  at: { lat: number; lng: number } | undefined,
  radiusM: number,
): TodaySegment[] {
  if (!at) return [];
  return segments
    .filter((s) => haversineM(at, s.midpoint) <= radiusM)
    .sort((a, b) => b.state.peakDepthCm - a.state.peakDepthCm);
}

/**
 * The headline answer.
 *
 * Ordered so that the escalating conditions win: an impassable leg or a vehicle
 * that cannot cross overrides whatever the decision agent preferred, because
 * those two are facts about water and metal rather than preferences about time.
 */
function deriveVerdict(
  comparison: ComparisonDto | null,
  survivability: SurvivabilityDto | null,
  decision: { primary: DecisionOptionDto } | null,
): Verdict {
  if (!comparison) return "caution";

  if (comparison.safest.impassableCount > 0 || survivability?.band === "unsafe") {
    return "no";
  }

  const action = decision?.primary.action;
  if (action && action !== "leave_now") {
    // Delay, Metro, cab, remote work and cancel all mean the same thing to
    // somebody holding car keys: not by road, not now.
    return "wait";
  }

  if (survivability?.band === "borderline" || comparison.safest.maxDepthCm >= 12) {
    return "caution";
  }

  return "yes";
}

function greeting(t: ReturnType<typeof useT>): string {
  const hour = new Date().getHours();
  if (hour < 12) return t.dashboard.goodMorning;
  if (hour < 17) return t.dashboard.goodAfternoon;
  return t.dashboard.goodEvening;
}
