import type { WatchAlert } from "./types";
import { warrantsNotification } from "./types";

/**
 * System notifications.
 *
 * Permission is never requested on load. A permission prompt that appears
 * because somebody opened a page is the reason browsers now bury the whole
 * feature — it is asked for only when a person taps the row that says what it
 * is for, and only if they already said yes to alerts during onboarding.
 */

export type NotifyState = "unsupported" | "default" | "granted" | "denied";

export function notifyState(): NotifyState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotifyState;
}

export async function requestNotifyPermission(): Promise<NotifyState> {
  if (notifyState() === "unsupported") return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotifyState;
  } catch {
    // Safari once threw on the promise form; treat a failure as "still asked".
    return notifyState();
  }
}

/**
 * Fire notifications for alerts the person has not seen.
 *
 * Only warning and critical. Everything quieter belongs in the app, where it
 * can be read when convenient rather than pushed into somebody's evening.
 */
export function notifyNew(alerts: WatchAlert[], seenIds: string[]): number {
  if (notifyState() !== "granted") return 0;

  const seen = new Set(seenIds);
  let fired = 0;

  for (const alert of alerts) {
    if (seen.has(alert.id) || !warrantsNotification(alert)) continue;
    try {
      new Notification(alert.title, {
        body: alert.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        // Collapses re-fires of the same alert into one entry rather than
        // stacking a notification per refresh tick.
        tag: alert.id,
        requireInteraction: alert.severity === "critical",
      });
      fired += 1;
    } catch {
      // Some browsers only allow notifications from a service worker. Failing
      // here is not worth breaking the render for; the alert is in the app.
    }
  }

  return fired;
}
