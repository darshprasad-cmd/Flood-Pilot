"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mark, Wordmark } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { haversineM } from "@/lib/core/math";
import { useT } from "@/lib/i18n";
import { COMMUTE_MODES, useProfile, type CommuteMode, type UserProfile } from "@/lib/profile";
import { DEMO_PROFILE } from "@/lib/profile/types";
import type { Camera, CinematicPin } from "@/components/map/CinematicMap";

const CinematicMap = dynamic(() => import("@/components/map/CinematicMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-ink-950" />,
});

/**
 * First run.
 *
 * The brief was explicit: not a registration form. So this is a conversation
 * that happens over a map — one question at a time, and every answer moves the
 * camera. India, then Delhi NCR, then the locality they name, then their own
 * streets. By the last question the map is already theirs, which is the point:
 * the setup *is* the demonstration.
 *
 * Only questions that change an answer are asked. Somebody who takes the Metro
 * is never asked what they drive, because the vehicle model would have nothing
 * to say about their journey.
 */

interface NodeOption {
  id: string;
  name: string;
  at: { lat: number; lng: number };
  ward: string;
  metro: { station: string } | null;
}

interface VehicleOption {
  id: string;
  manufacturer: string;
  model: string;
  bodyType: string;
  groundClearanceMm: number;
  popularInDelhi?: boolean;
}

interface CityPayload {
  city: { name: string; center: { lat: number; lng: number } };
  nodes: NodeOption[];
  vehicles: VehicleOption[];
}

type StepId =
  | "welcome"
  | "home"
  | "work"
  | "commute"
  | "vehicle"
  | "basement"
  | "frequent"
  | "proactive"
  | "emergency"
  | "building";

/** The opening shot. Roughly the whole country in frame. */
const INDIA: Camera = {
  center: { lat: 22.4, lng: 79.2 },
  zoom: 4.3,
  duration: 0,
};

/** Areas people actually live in, offered before anyone starts typing. */
const COMMON_HOME_IDS = [
  "dwarka",
  "rohini",
  "saket",
  "mayurvihar",
  "vasantkunj",
  "laxminagar",
  "pitampura",
  "janakpuri",
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const { profile, replace } = useProfile();
  const [city, setCity] = useState<CityPayload | null>(null);
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [stepId, setStepId] = useState<StepId>("welcome");
  const [query, setQuery] = useState("");

  const finish = useCallback(
    (over?: Partial<UserProfile>) => {
      replace({
        ...draft,
        ...over,
        completedAt: new Date().toISOString(),
      });
      onComplete();
    },
    [draft, onComplete, replace],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/city")
      .then((r) => r.json())
      .then((data: CityPayload) => {
        if (!cancelled) setCity(data);
      })
      .catch(() => {
        // Onboarding cannot run without the junction list. Rather than show a
        // dead form, fall through to the demo profile so the product still
        // opens — the app itself will surface the network error properly.
        if (!cancelled) finish(DEMO_PROFILE);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nodeById = useCallback(
    (id: string | null) => (id ? city?.nodes.find((n) => n.id === id) ?? null : null),
    [city],
  );

  const home = nodeById(draft.homeNodeId);
  const work = nodeById(draft.workNodeId);

  /* ── Which questions are worth asking ────────────────────────────────── */
  const steps = useMemo<StepId[]>(() => {
    const ownsVehicle =
      COMMUTE_MODES.find((m) => m.id === draft.commuteMode)?.ownsVehicle ?? false;
    return [
      "welcome",
      "home",
      "work",
      "commute",
      ...(ownsVehicle ? (["vehicle", "basement"] as StepId[]) : []),
      "frequent",
      "proactive",
      "emergency",
      "building",
    ];
  }, [draft.commuteMode]);

  const index = Math.max(0, steps.indexOf(stepId));
  const questionCount = steps.length - 2; // welcome and building are not questions

  const go = useCallback(
    (delta: number) => {
      setQuery("");
      const next = steps[Math.min(steps.length - 1, Math.max(0, index + delta))];
      setStepId(next);
    },
    [index, steps],
  );

  // The closing beat: hold on the neighbourhood for a moment so the flight
  // lands before the dashboard replaces it. Cutting straight there wastes the
  // one shot the product has at feeling like it understood something.
  useEffect(() => {
    if (stepId !== "building") return;
    const timer = setTimeout(() => finish(), 2200);
    return () => clearTimeout(timer);
  }, [stepId, finish]);

  /* ── Camera choreography ─────────────────────────────────────────────── */
  const camera = useMemo<Camera>(() => {
    const cityCentre = city?.city.center ?? { lat: 28.62, lng: 77.21 };
    switch (stepId) {
      case "welcome":
        return INDIA;
      case "home":
        // The first real flight: the whole country down to one metropolitan
        // area. Long, because this is the moment the product says what it is.
        return { center: cityCentre, zoom: 9.4, duration: 3.4 };
      case "work":
        return home
          ? { center: home.at, zoom: 12.6, duration: 2.6 }
          : { center: cityCentre, zoom: 9.4 };
      case "commute":
      case "frequent":
        return home && work
          ? { center: home.at, zoom: 11, fit: [home.at, work.at], duration: 2.4 }
          : { center: home?.at ?? cityCentre, zoom: 12.4 };
      case "vehicle":
        return { center: home?.at ?? cityCentre, zoom: 13.4, duration: 2 };
      case "basement":
        // Close enough to see individual buildings — the question is about a
        // ramp under one of them.
        return { center: home?.at ?? cityCentre, zoom: 15.2, duration: 2 };
      case "proactive":
      case "emergency":
        return { center: home?.at ?? cityCentre, zoom: 12.2, duration: 2 };
      case "building":
        return { center: home?.at ?? cityCentre, zoom: 14.4, duration: 2.6 };
    }
  }, [stepId, city, home, work]);

  const pins = useMemo<CinematicPin[]>(() => {
    if (stepId === "welcome") {
      const centre = city?.city.center ?? { lat: 28.62, lng: 77.21 };
      return [{ id: "delhi", at: centre, kind: "focus", label: t.onboarding.placeCity }];
    }
    const out: CinematicPin[] = [];
    if (home) out.push({ id: "home", at: home.at, kind: "home", label: home.name });
    if (work && stepId !== "home" && stepId !== "work")
      out.push({ id: "work", at: work.at, kind: "work", label: work.name });
    for (const id of draft.frequentNodeIds) {
      const node = nodeById(id);
      if (node) out.push({ id, at: node.at, kind: "frequent" });
    }
    return out;
  }, [stepId, home, work, city, draft.frequentNodeIds, nodeById, t.onboarding.placeCity]);

  /* ── Where the camera says we are ────────────────────────────────────── */
  const place =
    stepId === "welcome"
      ? t.onboarding.placeIndia
      : home
        ? home.ward
        : (city?.city.name ?? t.onboarding.placeCity);

  const nodes = city?.nodes ?? [];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0">
        <CinematicMap camera={camera} pins={pins} interactive={false} />
      </div>

      {/* Vignette. Without it, a question card over a bright arterial road is
          unreadable at exactly the zoom levels this flow spends most time at. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, transparent 20%, rgba(5,7,11,0.55) 62%, rgba(5,7,11,0.9) 100%)",
        }}
        aria-hidden
      />

      {/* ── Chrome ───────────────────────────────────────────────────────── */}
      <header className="safe-top absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <Mark size={22} className="text-fg-muted" />
          <div>
            <Wordmark size={14} />
            <p
              key={place}
              className="animate-fade text-[10.5px] uppercase tracking-[0.14em] text-fg-faint"
            >
              {place}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          {stepId !== "building" ? (
            <button
              type="button"
              onClick={() => finish(DEMO_PROFILE)}
              className="rounded-lg px-3 py-2 text-[12px] text-fg-faint transition-colors hover:text-fg-muted"
            >
              {t.onboarding.skipSetup}
            </button>
          ) : null}
        </div>
      </header>

      {/* ── The conversation ─────────────────────────────────────────────── */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:justify-start sm:p-8">
        <div key={stepId} className="animate-arrive w-full max-w-[27rem]">
          {stepId === "welcome" ? (
            <Welcome onBegin={() => go(1)} />
          ) : stepId === "building" ? (
            <Building />
          ) : (
            <QuestionCard
              index={index}
              total={questionCount}
              onBack={index > 1 ? () => go(-1) : undefined}
            >
              {stepId === "home" ? (
                <PlacePicker
                  question={t.onboarding.qHome}
                  hint={t.onboarding.hHome}
                  nodes={nodes}
                  query={query}
                  onQuery={setQuery}
                  suggestions={COMMON_HOME_IDS}
                  onPick={(id) => {
                    setDraft((d) => ({ ...d, homeNodeId: id }));
                    go(1);
                  }}
                />
              ) : stepId === "work" ? (
                <PlacePicker
                  question={t.onboarding.qWork}
                  hint={t.onboarding.hWork}
                  nodes={nodes.filter((n) => n.id !== draft.homeNodeId)}
                  query={query}
                  onQuery={setQuery}
                  suggestions={["cp", "ito", "nehruplace", "okhla", "noida18", "saket"]}
                  onPick={(id) => {
                    setDraft((d) => ({ ...d, workNodeId: id }));
                    go(1);
                  }}
                />
              ) : stepId === "commute" ? (
                <Choice
                  question={t.onboarding.qCommute}
                  hint={t.onboarding.hCommute}
                  options={COMMUTE_MODES.map((m) => ({
                    value: m.id,
                    label: t.commute[m.id],
                  }))}
                  selected={draft.commuteMode}
                  onPick={(value) => {
                    const mode = value as CommuteMode;
                    setDraft((d) => ({ ...d, commuteMode: mode }));
                    // Named explicitly rather than stepped through, because
                    // this answer is what decides whether the vehicle
                    // questions exist — and `steps` is still the pre-answer
                    // list on this render.
                    const ownsVehicle =
                      COMMUTE_MODES.find((m) => m.id === mode)?.ownsVehicle ?? false;
                    setQuery("");
                    setStepId(ownsVehicle ? "vehicle" : "frequent");
                  }}
                />
              ) : stepId === "vehicle" ? (
                <VehiclePicker
                  question={t.onboarding.qVehicle}
                  hint={t.onboarding.hVehicle}
                  vehicles={city?.vehicles ?? []}
                  value={draft}
                  onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                  onNext={() => go(1)}
                />
              ) : stepId === "basement" ? (
                <YesNo
                  question={t.onboarding.qBasement}
                  hint={t.onboarding.hBasement}
                  yes={t.common.yes}
                  no={t.common.no}
                  onPick={(value) => {
                    setDraft((d) => ({ ...d, basementParking: value }));
                    go(1);
                  }}
                />
              ) : stepId === "frequent" ? (
                <MultiPicker
                  question={t.onboarding.qFrequent}
                  hint={t.onboarding.hFrequent}
                  nodes={nearest(nodes, home?.at, [draft.homeNodeId, draft.workNodeId], 9)}
                  selected={draft.frequentNodeIds}
                  onToggle={(id) =>
                    setDraft((d) => ({
                      ...d,
                      frequentNodeIds: d.frequentNodeIds.includes(id)
                        ? d.frequentNodeIds.filter((x) => x !== id)
                        : [...d.frequentNodeIds, id],
                    }))
                  }
                  next={t.common.continue}
                  onNext={() => go(1)}
                />
              ) : stepId === "proactive" ? (
                <YesNo
                  question={t.onboarding.qProactive}
                  hint={t.onboarding.hProactive}
                  yes={t.common.yes}
                  no={t.common.no}
                  onPick={(value) => {
                    setDraft((d) => ({ ...d, proactiveAlerts: value }));
                    go(1);
                  }}
                />
              ) : (
                <YesNo
                  question={t.onboarding.qEmergency}
                  hint={t.onboarding.hEmergency}
                  yes={t.common.yes}
                  no={t.common.no}
                  onPick={(value) => {
                    setDraft((d) => ({ ...d, emergencyAlerts: value }));
                    go(1);
                  }}
                />
              )}
            </QuestionCard>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Welcome({ onBegin }: { onBegin: () => void }) {
  const t = useT();
  return (
    <div className="float-card p-6 sm:p-7">
      <h1 className="text-balance text-[26px] font-semibold leading-[1.14] tracking-tight sm:text-[30px]">
        {t.onboarding.welcomeTitle}
      </h1>
      <p className="mt-3.5 text-[13.5px] leading-relaxed text-fg-muted">
        {t.onboarding.welcomeBody}
      </p>
      <button
        type="button"
        onClick={onBegin}
        className="mt-6 min-h-12 w-full rounded-xl bg-signal-500 px-5 text-[14px] font-semibold text-white shadow-lg shadow-signal-600/25 transition-colors hover:bg-signal-400"
      >
        {t.onboarding.welcomeCta}
      </button>
      <p className="mt-3 text-center text-[11px] text-fg-faint">
        {t.onboarding.welcomeNote}
      </p>
    </div>
  );
}

function Building() {
  const t = useT();
  return (
    <div className="float-card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-breathe absolute inset-0 rounded-full bg-signal-400" />
          <span className="absolute inset-0 rounded-full bg-signal-500" />
        </span>
        <h2 className="text-[17px] font-semibold tracking-tight">
          {t.onboarding.buildingTitle}
        </h2>
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-fg-muted">
        {t.onboarding.buildingBody}
      </p>
      <div className="shimmer mt-5 h-1 overflow-hidden rounded-full bg-ink-800">
        <span className="shimmer-bar" />
      </div>
    </div>
  );
}

function QuestionCard({
  index,
  total,
  onBack,
  children,
}: {
  index: number;
  total: number;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="float-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-4">
        {/* Answered, current, remaining. The bar counts questions *behind*
            you, so it is empty on the first one rather than claiming credit
            for a question nobody has answered yet. */}
        <div className="flex flex-1 gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${
                i < index - 1
                  ? "bg-signal-500"
                  : i === index - 1
                    ? "bg-signal-500/45"
                    : "bg-ink-750"
              }`}
            />
          ))}
        </div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-me-2 shrink-0 rounded-lg px-2 py-1 text-[11.5px] text-fg-faint transition-colors hover:text-fg-muted"
          >
            {t.common.back}
          </button>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Prompt({ question, hint }: { question: string; hint: string }) {
  return (
    <>
      <h2 className="text-balance text-[19px] font-semibold leading-snug tracking-tight sm:text-[21px]">
        {question}
      </h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">{hint}</p>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function PlacePicker({
  question,
  hint,
  nodes,
  query,
  onQuery,
  suggestions,
  onPick,
}: {
  question: string;
  hint: string;
  nodes: NodeOption[];
  query: string;
  onQuery: (value: string) => void;
  suggestions: string[];
  onPick: (id: string) => void;
}) {
  const t = useT();
  const trimmed = query.trim().toLowerCase();

  const { picks, rest } = useMemo(() => {
    if (trimmed) {
      return {
        picks: [] as NodeOption[],
        rest: nodes
          .filter(
            (n) =>
              n.name.toLowerCase().includes(trimmed) ||
              n.ward.toLowerCase().includes(trimmed),
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    }
    // Suggestions first, then everything else alphabetically under its own
    // heading. A dropdown of 87 junctions is a database query; eight familiar
    // names is a choice — but only if the eight are visibly separate from the
    // eighty, or "common choices" ends up labelling the entire city.
    const chosen = suggestions
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NodeOption => Boolean(n));
    return {
      picks: chosen,
      rest: [...nodes]
        .filter((n) => !chosen.some((p) => p.id === n.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [nodes, suggestions, trimmed]);

  return (
    <>
      <Prompt question={question} hint={hint} />

      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={t.onboarding.searchPlaceholder}
        autoComplete="off"
        className="mt-4 w-full rounded-xl border border-line-bright bg-ink-850/80 px-3.5 py-2.5 text-[14px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-signal-500"
      />

      <div className="mt-3 max-h-[38dvh] overflow-y-auto overscroll-contain">
        {picks.length === 0 && rest.length === 0 ? (
          <p className="px-1 py-4 text-[12.5px] text-fg-faint">
            {t.onboarding.noMatches}
          </p>
        ) : null}

        {picks.length > 0 ? (
          <>
            <p className="eyebrow px-1 pb-1 pt-1">{t.onboarding.popular}</p>
            <ul>
              {picks.map((node) => (
                <PlaceRow key={node.id} node={node} onPick={onPick} />
              ))}
            </ul>
            <p className="eyebrow border-t border-line px-1 pb-1 pt-3.5">
              {t.onboarding.allAreas}
            </p>
          </>
        ) : null}

        <ul>
          {rest.map((node) => (
            <PlaceRow key={node.id} node={node} onPick={onPick} />
          ))}
        </ul>
      </div>
    </>
  );
}

function PlaceRow({
  node,
  onPick,
}: {
  node: NodeOption;
  onPick: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(node.id)}
        className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2.5 text-start transition-colors hover:bg-ink-800/80"
      >
        <span className="truncate text-[13.5px] font-medium text-fg">{node.name}</span>
        <span className="shrink-0 text-[11px] text-fg-faint">{node.ward}</span>
      </button>
    </li>
  );
}

function Choice({
  question,
  hint,
  options,
  selected,
  onPick,
}: {
  question: string;
  hint: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onPick: (value: string) => void;
}) {
  return (
    <>
      <Prompt question={question} hint={hint} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            className={`min-h-12 rounded-xl border px-3 py-3 text-[13.5px] font-medium transition-colors ${
              selected === option.value
                ? "border-signal-500 bg-signal-500/15 text-fg"
                : "border-line-bright bg-ink-850/60 text-fg-muted hover:border-line-bright hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

function YesNo({
  question,
  hint,
  yes,
  no,
  onPick,
}: {
  question: string;
  hint: string;
  yes: string;
  no: string;
  onPick: (value: boolean) => void;
}) {
  return (
    <>
      <Prompt question={question} hint={hint} />
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onPick(true)}
          className="min-h-12 rounded-xl bg-signal-500 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-signal-400"
        >
          {yes}
        </button>
        <button
          type="button"
          onClick={() => onPick(false)}
          className="min-h-12 rounded-xl border border-line-bright bg-ink-850/60 px-4 text-[14px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          {no}
        </button>
      </div>
    </>
  );
}

function MultiPicker({
  question,
  hint,
  nodes,
  selected,
  onToggle,
  next,
  onNext,
}: {
  question: string;
  hint: string;
  nodes: NodeOption[];
  selected: string[];
  onToggle: (id: string) => void;
  next: string;
  onNext: () => void;
}) {
  const t = useT();
  return (
    <>
      <Prompt question={question} hint={hint} />
      <div className="mt-4 flex flex-wrap gap-2">
        {nodes.map((node) => {
          const on = selected.includes(node.id);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onToggle(node.id)}
              className={`rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
                on
                  ? "border-signal-500 bg-signal-500/15 text-fg"
                  : "border-line-bright bg-ink-850/60 text-fg-muted hover:text-fg"
              }`}
            >
              {node.name}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-5 min-h-12 w-full rounded-xl bg-signal-500 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-signal-400"
      >
        {next}
      </button>
      <p className="mt-2.5 text-center text-[11px] text-fg-faint">
        {t.onboarding.optionalNote}
      </p>
    </>
  );
}

function VehiclePicker({
  question,
  hint,
  vehicles,
  value,
  onChange,
  onNext,
}: {
  question: string;
  hint: string;
  vehicles: VehicleOption[];
  value: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onNext: () => void;
}) {
  const t = useT();
  const sorted = useMemo(
    () =>
      [...vehicles].sort((a, b) => {
        if (!!b.popularInDelhi !== !!a.popularInDelhi) return b.popularInDelhi ? 1 : -1;
        return `${a.manufacturer} ${a.model}`.localeCompare(
          `${b.manufacturer} ${b.model}`,
        );
      }),
    [vehicles],
  );

  // Nothing chosen yet means the first popular vehicle, so the control is never
  // showing a blank while the person reads the question.
  const current = value.vehicleId ?? sorted[0]?.id ?? "";

  return (
    <>
      <Prompt question={question} hint={hint} />

      <select
        value={current}
        onChange={(e) => onChange({ vehicleId: e.target.value })}
        className="mt-4 w-full rounded-xl border border-line-bright bg-ink-850/80 px-3.5 py-3 text-[14px] text-fg outline-none focus:border-signal-500"
        aria-label={question}
      >
        {sorted.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.manufacturer} {vehicle.model} — {vehicle.groundClearanceMm} mm
          </option>
        ))}
      </select>

      <label className="mt-3 block">
        <span className="eyebrow mb-1.5 block">{t.app.year}</span>
        <input
          type="number"
          min={1990}
          max={2026}
          value={value.vehicleYear}
          onChange={(e) => onChange({ vehicleYear: Number(e.target.value) })}
          className="numeric w-full rounded-xl border border-line-bright bg-ink-850/80 px-3.5 py-3 text-[14px] outline-none focus:border-signal-500"
        />
      </label>

      <button
        type="button"
        onClick={() => {
          onChange({ vehicleId: current });
          onNext();
        }}
        className="mt-5 min-h-12 w-full rounded-xl bg-signal-500 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-signal-400"
      >
        {t.common.continue}
      </button>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/** The `count` junctions closest to `origin`, excluding ids already chosen. */
function nearest(
  nodes: NodeOption[],
  origin: { lat: number; lng: number } | undefined,
  exclude: (string | null)[],
  count: number,
): NodeOption[] {
  const skip = new Set(exclude.filter(Boolean) as string[]);
  const pool = nodes.filter((n) => !skip.has(n.id));
  if (!origin) return pool.slice(0, count);
  return [...pool]
    .sort((a, b) => haversineM(origin, a.at) - haversineM(origin, b.at))
    .slice(0, count);
}
