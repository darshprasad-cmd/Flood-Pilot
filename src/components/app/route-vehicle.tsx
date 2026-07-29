"use client";

import { Bar, Badge, Card, CardHeader, Metric, RiskPill } from "@/components/ui/primitives";
import { useT, type Messages } from "@/lib/i18n";

/* -------------------------------------------------------------------------- */
/*  Route comparison                                                          */
/* -------------------------------------------------------------------------- */

export interface RouteLegDto {
  segmentId: string;
  name: string;
  corridor: string;
  distanceM: number;
  travelMin: number;
  entersAtMin: number;
  depthOnArrivalCm: number;
  floodProbability: number;
  riskLevel: string;
  isUnderpass: boolean;
  warning: string | null;
  impassable: boolean;
}

export interface RouteDto {
  mode: string;
  label: string;
  legs: RouteLegDto[];
  distanceM: number;
  durationMin: number;
  safeRouteScore: number;
  riskLevel: string;
  maxDepthCm: number;
  maxProbability: number;
  underpassCount: number;
  impassableCount: number;
}

export interface ComparisonDto {
  fastest: RouteDto;
  safest: RouteDto;
  identical: boolean;
  safeRouteExists: boolean;
  extraMinutes: number;
  riskReduction: number;
  depthReduction: number;
  explanations: {
    id: string;
    text: string;
    category: string;
    impact: string;
    weight: number;
    evidence?: { label: string; value: string }[];
  }[];
}

/**
 * Fastest versus safest.
 *
 * The single most important screen in the product. It exists to make one point
 * legible in under a second: the route a maps app would give you, and what it
 * costs you. The animated bars are load-bearing — the eye should land on the
 * risk difference before it reads either number.
 */
export function RouteComparison({
  comparison,
  onSelectLeg,
  className = "",
}: {
  comparison: ComparisonDto;
  onSelectLeg?: (segmentId: string) => void;
  className?: string;
}) {
  const t = useT();
  const { fastest, safest, identical, safeRouteExists, extraMinutes } = comparison;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <RouteCard
          route={fastest}
          accent="#f08a3c"
          title={t.route.fastest}
          subtitle={t.route.whatMapsGives}
          t={t}
        />
        <RouteCard
          route={safest}
          accent={safeRouteExists ? "#2fbf6f" : "#e8503a"}
          title={safeRouteExists ? t.route.recommended : t.route.leastDangerous}
          subtitle={
            safeRouteExists ? t.route.whatWeRecommend : t.route.bestAvailable
          }
          t={t}
          highlighted
        />
      </div>

      <Card>
        <div className="px-4 py-3">
          {identical ? (
            <p className="text-[13px] leading-relaxed text-fg-muted">
              {safeRouteExists ? t.route.sameRouteSafe : t.route.sameRouteUnsafe}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Metric
                label={t.route.extraTime}
                value={`+${Math.round(extraMinutes)}`}
                unit={t.common.min}
                size="sm"
              />
              <Metric
                label={t.route.riskReduction}
                value={`−${Math.round(comparison.riskReduction)}`}
                unit="pts"
                tone="safe"
                size="sm"
              />
              <Metric
                label={t.route.lessWater}
                value={`−${Math.round(comparison.depthReduction)}`}
                unit={t.common.cm}
                tone="safe"
                size="sm"
              />
              <Metric
                label={t.route.underpassesAvoided}
                value={Math.max(0, fastest.underpassCount - safest.underpassCount)}
                tone="safe"
                size="sm"
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow={t.route.segmentByStep}
          title={safeRouteExists ? t.route.recommended : t.route.leastDangerous}
          right={
            <Badge tone="neutral">
              {safest.legs.length} {t.route.roads}
            </Badge>
          }
        />
        <ol className="divide-y divide-line">
          {safest.legs.map((leg) => (
            <li key={leg.segmentId}>
              <button
                type="button"
                onClick={() => onSelectLeg?.(leg.segmentId)}
                className="w-full px-4 py-2.5 text-left transition-colors hover:bg-ink-800/70"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[12.5px] font-medium text-fg">
                    {leg.name}
                  </p>
                  <span className="numeric shrink-0 text-[11px] text-fg-faint">
                    +{Math.round(leg.entersAtMin)} min
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="w-24 shrink-0">
                    <Bar
                      value={Math.min(1, leg.depthOnArrivalCm / 45)}
                      color={leg.impassable ? "#e8503a" : "#4aa8ff"}
                    />
                  </div>
                  <span className="numeric text-[11px] text-fg-muted">
                    {leg.depthOnArrivalCm.toFixed(0)} cm
                  </span>
                  {leg.isUnderpass ? (
                    <Badge tone="warn">{t.route.underpass}</Badge>
                  ) : null}
                  {leg.impassable ? (
                    <Badge tone="danger">{t.route.impassable}</Badge>
                  ) : null}
                </div>
                {leg.warning ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-risk-high">
                    {leg.warning}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function RouteCard({
  route,
  accent,
  title,
  subtitle,
  t,
  highlighted = false,
}: {
  route: RouteDto;
  accent: string;
  title: string;
  subtitle: string;
  t: Messages;
  highlighted?: boolean;
}) {
  return (
    <div
      className={highlighted ? "surface-raised" : "surface"}
      style={{ borderTopWidth: 2, borderTopColor: accent }}
    >
      <div className="px-4 py-3">
        <p className="eyebrow mb-1">{title}</p>
        <p className="mb-3 text-[11px] text-fg-faint">{subtitle}</p>

        <div className="flex items-end justify-between gap-3">
          <p className="numeric text-3xl font-semibold leading-none">
            {Math.round(route.durationMin)}
            <span className="ms-1 text-sm font-medium text-fg-faint">
              {t.common.min}
            </span>
          </p>
          <RiskPill level={route.riskLevel}>
            {t.risk[route.riskLevel as keyof Messages["risk"]] ?? route.riskLevel}
          </RiskPill>
        </div>

        <div className="mt-4 space-y-2.5">
          <div>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-fg-faint">{t.route.safeRouteScore}</span>
              <span className="numeric font-semibold" style={{ color: accent }}>
                {route.safeRouteScore}/100
              </span>
            </div>
            <Bar value={route.safeRouteScore / 100} color={accent} />
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
            <span className="text-fg-faint">
              {t.stats.deepest}{" "}
              <span className="numeric font-semibold text-fg-muted">
                {route.maxDepthCm.toFixed(0)} {t.common.cm}
              </span>
            </span>
            <span className="text-fg-faint">
              {t.route.peakRisk}{" "}
              <span className="numeric font-semibold text-fg-muted">
                {Math.round(route.maxProbability * 100)}%
              </span>
            </span>
            <span className="text-fg-faint">
              {t.route.underpasses}{" "}
              <span className="numeric font-semibold text-fg-muted">
                {route.underpassCount}
              </span>
            </span>
            <span className="text-fg-faint">
              {(route.distanceM / 1000).toFixed(1)} km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Vehicle                                                                   */
/* -------------------------------------------------------------------------- */

export interface SurvivabilityDto {
  band: string;
  score: number;
  maxSafeWadeCm: number;
  intakeHeightCm: number;
  againstDepthCm: number;
  utilisation: number;
  reasons: { text: string; impact: string }[];
  flowWarning: string | null;
}

const BAND_COLOR: Record<string, string> = {
  safe: "#2fbf6f",
  borderline: "#e8b62c",
  unsafe: "#e8503a",
};

/**
 * Vehicle survivability card.
 *
 * Shows the depth gauge against the two thresholds that matter — safe wading
 * depth and air-intake height — because the difference between "you will stop"
 * and "you will destroy the engine" is the difference between an inconvenience
 * and a write-off.
 */
export function VehicleCard({
  vehicleName,
  survivability,
  className = "",
}: {
  vehicleName: string;
  survivability: SurvivabilityDto;
  className?: string;
}) {
  const t = useT();
  const color = BAND_COLOR[survivability.band] ?? BAND_COLOR.borderline;
  const bandLabel =
    survivability.band === "safe"
      ? t.vehicleCard.safe
      : survivability.band === "unsafe"
        ? t.vehicleCard.unsafe
        : t.vehicleCard.borderline;
  const bandBlurb =
    survivability.band === "safe"
      ? t.vehicleCard.safeBlurb
      : survivability.band === "unsafe"
        ? t.vehicleCard.unsafeBlurb
        : t.vehicleCard.borderlineBlurb;
  const scale = Math.max(
    survivability.intakeHeightCm * 1.15,
    survivability.againstDepthCm * 1.15,
    20,
  );

  const pct = (cm: number) => `${Math.min(100, (cm / scale) * 100)}%`;

  return (
    <Card className={className}>
      <CardHeader
        eyebrow={t.vehicleCard.title}
        title={vehicleName}
        right={
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: `${color}22`, color }}
          >
            {bandLabel}
          </span>
        }
      />

      <div className="px-4 py-4">
        <div className="mb-4 flex items-end gap-5">
          <Metric
            label={t.vehicleCard.waterOnRoute}
            value={survivability.againstDepthCm.toFixed(0)}
            unit={t.common.cm}
            size="lg"
          />
          <Metric
            label={t.vehicleCard.safeWadingDepth}
            value={survivability.maxSafeWadeCm.toFixed(0)}
            unit={t.common.cm}
            size="md"
            tone="muted"
          />
        </div>

        {/* Depth gauge against the vehicle's two thresholds. */}
        <div className="relative h-9 overflow-hidden rounded-lg bg-ink-850">
          <div
            className="absolute inset-y-0 left-0 bg-signal-500/25"
            style={{
              width: pct(survivability.againstDepthCm),
              transition: "width 700ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
          <Threshold
            left={pct(survivability.maxSafeWadeCm)}
            color="#e8b62c"
            label={t.vehicleCard.wadingLimit}
          />
          <Threshold
            left={pct(survivability.intakeHeightCm)}
            color="#e8503a"
            label={t.vehicleCard.airIntake}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-fg-faint">
          <span>0 {t.common.cm}</span>
          <span className="numeric">
            {Math.round(scale)} {t.common.cm}
          </span>
        </div>

        <p className="mt-3 text-[12px] text-fg-muted">{bandBlurb}</p>

        <ul className="mt-3 space-y-1.5">
          {survivability.reasons.slice(0, 5).map((reason, index) => (
            <li key={index} className="flex gap-2 text-[11.5px] leading-snug">
              <span
                className="mt-1 h-1 w-1 shrink-0 rounded-full"
                style={{
                  background:
                    reason.impact === "blocks"
                      ? "#e8503a"
                      : reason.impact === "increases-risk"
                        ? "#f08a3c"
                        : reason.impact === "reduces-risk"
                          ? "#2fbf6f"
                          : "#5f6c85",
                }}
                aria-hidden
              />
              <span className="text-fg-muted">{reason.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Threshold({
  left,
  color,
  label,
}: {
  left: string;
  color: string;
  label: string;
}) {
  return (
    <div
      className="absolute inset-y-0 w-px"
      style={{ left, background: color }}
      title={label}
    >
      <span
        className="absolute -top-0.5 left-1 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Decision                                                                  */
/* -------------------------------------------------------------------------- */

export interface DecisionOptionDto {
  action: string;
  label: string;
  headline: string;
  score: number;
  feasible: boolean;
  infeasibleReason: string | null;
  etaMin: number | null;
  riskLevel: string;
  standalone: boolean;
}

/**
 * The recommendation.
 *
 * Deliberately the largest, loudest element on the screen. Everything else in
 * the product exists to justify this one sentence.
 */
export function DecisionCard({
  primary,
  alternatives,
  parallel,
  emergencyContacts = [],
  className = "",
}: {
  primary: DecisionOptionDto;
  alternatives: DecisionOptionDto[];
  parallel: DecisionOptionDto[];
  emergencyContacts?: { name: string; authority: string; phone: string[] }[];
  className?: string;
}) {
  const t = useT();

  // The action verb is translated from its stable identifier; the headline that
  // follows interpolates live numbers and stays in English for now.
  const actionLabel = (option: DecisionOptionDto) =>
    t.decision[option.action as keyof Messages["decision"]] ?? option.label;

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        className="surface-raised px-5 py-5"
        style={{
          borderTopWidth: 3,
          borderTopColor:
            primary.riskLevel === "safe" || primary.riskLevel === "low"
              ? "#2fbf6f"
              : primary.riskLevel === "moderate"
                ? "#e8b62c"
                : "#e8503a",
        }}
      >
        <p className="eyebrow mb-2">{t.app.recommendedAction}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-fg">
          {actionLabel(primary)}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
          {primary.headline}
        </p>
        {primary.etaMin !== null ? (
          <p className="numeric mt-3 text-[12px] text-fg-faint">
            {t.app.estimatedJourney} {Math.round(primary.etaMin)} {t.common.min}
          </p>
        ) : null}
      </div>

      {parallel.map((option) => (
        <div
          key={option.action}
          className="surface px-4 py-3"
          style={{ borderInlineStartWidth: 2, borderInlineStartColor: "#e8503a" }}
        >
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[13px] font-semibold text-fg">
              {actionLabel(option)}
            </p>
            <Badge tone="danger">{t.app.actNow}</Badge>
          </div>
          <p className="text-[12px] leading-snug text-fg-muted">{option.headline}</p>
        </div>
      ))}

      {alternatives.length > 0 ? (
        <Card>
          <CardHeader
            eyebrow={t.app.alsoConsidered}
            title={t.app.otherOptions}
          />
          <ul className="divide-y divide-line">
            {alternatives.map((option) => (
              <li key={option.action} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12.5px] font-medium text-fg">
                    {actionLabel(option)}
                  </p>
                  <span className="numeric shrink-0 text-[11px] text-fg-faint">
                    {Math.round(option.score)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-fg-muted">
                  {option.headline}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {emergencyContacts.length > 0 ? (
        <Card>
          <CardHeader
            eyebrow={t.app.ifYouAreStuck}
            title={t.app.controlRooms}
          />
          <ul className="divide-y divide-line">
            {emergencyContacts.map((contact) => (
              <li key={contact.name} className="px-4 py-2.5">
                <p className="text-[12.5px] font-medium text-fg">{contact.name}</p>
                <p className="text-[11px] text-fg-faint">{contact.authority}</p>
                <p className="numeric mt-1 text-[12px] text-signal-300">
                  {contact.phone.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
