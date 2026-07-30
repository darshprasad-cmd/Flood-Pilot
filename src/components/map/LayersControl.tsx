"use client";

import { useState } from "react";
import { LAYER_META, MAP_LAYERS, type MapLayerId } from "@/lib/community/types";
import { useT } from "@/lib/i18n";

export type LayerState = Record<MapLayerId, boolean>;

export function defaultLayerState(): LayerState {
  return Object.fromEntries(
    MAP_LAYERS.map((id) => [id, LAYER_META[id].defaultOn]),
  ) as LayerState;
}

/**
 * Map layer switcher.
 *
 * Collapsed to a single control by default because nine toggles permanently on
 * screen is not a map, it is a settings panel. Each layer carries a one-line
 * description, since "Alerts" on its own does not tell anybody what turning it
 * on will show them.
 *
 * `LAYER_META` supplies the colour and the default; the words come from the
 * dictionary, keyed by the same layer id. A hazard switch labelled in a
 * language somebody does not read is a hazard switch nobody will touch.
 */
export function LayersControl({
  state,
  onChange,
  className = "",
}: {
  state: LayerState;
  onChange: (next: LayerState) => void;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const activeCount = MAP_LAYERS.filter((id) => state[id]).length;

  const toggle = (id: MapLayerId) => onChange({ ...state, [id]: !state[id] });

  return (
    <div className={className}>
      {/* The dropdown anchors to this inner element rather than to the one the
          caller styles. Callers position this control themselves, and two
          position utilities on a single element are settled by stylesheet order
          rather than by the order they were written — which left the control
          `relative` and nudged out of normal flow instead of pinned to the map. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="glass flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <LayersIcon />
          {t.layers.title}
          <span className="numeric rounded-full bg-ink-800 px-1.5 py-0.5 text-[10px]">
            {activeCount}
          </span>
        </button>

        {open ? (
          <div className="glass animate-rise absolute bottom-[calc(100%+8px)] start-0 z-30 max-h-[60vh] w-72 overflow-y-auto rounded-xl p-1.5">
            {MAP_LAYERS.map((id) => {
              const meta = LAYER_META[id];
              const copy = t.layers[id];
              const on = state[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  role="switch"
                  aria-checked={on}
                  className="flex min-h-11 w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-ink-800"
                >
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-[4px] border transition-colors"
                    style={{
                      background: on ? meta.colour : "transparent",
                      borderColor: on ? meta.colour : "var(--color-line-bright)",
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-[12px] font-medium ${on ? "text-fg" : "text-fg-muted"}`}
                    >
                      {copy.label}
                    </span>
                    <span className="block text-[10.5px] leading-snug text-fg-faint">
                      {copy.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2 2 5l6 3 6-3-6-3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M2 8.5 8 11.5l6-3M2 11.5 8 14.5l6-3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
