"use client";

import { useMemo } from "react";
import { haversineM } from "@/lib/core/math";
import { fill } from "@/lib/i18n/fill";
import { useT } from "@/lib/i18n";
import type { UserProfile } from "@/lib/profile";

/**
 * The next twelve hours.
 *
 * Today answers "what should I do now". This answers "when does it change",
 * which is a different question and the one people actually ask during a
 * monsoon — not whether it will rain, but whether it will still be raining
 * when they need to leave.
 *
 * Nothing here is newly modelled. The rainfall curve comes from the weather
 * field the engine already reads, and the road bands are read straight off
 * each segment's own onset, peak and recovery times. If the two disagree, the
 * engine is wrong, not this panel.
 */

export interface ForecastDto {
  issuedAt: string;
  rain: {
    minutesFromNow: number;
    mmPerHr: number;
    peakMmPerHr: number;
    probability: number;
  }[];
  peakMmPerHr: number;
  peakInMin: number | null;
  eventTotalMm: number;
  model: {
    id: string;
    confidence: number;
    peakDepthCm: number;
    peakAtMin: number | null;
    curve: {
      minutesFromNow: number;
      maxDepthCm: number;
      meanDepthCm: number;
      roadsAtRisk: number;
      roadsImpassable: number;
    }[];
  } | null;
}

export interface ForecastSegment {
  id: string;
  name: string;
  midpoint: { lat: number; lng: number };
  state: {
    peakDepthCm: number;
    riskColor: string;
    timeToFloodMin: number | null;
    timeToImpassableMin: number | null;
    peakAtMin: number | null;
    recoveryMin: number | null;
  };
}

const HOURS = 12;
/** Below this an "at risk" band is noise rather than a warning. */
const BAND_MIN_CM = 8;

export function ForecastPanel({
  forecast,
  segments,
  profile,
  nodes,
  onSelectSegment,
}: {
  forecast: ForecastDto | null;
  segments: ForecastSegment[];
  profile: UserProfile;
  nodes: { id: string; name: string; at: { lat: number; lng: number } }[];
  onSelectSegment: (id: string) => void;
}) {
  const t = useT();

  const home = nodes.find((n) => n.id === profile.homeNodeId) ?? null;

  /** Roads that are going to change state, soonest first. */
  const timeline = useMemo(() => {
    return segments
      .filter(
        (s) =>
          s.state.peakDepthCm >= BAND_MIN_CM &&
          (s.state.timeToFloodMin !== null || s.state.peakAtMin !== null),
      )
      .map((s) => ({
        ...s,
        // A road already over the threshold has an onset of zero, not null.
        startsAt: s.state.timeToFloodMin ?? 0,
        nearHome: home ? haversineM(home.at, s.midpoint) <= 3200 : false,
      }))
      .sort((a, b) => {
        // Your own streets first at equal urgency — a forecast is only useful
        // if the thing you care about is not buried at position forty.
        if (a.nearHome !== b.nearHome) return a.nearHome ? -1 : 1;
        return a.startsAt - b.startsAt;
      })
      .slice(0, 8);
  }, [segments, home]);

  const maxRain = Math.max(
    1,
    ...(forecast?.rain.map((r) => r.peakMmPerHr) ?? [1]),
  );

  if (!forecast) {
    return (
      <div className="space-y-4 p-4">
        <div className="shimmer h-40 rounded-[var(--radius-card)] bg-ink-900">
          <span className="shimmer-bar" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* ── Rain ─────────────────────────────────────────────────────────── */}
      <section className="surface overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
          <p className="eyebrow">{t.forecast.rainNext12h}</p>
          <span className="numeric text-[11px] text-fg-faint">
            {fill(t.forecast.totalExpected, { mm: forecast.eventTotalMm })}
          </span>
        </div>

        <div className="px-5 pb-2 pt-3">
          <div className="flex h-24 items-end gap-[3px]">
            {forecast.rain.map((point) => {
              const h = Math.max(2, (point.peakMmPerHr / maxRain) * 100);
              const mean = Math.max(1, (point.mmPerHr / maxRain) * 100);
              return (
                <div
                  key={point.minutesFromNow}
                  className="relative flex-1"
                  style={{ height: "100%" }}
                  title={`+${point.minutesFromNow / 60}h · ${point.mmPerHr} mm/hr`}
                >
                  {/* The lighter bar is the wettest cell anywhere in the city,
                      the solid one is the average across the grid. */}
                  <span
                    className="absolute bottom-0 w-full rounded-t-sm bg-signal-500/25"
                    style={{ height: `${h}%` }}
                  />
                  <span
                    className="absolute bottom-0 w-full rounded-t-sm bg-signal-500"
                    style={{ height: `${mean}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex justify-between text-[10px] text-fg-faint">
            <span>{t.common.now}</span>
            <span className="numeric">+{HOURS} {t.common.hr}</span>
          </div>
        </div>

        <p className="border-t border-line px-5 py-3 text-[11.5px] leading-relaxed text-fg-faint">
          {forecast.peakMmPerHr < 1
            ? t.forecast.noRain
            : fill(t.forecast.peakLine, {
                mm: forecast.peakMmPerHr,
                when:
                  forecast.peakInMin === null || forecast.peakInMin <= 0
                    ? t.common.now
                    : `+${Math.round(forecast.peakInMin / 60)} ${t.common.hr}`,
              })}
        </p>
      </section>

      {/* ── What the model makes of that rain ────────────────────────────── */}
      {forecast.model ? (
        <ModelCurve model={forecast.model} />
      ) : null}

      {/* ── Roads, over time ─────────────────────────────────────────────── */}
      <section className="surface overflow-hidden">
        <p className="eyebrow px-5 pb-1 pt-4">{t.forecast.whenRoadsChange}</p>

        {timeline.length === 0 ? (
          <p className="px-5 pb-4 pt-2 text-[13px] leading-relaxed text-fg-muted">
            {t.forecast.nothingChanges}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {timeline.map((road) => (
              <li key={road.id}>
                <button
                  type="button"
                  onClick={() => onSelectSegment(road.id)}
                  className="w-full px-5 py-3.5 text-start transition-colors hover:bg-ink-800/60"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      {road.nearHome ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-400"
                          title={t.dashboard.home}
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate text-[13px] font-medium text-fg">
                        {road.name}
                      </span>
                    </span>
                    <span
                      className="numeric shrink-0 text-[12px] font-semibold"
                      style={{ color: road.state.riskColor }}
                    >
                      {Math.round(road.state.peakDepthCm)} {t.common.cm}
                    </span>
                  </div>

                  <Band road={road} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
        {t.forecast.caveat}
      </p>
    </div>
  );
}

/**
 * The flood model's own twelve hours.
 *
 * Deliberately sits directly under the rainfall chart on the same time axis,
 * because the interesting thing about Delhi is that the two curves have
 * different shapes. Rain stops and this one keeps climbing, which is the trunk
 * drains surcharging — the single most misunderstood thing about flooding here,
 * and impossible to see from a weather forecast.
 */
function ModelCurve({
  model,
}: {
  model: NonNullable<ForecastDto["model"]>;
}) {
  const t = useT();
  const points = model.curve;
  // Scale to the true crest, not to the sampled maximum, so the plotted line
  // never touches the top of a box that claims a smaller number beside it.
  const maxDepth = Math.max(10, model.peakDepthCm);
  const peakRoads = Math.max(...points.map((p) => p.roadsAtRisk));

  // An area chart as an SVG polygon: 13 points, no charting library earns its
  // bundle size for that.
  const w = 100;
  const h = 100;
  const xAt = (i: number) => (i / (points.length - 1)) * w;
  const yAt = (cm: number) => h - (cm / maxDepth) * h;

  const line = points.map((p, i) => `${xAt(i)},${yAt(p.maxDepthCm)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const meanLine = points.map((p, i) => `${xAt(i)},${yAt(p.meanDepthCm)}`).join(" ");

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
        <p className="eyebrow">{t.forecast.modelDepth}</p>
        <span className="numeric text-[11px] text-fg-faint">
          {Math.round(model.confidence * 100)}% {t.confidence.label.toLowerCase()}
        </span>
      </div>

      <div className="px-5 pb-2 pt-3">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="h-28 w-full overflow-visible"
          role="img"
          aria-label={t.forecast.modelDepth}
        >
          <defs>
            <linearGradient id="fc-depth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e8503a" stopOpacity="0.42" />
              <stop offset="1" stopColor="#e8503a" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* 30 cm is where an ordinary car stops. Worth a line of its own. */}
          {maxDepth > 30 ? (
            <line
              x1="0"
              x2={w}
              y1={yAt(30)}
              y2={yAt(30)}
              stroke="#e8503a"
              strokeOpacity="0.45"
              strokeWidth="0.6"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          <polygon points={area} fill="url(#fc-depth)" />
          <polyline
            points={line}
            fill="none"
            stroke="#e8503a"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={meanLine}
            fill="none"
            stroke="#e8b62c"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="mt-2 flex justify-between text-[10px] text-fg-faint">
          <span>{t.common.now}</span>
          <span className="numeric">
            {Math.round(model.peakDepthCm)} {t.common.cm} {t.forecast.axisMax}
          </span>
          <span className="numeric">+{HOURS} {t.common.hr}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-line px-5 py-4">
        <div>
          <p className="eyebrow mb-1.5">{t.forecast.peakRoadsAtRisk}</p>
          <p className="numeric text-[19px] font-semibold">{peakRoads}</p>
        </div>
        <div>
          <p className="eyebrow mb-1.5">{t.forecast.modelId}</p>
          <p className="truncate text-[12px] text-fg-muted">{model.id}</p>
        </div>
      </div>

      <p className="border-t border-line px-5 py-3 text-[11.5px] leading-relaxed text-fg-faint">
        {t.forecast.modelNote}
      </p>
    </section>
  );
}

/**
 * One road's twelve hours as a bar.
 *
 * Filled from the moment water crosses the action threshold to the moment it
 * drops back below it, with the peak marked. A road with no recovery time
 * inside the window runs to the end of the bar, because "still flooded at
 * midnight" is the honest reading of a null.
 */
function Band({
  road,
}: {
  road: ForecastSegment & { startsAt: number; nearHome: boolean };
}) {
  const t = useT();
  const total = HOURS * 60;

  const start = clampPct(road.startsAt / total);
  const end = clampPct((road.state.recoveryMin ?? total) / total);
  const width = Math.max(2, end - start);
  const peak =
    road.state.peakAtMin === null ? null : clampPct(road.state.peakAtMin / total);

  const clock = (min: number) => {
    const at = new Date(Date.now() + min * 60_000);
    return at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <div className="relative mt-2.5 h-1.5 w-full rounded-full bg-ink-800">
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${start}%`,
            width: `${width}%`,
            background: road.state.riskColor,
            opacity: 0.85,
          }}
        />
        {peak !== null ? (
          <span
            className="absolute -top-[3px] h-3 w-[2px] rounded-full bg-fg"
            style={{ left: `${peak}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      <p className="numeric mt-2 text-[11px] text-fg-faint">
        {road.startsAt <= 0 ? t.forecast.alreadyWet : clock(road.startsAt)}
        {" → "}
        {road.state.recoveryMin === null
          ? t.forecast.beyondWindow
          : clock(road.state.recoveryMin)}
        {/* An explicit separator rather than a margin: this string is read
            aloud by screen readers and copied out of the page, and in both of
            those a margin is not a space. */}
        {road.state.timeToImpassableMin !== null ? (
          <span className="text-risk-severe"> · {t.route.impassable}</span>
        ) : null}
      </p>
    </>
  );
}

const clampPct = (v: number) => Math.min(100, Math.max(0, v * 100));
