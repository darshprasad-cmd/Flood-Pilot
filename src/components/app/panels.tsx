"use client";

import type { ReactNode } from "react";
import { Bar, Badge, Card, CardHeader, Empty, RiskPill } from "@/components/ui/primitives";

/* -------------------------------------------------------------------------- */
/*  Why panel                                                                 */
/* -------------------------------------------------------------------------- */

export interface ExplanationDto {
  id: string;
  text: string;
  category: string;
  impact: string;
  weight: number;
  evidence?: { label: string; value: string }[];
}

const IMPACT_STYLE: Record<string, { color: string; glyph: string; label: string }> = {
  blocks: { color: "#e8503a", glyph: "■", label: "Blocking" },
  "increases-risk": { color: "#f08a3c", glyph: "▲", label: "Raises risk" },
  "reduces-risk": { color: "#2fbf6f", glyph: "▼", label: "Lowers risk" },
  supports: { color: "#4aa8ff", glyph: "◆", label: "Supporting" },
  neutral: { color: "#5f6c85", glyph: "•", label: "Context" },
};

/**
 * The "Why?" panel.
 *
 * Every recommendation in the product has one. The rule the codebase enforces is
 * that explanations are generated from the model's own feature contributions, so
 * this is a view of the reasoning rather than a story told next to it.
 */
export function WhyPanel({
  title = "Why this recommendation?",
  explanations,
  limit = 8,
  className = "",
}: {
  title?: string;
  explanations: ExplanationDto[];
  limit?: number;
  className?: string;
}) {
  if (explanations.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader
        eyebrow="Explainable AI"
        title={title}
        right={
          <Badge tone="signal">
            {explanations.length} factor{explanations.length === 1 ? "" : "s"}
          </Badge>
        }
      />
      <ul className="divide-y divide-line">
        {explanations.slice(0, limit).map((explanation) => {
          const style = IMPACT_STYLE[explanation.impact] ?? IMPACT_STYLE.neutral;
          return (
            <li key={explanation.id} className="px-4 py-3">
              <div className="flex gap-3">
                <span
                  className="mt-0.5 shrink-0 text-[10px] leading-5"
                  style={{ color: style.color }}
                  aria-label={style.label}
                >
                  {style.glyph}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-relaxed text-fg">
                    {explanation.text}
                  </p>
                  {explanation.evidence && explanation.evidence.length > 0 ? (
                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                      {explanation.evidence.slice(0, 4).map((item) => (
                        <div key={item.label} className="flex gap-1.5 text-[11px]">
                          <dt className="text-fg-faint">{item.label}</dt>
                          <dd className="numeric text-fg-muted">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data sources                                                              */
/* -------------------------------------------------------------------------- */

export interface SourceUsageDto {
  signal: string;
  providerName: string;
  used: boolean;
  detail: string;
}

/**
 * Source transparency.
 *
 * Lists what the prediction was actually built from — and, just as importantly,
 * which preferred official sources were unavailable and why. A user should be
 * able to tell at a glance whether they are looking at an IMD forecast or a
 * fallback.
 */
export function SourcePanel({
  sources,
  className = "",
}: {
  sources: SourceUsageDto[];
  className?: string;
}) {
  const used = sources.filter((s) => s.used);
  const unavailable = sources.filter((s) => !s.used);

  return (
    <Card className={className}>
      <CardHeader eyebrow="Transparency" title="Prediction based on" />
      <div className="px-4 py-3">
        <ul className="space-y-2.5">
          {used.map((source) => (
            <li key={`${source.signal}-${source.providerName}`} className="flex gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risk-safe"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-fg">
                  {source.providerName}
                  <span className="ml-2 text-[11px] font-normal capitalize text-fg-faint">
                    {source.signal}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">
                  {source.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {unavailable.length > 0 ? (
          <div className="mt-4 border-t border-line pt-3">
            <p className="eyebrow mb-2">Preferred sources not connected</p>
            <ul className="space-y-2">
              {unavailable.map((source) => (
                <li
                  key={`${source.signal}-${source.providerName}`}
                  className="flex gap-2.5"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-700"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-fg-muted">
                      {source.providerName}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">
                      {source.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Timeline                                                                  */
/* -------------------------------------------------------------------------- */

export interface TimelineEventDto {
  minutesFromNow: number;
  clock: string;
  title: string;
  detail: string;
  kind: string;
  severity: string;
}

const KIND_COLOR: Record<string, string> = {
  rain: "#4aa8ff",
  traffic: "#e8b62c",
  flood: "#e8503a",
  route: "#f08a3c",
  river: "#2b6fa8",
  recovery: "#2fbf6f",
  departure: "#35d6d6",
};

/**
 * Prediction timeline.
 *
 * The most decision-relevant view in the product: not "how bad is it" but "how
 * long have I got". The recommended departure is picked out because it is the
 * only item on here that is an instruction rather than a forecast.
 */
export function TimelinePanel({
  events,
  recommendedDepartureClock,
  latestSafeDepartureMin,
  noSafeWindow,
  className = "",
}: {
  events: TimelineEventDto[];
  recommendedDepartureClock: string | null;
  latestSafeDepartureMin: number | null;
  noSafeWindow: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader
        eyebrow="Next 12 hours"
        title="Prediction timeline"
        right={
          noSafeWindow ? (
            <Badge tone="danger">No safe window</Badge>
          ) : latestSafeDepartureMin !== null ? (
            <Badge tone="warn">Window closes</Badge>
          ) : null
        }
      />

      {events.length === 0 ? (
        <Empty>Nothing forecast to happen in the next twelve hours.</Empty>
      ) : (
        <ol className="relative px-4 py-4">
          <div
            className="absolute bottom-4 left-[4.35rem] top-4 w-px bg-line"
            aria-hidden
          />
          {events.map((event, index) => {
            const isDeparture = event.kind === "departure";
            return (
              <li
                key={`${event.kind}-${event.minutesFromNow}-${index}`}
                className="relative flex gap-4 pb-4 last:pb-0"
              >
                <time className="numeric w-11 shrink-0 pt-0.5 text-right text-[12px] font-semibold text-fg-muted">
                  {event.clock}
                </time>
                <span
                  className={`relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    isDeparture ? "animate-pulse-ring" : ""
                  }`}
                  style={{
                    background: KIND_COLOR[event.kind] ?? "#5f6c85",
                    color: KIND_COLOR[event.kind] ?? "#5f6c85",
                    boxShadow: "0 0 0 3px var(--color-ink-900)",
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[13px] font-semibold ${
                      isDeparture ? "text-aqua-400" : "text-fg"
                    }`}
                  >
                    {event.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                    {event.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {recommendedDepartureClock ? (
        <div className="border-t border-line bg-aqua-400/[0.06] px-4 py-3">
          <p className="eyebrow mb-1">Recommended departure</p>
          <p className="numeric text-2xl font-semibold text-aqua-400">
            {recommendedDepartureClock}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Blockages                                                                 */
/* -------------------------------------------------------------------------- */

export interface BlockageDto {
  kind: string;
  label: string;
  likelihood: number;
  basis: string;
  consequence: string;
}

export function BlockageList({
  blockages,
  className = "",
}: {
  blockages: BlockageDto[];
  className?: string;
}) {
  if (blockages.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader eyebrow="Failure modes" title="What is likely to go wrong here" />
      <ul className="divide-y divide-line">
        {blockages.map((blockage) => (
          <li key={blockage.kind} className="px-4 py-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold text-fg">{blockage.label}</p>
              <span className="numeric shrink-0 text-[12px] font-semibold text-fg-muted">
                {Math.round(blockage.likelihood * 100)}%
              </span>
            </div>
            <Bar
              value={blockage.likelihood}
              color={
                blockage.likelihood > 0.66
                  ? "#e8503a"
                  : blockage.likelihood > 0.33
                    ? "#e8b62c"
                    : "#4aa8ff"
              }
            />
            <p className="mt-2 text-[11px] leading-snug text-fg-muted">
              {blockage.consequence}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-fg-faint">
              {blockage.basis}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Alerts                                                                    */
/* -------------------------------------------------------------------------- */

export interface AlertDto {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
}

export function AlertList({
  alerts,
  className = "",
}: {
  alerts: AlertDto[];
  className?: string;
}) {
  if (alerts.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="surface flex gap-3 px-4 py-3"
          style={{
            borderLeftWidth: 2,
            borderLeftColor:
              alert.severity === "critical" || alert.severity === "severe"
                ? "#e8503a"
                : alert.severity === "high"
                  ? "#f08a3c"
                  : alert.severity === "moderate"
                    ? "#e8b62c"
                    : "#2fbf6f",
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[13px] font-semibold text-fg">{alert.title}</p>
              <RiskPill level={alert.severity} />
            </div>
            <p className="text-[12px] leading-snug text-fg-muted">{alert.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Agent trace                                                               */
/* -------------------------------------------------------------------------- */

export interface AgentTraceDto {
  agent: string;
  name: string;
  version: string;
  latencyMs: number;
  confidence: number;
  confidenceBand: string;
  degraded: boolean;
  topExplanation: string;
}

/**
 * Which agent produced what.
 *
 * Present because a recommendation you cannot audit is a recommendation you
 * cannot trust — and because the modularity claim is only credible if you can
 * see the seams.
 */
export function AgentTracePanel({
  trace,
  className = "",
}: {
  trace: AgentTraceDto[];
  className?: string;
}) {
  if (trace.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader eyebrow="AI architecture" title="Agents that produced this" />
      <ul className="divide-y divide-line">
        {trace.map((entry) => (
          <li key={entry.agent} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold text-fg">{entry.name}</p>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="numeric text-[11px] text-fg-faint">
                  {entry.latencyMs} ms
                </span>
                <span
                  className="numeric text-[11px] font-semibold"
                  style={{
                    color:
                      entry.confidenceBand === "high"
                        ? "#2fbf6f"
                        : entry.confidenceBand === "moderate"
                          ? "#e8b62c"
                          : "#f08a3c",
                  }}
                >
                  {Math.round(entry.confidence * 100)}%
                </span>
              </div>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-faint">
              {entry.topExplanation}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PanelSection({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
