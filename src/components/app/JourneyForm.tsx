"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n";

export interface JourneyFormState {
  origin: string;
  destination: string;
  vehicleId: string;
  vehicleYear: number;
  tyreType: string;
  purpose: string;
  urgency: string;
  canWorkRemotely: boolean;
  departInMin: number;
}

interface NodeOption {
  id: string;
  name: string;
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

/**
 * Journey setup.
 *
 * Kept to one column and one screen. Every field here changes the answer
 * materially — journey purpose decides whether "cancel" is even on the table,
 * and the vehicle decides what counts as passable — so none of them are
 * decoration, but neither should any of them be a barrier to a first result.
 * The app plans a default journey on load rather than presenting an empty form.
 */
export function JourneyForm({
  nodes,
  vehicles,
  purposes,
  value,
  onChange,
  onSubmit,
  busy,
}: {
  nodes: NodeOption[];
  vehicles: VehicleOption[];
  purposes: { id: string; label: string; blurb: string }[];
  value: JourneyFormState;
  onChange: (next: JourneyFormState) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const t = useT();
  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.name.localeCompare(b.name)),
    [nodes],
  );

  const sortedVehicles = useMemo(
    () =>
      [...vehicles].sort((a, b) => {
        if (!!b.popularInDelhi !== !!a.popularInDelhi) {
          return b.popularInDelhi ? 1 : -1;
        }
        return `${a.manufacturer} ${a.model}`.localeCompare(
          `${b.manufacturer} ${b.model}`,
        );
      }),
    [vehicles],
  );

  const selectedVehicle = vehicles.find((v) => v.id === value.vehicleId);
  const set = <K extends keyof JourneyFormState>(
    key: K,
    v: JourneyFormState[K],
  ) => onChange({ ...value, [key]: v });

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section className="space-y-3">
        <h2 className="eyebrow">{t.app.journey}</h2>

        <Field label={t.app.from}>
          <Select
            value={value.origin}
            onChange={(v) => set("origin", v)}
            options={sortedNodes.map((n) => ({
              value: n.id,
              label: n.name,
              hint: n.ward,
            }))}
          />
        </Field>

        <Field label={t.app.to}>
          <Select
            value={value.destination}
            onChange={(v) => set("destination", v)}
            options={sortedNodes.map((n) => ({
              value: n.id,
              label: n.name,
              hint: n.ward,
            }))}
          />
        </Field>

        <Field
          label={`${t.app.leavingIn} ${value.departInMin} ${t.common.min}`}
        >
          <input
            type="range"
            min={0}
            max={180}
            step={5}
            value={value.departInMin}
            onChange={(e) => set("departInMin", Number(e.target.value))}
            className="w-full accent-signal-500"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-fg-faint">
            <span>{t.common.now}</span>
            <span>{t.app.threeHours}</span>
          </div>
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">{t.app.vehicle}</h2>

        <Field label={t.app.model}>
          <Select
            value={value.vehicleId}
            onChange={(v) => set("vehicleId", v)}
            options={sortedVehicles.map((v) => ({
              value: v.id,
              label: `${v.manufacturer} ${v.model}`,
              hint: `${v.groundClearanceMm} mm`,
            }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t.app.year}>
            <input
              type="number"
              min={1990}
              max={2026}
              value={value.vehicleYear}
              onChange={(e) => set("vehicleYear", Number(e.target.value))}
              className="numeric w-full rounded-lg border border-line bg-ink-850 px-2.5 py-2 text-[13px] outline-none focus:border-signal-500"
            />
          </Field>

          <Field label={t.app.tyres}>
            <Select
              value={value.tyreType}
              onChange={(v) => set("tyreType", v)}
              options={[
                { value: "standard", label: t.tyre.standard },
                { value: "wet_grip", label: t.tyre.wet_grip },
                { value: "all_terrain", label: t.tyre.all_terrain },
                { value: "worn", label: t.tyre.worn },
              ]}
            />
          </Field>
        </div>

        {selectedVehicle ? (
          <p className="text-[11px] leading-snug text-fg-faint">
            {selectedVehicle.groundClearanceMm} mm ground clearance ·{" "}
            <span className="capitalize">
              {selectedVehicle.bodyType.replace("_", " ")}
            </span>
            . {t.app.clearanceHint}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">{t.app.context}</h2>

        <Field label={t.app.purpose}>
          <Select
            value={value.purpose}
            onChange={(v) => set("purpose", v)}
            options={purposes.map((p) => ({ value: p.id, label: p.label }))}
          />
        </Field>

        <Field label={t.app.urgency}>
          <Select
            value={value.urgency}
            onChange={(v) => set("urgency", v)}
            options={[
              { value: "flexible", label: t.urgency.flexible },
              { value: "deadline", label: t.urgency.deadline },
              { value: "leave_now", label: t.urgency.leave_now },
            ]}
          />
        </Field>

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[12px] text-fg-muted">
          <input
            type="checkbox"
            checked={value.canWorkRemotely}
            onChange={(e) => set("canWorkRemotely", e.target.checked)}
            className="h-4 w-4 accent-signal-500"
          />
          {t.app.canWorkRemotely}
        </label>
      </section>

      <button
        type="submit"
        disabled={busy}
        className="min-h-12 w-full rounded-lg bg-signal-500 px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t.app.planning : t.app.plan}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-ink-850 px-2.5 py-2 text-[13px] text-fg outline-none focus:border-signal-500"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
          {option.hint ? ` — ${option.hint}` : ""}
        </option>
      ))}
    </select>
  );
}
