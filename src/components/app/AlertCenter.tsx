"use client";

import { useEffect, useState } from "react";
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
  const [permission, setPermission] = useState<NotifyState>("unsupported");

  // Read on mount rather than at module scope: `Notification` does not exist
  // during the server render, and the answer can change while the app is open.
  useEffect(() => setPermission(notifyState()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      <div className="animate-rise safe-top safe-bottom relative flex h-full w-full max-w-[420px] flex-col border-l border-line-bright bg-ink-900 shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="flex-1 text-sm font-semibold">{t.alerts.title}</h2>
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
