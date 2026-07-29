"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

/**
 * Offline handling.
 *
 * Two jobs, both about honesty rather than cleverness: keep the app openable
 * when the network is gone, and never let remembered conditions be mistaken for
 * current ones. A flood map showing yesterday's water as though it were today's
 * is more dangerous than no map at all.
 */

export function useOnlineState(): boolean {
  // Assume online for the first paint. Rendering an offline banner during
  // hydration on a perfectly good connection would be its own kind of lie.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

/**
 * Registers the service worker.
 *
 * Production only. In development the dev server's chunks are not
 * content-hashed, so a cache-first worker would happily serve yesterday's
 * JavaScript over today's edit and cost an afternoon.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable worker costs offline support and nothing else.
      });
    };

    // After load, so registration never competes with the first render for
    // bandwidth on the connection this is meant to protect.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

export function OfflineBanner({ online }: { online: boolean }) {
  const t = useT();
  if (online) return null;
  return (
    <div
      role="status"
      className="shrink-0 border-b border-risk-moderate/30 bg-risk-moderate/10 px-4 py-2 text-center text-[12px] text-risk-moderate"
    >
      {t.common.offline}
    </div>
  );
}

/**
 * When the numbers on screen were computed.
 *
 * Always shown, not only when offline — a stale figure looks identical to a
 * fresh one, so the only way to tell them apart is to print the time.
 */
export function UpdatedStamp({
  computedAt,
  className = "",
}: {
  computedAt: string | null | undefined;
  className?: string;
}) {
  const t = useT();
  const [clock, setClock] = useState<string | null>(null);

  // Formatted on the client only: the server has no idea what timezone the
  // reader is in, and a mismatched first paint is a hydration error.
  useEffect(() => {
    if (!computedAt) return setClock(null);
    const date = new Date(computedAt);
    if (Number.isNaN(date.getTime())) return setClock(null);
    setClock(
      date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    );
  }, [computedAt]);

  if (!clock) return null;
  return (
    <span className={`text-[10.5px] text-fg-faint ${className}`}>
      {t.dashboard.lastUpdated} <span className="numeric">{clock}</span>
    </span>
  );
}
