/**
 * Personal alerts.
 *
 * Distinct from the journey brief's `AlertDto`, which explains the journey you
 * just asked about. These are the things worth interrupting somebody for when
 * they did *not* ask — the window closing, the water arriving at their own
 * street, the car in the basement.
 *
 * Onboarding asks two questions about this and the answers are honoured here:
 * every alert declares which of the two channels it belongs to, and a channel
 * the person switched off is never delivered. Asking a question and then
 * ignoring the answer is worse than never asking.
 */

export type AlertChannel =
  /** Things that have not happened yet: windows closing, water building. */
  | "proactive"
  /** Official warnings: river levels, evacuation, control-room advisories. */
  | "emergency";

export type AlertSeverity = "info" | "watch" | "warning" | "critical";

export interface WatchAlert {
  /**
   * Stable across refreshes so an alert stays read once dismissed — but it
   * carries the severity, so an escalation is a *new* alert rather than a
   * silent change to one somebody has already stopped looking at.
   */
  id: string;
  kind: string;
  channel: AlertChannel;
  severity: AlertSeverity;
  title: string;
  body: string;
  /** The place it concerns, if any. */
  place: string | null;
  /** Minutes from now, when the alert is about a deadline. */
  inMin: number | null;
}

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  watch: 2,
  info: 3,
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: "#e8503a",
  warning: "#f08a3c",
  watch: "#e8b62c",
  info: "#4aa8ff",
};

/** Severe enough to be worth a system notification rather than a badge. */
export function warrantsNotification(alert: WatchAlert): boolean {
  return alert.severity === "critical" || alert.severity === "warning";
}
