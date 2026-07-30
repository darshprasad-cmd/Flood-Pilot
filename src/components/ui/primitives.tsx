"use client";

import type { ReactNode } from "react";

/**
 * Interface primitives.
 *
 * Deliberately few. The product shows numbers that carry real consequence, so
 * the visual system's job is to make hierarchy obvious and get out of the way —
 * one accent colour for the system itself, and saturated colour reserved
 * entirely for the risk ramp so that a red thing on screen always means the same
 * thing.
 */

export function Card({
  children,
  className = "",
  raised = false,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <div className={`${raised ? "surface-raised" : "surface"} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  eyebrow,
  title,
  right,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-line px-5 py-4 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <div className="truncate text-sm font-semibold tracking-tight">{title}</div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  unit,
  hint,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: "default" | "risk" | "safe" | "muted";
  size?: "sm" | "md" | "lg";
}) {
  const toneClass =
    tone === "risk"
      ? "text-risk-severe"
      : tone === "safe"
        ? "text-risk-safe"
        : tone === "muted"
          ? "text-fg-muted"
          : "text-fg";

  const sizeClass =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";

  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <p className={`numeric font-semibold leading-none ${sizeClass} ${toneClass}`}>
        {value}
        {unit ? (
          <span className="ml-1 text-[0.55em] font-medium text-fg-faint">{unit}</span>
        ) : null}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-fg-faint">{hint}</p> : null}
    </div>
  );
}

const RISK_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  safe: { bg: "rgba(47,191,111,0.14)", fg: "#7fe3ac", label: "Safe" },
  low: { bg: "rgba(143,201,58,0.14)", fg: "#c3e488", label: "Low" },
  moderate: { bg: "rgba(232,182,44,0.14)", fg: "#f2d685", label: "Moderate" },
  high: { bg: "rgba(240,138,60,0.15)", fg: "#f9be93", label: "High" },
  severe: { bg: "rgba(232,80,58,0.16)", fg: "#ffa495", label: "Severe" },
  critical: { bg: "rgba(179,43,29,0.24)", fg: "#ff8b7b", label: "Critical" },
};

export function RiskPill({
  level,
  children,
  className = "",
}: {
  level: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = RISK_STYLES[level] ?? RISK_STYLES.moderate;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
      style={{ background: style.bg, color: style.fg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: style.fg }}
        aria-hidden
      />
      {children ?? style.label}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "signal" | "warn" | "danger" | "good";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-800 text-fg-muted border-line",
    signal: "bg-signal-500/12 text-signal-300 border-signal-500/25",
    warn: "bg-risk-moderate/12 text-risk-moderate border-risk-moderate/25",
    danger: "bg-risk-severe/12 text-risk-severe border-risk-severe/25",
    good: "bg-risk-safe/12 text-risk-safe border-risk-safe/25",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Confidence indicator.
 *
 * Shown next to every prediction. A dial rather than a number alone because the
 * point is that confidence is *part of* the reading, not a footnote to it.
 */
export function ConfidenceMeter({
  score,
  band,
  limitations = [],
  compact = false,
}: {
  score: number;
  band: string;
  limitations?: string[];
  compact?: boolean;
}) {
  const pct = Math.round(score * 100);
  const color =
    band === "high" ? "#2fbf6f" : band === "moderate" ? "#e8b62c" : "#f08a3c";

  const radius = compact ? 13 : 17;
  const stroke = compact ? 3 : 3.5;
  const circumference = 2 * Math.PI * radius;
  const size = (radius + stroke) * 2;

  return (
    <div className="flex items-start gap-3">
      <svg
        width={size}
        height={size}
        className="shrink-0 -rotate-90"
        aria-label={`Confidence ${pct}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-750)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>

      <div className="min-w-0">
        <p className="eyebrow mb-1">Confidence</p>
        <p className="numeric text-sm font-semibold" style={{ color }}>
          {pct}%
          <span className="ml-1.5 text-[11px] font-medium capitalize text-fg-faint">
            {band}
          </span>
        </p>
        {limitations.length > 0 && !compact ? (
          <ul className="mt-2 space-y-1">
            {limitations.slice(0, 3).map((limitation) => (
              <li key={limitation} className="text-[11px] leading-snug text-fg-faint">
                {limitation}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Horizontal proportion bar used for probabilities and likelihoods. */
export function Bar({
  value,
  color = "var(--color-signal-400)",
  className = "",
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-750 ${className}`}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(2, Math.min(100, value * 100))}%`,
          background: color,
          transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="grid place-items-center px-4 py-10 text-center text-xs text-fg-faint">
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`shimmer rounded-md bg-ink-800 ${className}`}>
      <div className="shimmer-bar" />
    </div>
  );
}
