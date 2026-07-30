"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { SEVERITY_COLOR, type WatchAlert } from "@/lib/alerts/types";
import {
  notifyState,
  requestNotifyPermission,
  type NotifyState,
} from "@/lib/alerts/notify";

/**
 * The alert centre.
 *
 * A bell with a count and a sheet behind it. The count is the number of alerts
 * this person has not already been shown — not the number that exist — so an
 * unchanged situation stops shouting after the first look, while an escalation
 * gets a fresh id and starts shouting again.
 */

export function AlertBell({
  unread,
  highest,
  onOpen,
  label,
}: {
  unread: number;
  highest: string | null;
  onOpen: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={unread > 0 ? `${label} (${unread})` : label}
      className="relative rounded-lg p-2 text-fg-muted transition-colors hover:text-fg"
    >
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M10 3a4.5 4.5 0 0 0-4.5 4.5c0 3.2-1 4.4-1.5 5h12c-.5-.6-1.5-1.8-1.5-5A4.5 4.5 0 0 0 10 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8.3 15a1.8 1.8 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {unread > 0 ? (
        <span
          className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-ink-950"
          style={{ background: highest ? SEVERITY_COLOR[highest as keyof typeof SEVERITY_COLOR] : "#4aa8ff" }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}

/** Everything the browser would normally put in the Tab order. */
const FOCUS_STOPS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Dialog behaviour for a slide-over.
 *
 * Focus capture and restore get their own mount-only effect deliberately. The
 * caller passes an inline `onClose` arrow, so an effect that depended on
 * `onClose` would tear down and re-run on every parent render — pulling focus
 * back to the bell behind the sheet mid-interaction. The key handler reads the
 * latest `onClose` from a ref for the same reason, so the listener is bound once
 * and stays bound.
 *
 * Tab is trapped rather than merely wrapped: on a phone the sheet is full-bleed,
 * so a focus stop that lands on the page behind it is a button the person cannot
 * see but can still activate.
 */
function useDialogFocus(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const stops = panel.querySelectorAll<HTMLElement>(FOCUS_STOPS);

      if (stops.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return panelRef;
}

const TITLE_ID = "alert-sheet-title";

export function AlertSheet({
  alerts,
  canAskForNotifications,
  onClose,
}: {
  alerts: WatchAlert[];
  /** False when the person turned both alert channels off at onboarding. */
  canAskForNotifications: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const panelRef = useDialogFocus(onClose);
  const [permission, setPermission] = useState<NotifyState>("unsupported");

  // Read on mount rather than at module scope: `Notification` does not exist
  // during the server render, and the answer can change while the app is open.
  useEffect(() => setPermission(notifyState()), []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* The panel's own close control is the labelled one; this is the
          click-anywhere shortcut, so assistive tech has no use for it. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      {/* aria-modal is what takes the rest of the app out of the reading order;
          the Tab trap does the same for the keyboard. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        className="animate-rise safe-top safe-bottom relative flex h-full w-full max-w-[420px] flex-col border-l border-line-bright bg-ink-900 shadow-2xl outline-none"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 id={TITLE_ID} className="flex-1 text-sm font-semibold">
            {t.alerts.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[12px] text-fg-faint transition-colors hover:text-fg"
          >
            {t.common.close}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-fg-muted">
              {t.alerts.none}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex gap-3 px-4 py-3.5">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SEVERITY_COLOR[alert.severity] }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold leading-snug text-fg">
                      {alert.title}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
                      {alert.body}
                    </p>
                    {/* A countdown of zero is not information — by then the
                        body already says the water is there. */}
                    {alert.place || (alert.inMin !== null && alert.inMin > 0) ? (
                      <p className="mt-1.5 text-[11px] text-fg-faint">
                        {alert.place}
                        {alert.place && alert.inMin !== null && alert.inMin > 0
                          ? " · "
                          : ""}
                        {alert.inMin !== null && alert.inMin > 0
                          ? `${alert.inMin} ${t.common.min}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notifications are opt-in, asked for here and nowhere else. */}
        {canAskForNotifications && permission !== "unsupported" ? (
          <div className="border-t border-line p-3">
            {permission === "granted" ? (
              <p className="px-1 py-2 text-[12px] text-fg-faint">
                {t.alerts.notificationsOn}
              </p>
            ) : permission === "denied" ? (
              <p className="px-1 py-2 text-[12px] leading-snug text-fg-faint">
                {t.alerts.notificationsBlocked}
              </p>
            ) : (
              <button
                type="button"
                onClick={async () => setPermission(await requestNotifyPermission())}
                className="min-h-11 w-full rounded-xl bg-signal-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-signal-400"
              >
                {t.alerts.enableNotifications}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
