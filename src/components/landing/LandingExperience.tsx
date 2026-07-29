"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Lockup } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";
import type { Camera, CinematicSegment } from "@/components/map/CinematicMap";

const CinematicMap = dynamic(() => import("@/components/map/CinematicMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-ink-950" />,
});

/**
 * The landing page.
 *
 * Not a website about a product — the product, running, with a sentence over
 * it. Delhi's actual roads, coloured by their actual risk right now, and one
 * obvious thing to do next. The brief asked for something closer to opening
 * Apple Maps than to visiting a company's homepage, and the fastest way to
 * prove a map product is worth opening is to open it.
 *
 * Everything that used to be here — mechanisms, architecture, data sources,
 * limits — moved to /about, where it is still one click away and still
 * complete.
 */

interface PredictPayload {
  segments: {
    id: string;
    name: string;
    geometry: { lat: number; lng: number }[];
    state: {
      riskColor: string;
      probability: number;
      peakDepthCm: number;
      riskLevel: string;
    };
  }[];
  summary: {
    segmentsAtRisk: number;
    peakDepthCm: number;
    peopleExposed: number;
    nextOnsetMin: number | null;
    worstSegment: { id: string; name: string; depthCm: number } | null;
  };
}

const INDIA: Camera = { center: { lat: 22.4, lng: 79.2 }, zoom: 4.3, duration: 0 };
const DELHI: Camera = { center: { lat: 28.63, lng: 77.19 }, zoom: 10.4, duration: 3.6 };

export default function LandingExperience() {
  const t = useT();
  const { profile, hydrated } = useProfile();
  const [predict, setPredict] = useState<PredictPayload | null>(null);
  const [camera, setCamera] = useState<Camera>(INDIA);

  // Open on the country, then come down to the city. It costs one second and
  // it is the whole thesis of the product in one gesture: this is built for
  // India, and Delhi is where it starts.
  useEffect(() => {
    const timer = setTimeout(() => setCamera(DELHI), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/predict?scenario=live")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PredictPayload | null) => {
        if (!cancelled && data) setPredict(data);
      })
      .catch(() => {
        // The landing still works as a map without live risk on it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const segments = useMemo<CinematicSegment[]>(() => {
    if (!predict) return [];
    return predict.segments.map((segment) => ({
      id: segment.id,
      geometry: segment.geometry,
      color: segment.state.riskColor,
      intensity: Math.min(
        1,
        segment.state.probability * 0.6 + Math.min(1, segment.state.peakDepthCm / 40) * 0.4,
      ),
    }));
  }, [predict]);

  const returning = hydrated && profile.completedAt !== null;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0">
        {/* Interactive. The brief asked for a map as the background, and a map
            you cannot pan or zoom is a screenshot — the idle drift hands over
            the moment anyone touches it. */}
        <CinematicMap camera={camera} segments={segments} drift interactive />
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% -10%, transparent 24%, rgba(5,7,11,0.5) 60%, rgba(5,7,11,0.92) 100%)",
        }}
        aria-hidden
      />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      {/* Every overlay is transparent to the pointer and re-enables it only on
          the things that are actually controls. Otherwise a full-width bar
          silently eats every drag that starts along the top of the map. */}
      <header className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-4 px-4 py-4 sm:px-8">
        <Lockup size={15} />
        <nav className="pointer-events-auto ms-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/about"
            className="rounded-lg px-3 py-2 text-[12.5px] text-fg-muted transition-colors hover:text-fg"
          >
            {t.nav.about}
          </Link>
          <LanguageSwitcher compact />
        </nav>
      </header>

      {/* ── Live city card ───────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute end-4 top-20 z-20 sm:end-8 sm:top-24">
        <CityCard predict={predict} />
      </div>

      {/* ── The one thing to do ──────────────────────────────────────────── */}
      <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5 sm:justify-start sm:px-8 sm:pb-10">
        <div className="animate-arrive w-full max-w-[30rem]">
          <div className="float-card pointer-events-auto p-6 sm:p-7">
            <p className="eyebrow mb-3.5 flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-breathe absolute inset-0 rounded-full bg-risk-safe" />
                <span className="absolute inset-0 rounded-full bg-risk-safe/70" />
              </span>
              {t.landing.eyebrow}
            </p>

            <h1 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-tight sm:text-[34px]">
              {t.landing.title}
            </h1>

            <p className="mt-4 text-[13.5px] leading-relaxed text-fg-muted">
              {t.landing.lede}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href="/app"
                data-touch
                className="group inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-signal-500 px-6 text-[14px] font-semibold text-white shadow-lg shadow-signal-600/25 transition-all hover:bg-signal-400 hover:shadow-signal-500/30"
              >
                {returning ? t.landing.resume : t.landing.primaryCta}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                >
                  <path
                    d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="/about"
                data-touch
                className="inline-flex min-h-12 items-center rounded-xl border border-line-bright px-5 text-[13.5px] font-medium text-fg-muted transition-colors hover:text-fg"
              >
                {t.landing.secondaryCta}
              </Link>
            </div>

            <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
              {returning ? BRAND.meaning : t.landing.setupTime}
            </p>
          </div>
        </div>
      </div>

      {/* Risk ramp — the map's only legend, and the product's signature. */}
      <div className="pointer-events-none absolute bottom-5 end-4 z-20 hidden sm:block sm:bottom-10 sm:end-8">
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] uppercase tracking-widest text-fg-faint">
            {t.risk.safe}
          </span>
          <div className="flex gap-[3px]">
            {RISK_RAMP.map((color, i) => (
              <span
                key={color}
                className="animate-rise h-1 w-7 rounded-full"
                style={{ background: color, animationDelay: `${900 + i * 70}ms` }}
              />
            ))}
          </div>
          <span className="text-[9.5px] uppercase tracking-widest text-fg-faint">
            {t.risk.critical}
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Live conditions, in the corner.
 *
 * Three numbers, no chrome. It is here to prove the map is reading something
 * real, not to be a dashboard — anyone who wants the dashboard is one tap away
 * from it.
 */
function CityCard({ predict }: { predict: PredictPayload | null }) {
  const t = useT();

  if (!predict) {
    return (
      <div className="float-card shimmer w-[9.5rem] p-3.5">
        <div className="h-2 w-16 rounded bg-ink-800" />
        <div className="mt-3 h-5 w-10 rounded bg-ink-800" />
        <span className="shimmer-bar" />
      </div>
    );
  }

  const { summary } = predict;

  return (
    <div className="float-card animate-arrive w-[11rem] p-3.5 sm:w-[13rem] sm:p-4">
      <p className="eyebrow mb-3">{t.landing.cityRightNow}</p>

      <div className="space-y-2.5">
        <Row
          label={t.stats.roadsAtRisk}
          value={String(summary.segmentsAtRisk)}
          tone={summary.segmentsAtRisk > 0 ? "risk" : "safe"}
        />
        <Row
          label={t.stats.deepest}
          value={`${summary.peakDepthCm.toFixed(0)} ${t.common.cm}`}
        />
        <Row label={t.landing.roadsWatched} value="120" />
      </div>

      {summary.worstSegment && summary.worstSegment.depthCm >= 8 ? (
        <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-snug text-fg-faint">
          {summary.worstSegment.name}
          <span className="numeric ms-1 text-risk-high">
            {summary.worstSegment.depthCm.toFixed(0)} cm
          </span>
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "risk" | "safe";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-[10.5px] text-fg-faint">{label}</span>
      <span
        className={`numeric shrink-0 text-[15px] font-semibold ${
          tone === "risk"
            ? "text-risk-high"
            : tone === "safe"
              ? "text-risk-safe"
              : "text-fg"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const RISK_RAMP = [
  "#2fbf6f",
  "#8fc93a",
  "#e8b62c",
  "#f08a3c",
  "#e8503a",
  "#b32b1d",
];
