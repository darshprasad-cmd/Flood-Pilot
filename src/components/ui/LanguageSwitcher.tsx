"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_ORDER, useI18n } from "@/lib/i18n";

/**
 * Language picker.
 *
 * Shows each language in its own script alongside *why it is here* — Delhi's
 * linguistic reality, not a flag menu. Someone scanning this should be able to
 * tell at a glance that Bhojpuri is present because of the migrant communities
 * in the floodplain settlements, not as decoration.
 */
export function LanguageSwitcher({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { locale, meta, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.meta.chooseLanguage}
        className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-2.5 py-1.5 text-[12px] text-fg-muted transition-colors hover:text-fg"
      >
        <GlobeIcon />
        <span style={{ fontFamily: meta.fontFamily }}>{meta.nativeName}</span>
        {!compact ? <Chevron open={open} /> : null}
      </button>

      {open ? (
        <div
          role="listbox"
          className="glass animate-rise absolute end-0 top-[calc(100%+6px)] z-50 max-h-[70vh] w-64 overflow-y-auto rounded-xl p-1 shadow-2xl"
        >
          <p className="eyebrow px-3 pb-1.5 pt-2">{t.meta.chooseLanguage}</p>

          {LOCALE_ORDER.map((code) => {
            const item = LOCALES[code];
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                dir={item.dir}
                className={`flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2 text-start transition-colors ${
                  active ? "bg-signal-500/12" : "hover:bg-ink-800"
                }`}
              >
                <span
                  className={`mt-0.5 text-[14px] ${active ? "text-signal-300" : "text-fg"}`}
                  style={{ fontFamily: item.fontFamily }}
                >
                  {item.nativeName}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-fg-muted">
                    {item.name}
                  </span>
                  <span className="block text-[10.5px] leading-snug text-fg-faint">
                    {item.role}
                  </span>
                </span>
                {active ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="mt-1 shrink-0 text-signal-300"
                    aria-hidden
                  >
                    <path
                      d="M3 8.5l3.5 3.5L13 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}

          <p className="border-t border-line px-3 py-2 text-[10.5px] leading-snug text-fg-faint">
            {t.meta.translationNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2C6.2 4 6.2 12 8 14"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
