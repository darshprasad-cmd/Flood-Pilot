import { haversineM } from "@/lib/core/math";
import { fill } from "@/lib/i18n/fill";
import type { Messages } from "@/lib/i18n";
import type { UserProfile } from "@/lib/profile";
import { SEVERITY_ORDER, type WatchAlert } from "./types";

/**
 * What is worth telling this specific person, right now.
 *
 * Everything here is derived from output the engine has already produced — the
 * same predictions, the same timeline, the same decision. This is not a second
 * opinion, it is the first one, re-asked from the point of view of somebody who
 * is not currently looking at the screen.
 *
 * Deliberately conservative about what counts as an alert. A product that
 * pings you about 4 cm of water on a road you never drive teaches you to
 * ignore it, and then it is not there when the underpass fills.
 */

interface WatchNode {
  id: string;
  name: string;
  at: { lat: number; lng: number };
  ward: string;
}

interface WatchSegment {
  id: string;
  name: string;
  midpoint: { lat: number; lng: number };
  state: {
    peakDepthCm: number;
    probability: number;
    timeToImpassableMin: number | null;
  };
}

interface WatchBrief {
  comparison: { safest: { impassableCount: number } } | null;
  timeline: {
    recommendedDepartureClock: string | null;
    latestSafeDepartureMin: number | null;
    noSafeWindow: boolean;
  };
  decision: { primary: DecisionLike; alternatives: DecisionLike[]; parallel: DecisionLike[] } | null;
}

interface DecisionLike {
  action: string;
  feasible: boolean;
}

interface WatchGauge {
  station: { name: string; river: string; dangerLevelM: number };
  levelM: number;
  status: string;
}

/** Water shallower than this is weather, not an event. */
const NOTEWORTHY_CM = 8;
/** Deep enough that a normal car is in trouble. */
const SERIOUS_CM = 25;
/** Only warn about a closing window once it is close enough to act on. */
const WINDOW_HORIZON_MIN = 90;

export function buildWatchAlerts({
  profile,
  nodes,
  segments,
  brief,
  gauges,
  t,
}: {
  profile: UserProfile;
  nodes: WatchNode[];
  segments: WatchSegment[];
  brief: WatchBrief | null;
  gauges: WatchGauge[];
  t: Messages;
}): WatchAlert[] {
  const out: WatchAlert[] = [];
  const nodeOf = (id: string | null) =>
    id ? (nodes.find((n) => n.id === id) ?? null) : null;

  const home = nodeOf(profile.homeNodeId);

  /* ── The window ──────────────────────────────────────────────────────── */
  if (brief?.timeline.noSafeWindow) {
    out.push({
      id: "no-window",
      kind: "no_safe_window",
      channel: "proactive",
      severity: "critical",
      title: t.alerts.noWindowTitle,
      body: t.alerts.noWindowBody,
      place: null,
      inMin: null,
    });
  } else {
    const left = brief?.timeline.latestSafeDepartureMin ?? null;
    const clock = brief?.timeline.recommendedDepartureClock ?? null;
    if (left !== null && clock && left <= WINDOW_HORIZON_MIN) {
      // Two buckets, so "you have half an hour" and "you have ten minutes"
      // are different alerts rather than the same one quietly changing.
      const severity = left <= 30 ? "warning" : "watch";
      out.push({
        id: `window-${severity}`,
        kind: "departure_window",
        channel: "proactive",
        severity,
        title: t.alerts.departureTitle,
        body: fill(t.alerts.departureBody, { clock, min: Math.max(0, Math.round(left)) }),
        place: null,
        inMin: Math.max(0, Math.round(left)),
      });
    }
  }

  /* ── The road you are actually taking ────────────────────────────────── */
  const impassable = brief?.comparison?.safest.impassableCount ?? 0;
  if (impassable > 0) {
    out.push({
      id: "route-blocked",
      kind: "route_impassable",
      channel: "proactive",
      severity: "critical",
      title: t.alerts.routeTitle,
      body: fill(t.alerts.routeBody, { count: impassable }),
      place: null,
      inMin: null,
    });
  }

  /* ── Your own streets ────────────────────────────────────────────────── */
  const areaWorst = worstNear(segments, home?.at, 3200);
  if (home && areaWorst && areaWorst.state.peakDepthCm >= NOTEWORTHY_CM) {
    const deep = areaWorst.state.peakDepthCm >= SERIOUS_CM;
    out.push({
      id: `home-${deep ? "flooding" : "rising"}`,
      kind: "home_area",
      channel: "proactive",
      severity: deep ? "warning" : "watch",
      title: deep ? t.alerts.homeFloodingTitle : t.alerts.homeRisingTitle,
      body: fill(deep ? t.alerts.homeFloodingBody : t.alerts.homeRisingBody, {
        place: areaWorst.name,
        depth: Math.round(areaWorst.state.peakDepthCm),
      }),
      place: home.ward,
      inMin: areaWorst.state.timeToImpassableMin,
    });
  }

  /* ── The car in the basement ─────────────────────────────────────────── */
  if (profile.basementParking) {
    const options = brief?.decision
      ? [brief.decision.primary, ...brief.decision.alternatives, ...brief.decision.parallel]
      : [];
    const engineSaysMove = options.some((o) => o.action === "move_vehicle" && o.feasible);
    const deepEnough = (areaWorst?.state.peakDepthCm ?? 0) >= 20;
    if (engineSaysMove || deepEnough) {
      out.push({
        id: "move-car",
        kind: "move_vehicle",
        channel: "proactive",
        severity: "critical",
        title: t.alerts.moveCarTitle,
        body: fill(t.alerts.moveCarBody, {
          place: areaWorst?.name ?? (home?.name ?? ""),
          depth: Math.round(areaWorst?.state.peakDepthCm ?? 0),
        }),
        place: home?.ward ?? null,
        inMin: null,
      });
    }
  }

  /* ── The other places they told us about ─────────────────────────────── */
  for (const id of profile.frequentNodeIds) {
    const node = nodeOf(id);
    if (!node) continue;
    const worst = worstNear(segments, node.at, 2000);
    if (!worst || worst.state.peakDepthCm < 15) continue;
    out.push({
      id: `place-${id}`,
      kind: "frequent_place",
      channel: "proactive",
      severity: "watch",
      title: fill(t.alerts.placeTitle, { place: node.name }),
      body: fill(t.alerts.placeBody, { depth: Math.round(worst.state.peakDepthCm) }),
      place: node.ward,
      inMin: worst.state.timeToImpassableMin,
    });
  }

  /* ── The river ───────────────────────────────────────────────────────── */
  for (const gauge of gauges) {
    const status = gauge.status.toLowerCase();
    const danger = status.includes("danger") || status.includes("evacu");
    const warning = status.includes("warn");
    if (!danger && !warning) continue;
    out.push({
      id: `river-${gauge.station.name}-${danger ? "danger" : "warning"}`,
      kind: "river",
      channel: "emergency",
      severity: danger ? "critical" : "warning",
      title: danger ? t.alerts.riverDangerTitle : t.alerts.riverWarningTitle,
      body: fill(t.alerts.riverBody, {
        river: gauge.station.river,
        level: gauge.levelM.toFixed(2),
        status: gauge.status.replace(/_/g, " "),
        danger: gauge.station.dangerLevelM,
      }),
      place: gauge.station.name,
      inMin: null,
    });
  }

  return out
    .filter((alert) =>
      alert.channel === "emergency" ? profile.emergencyAlerts : profile.proactiveAlerts,
    )
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** The deepest modelled segment within `radiusM` of a point. */
function worstNear(
  segments: WatchSegment[],
  at: { lat: number; lng: number } | undefined,
  radiusM: number,
): WatchSegment | null {
  if (!at) return null;
  let worst: WatchSegment | null = null;
  for (const segment of segments) {
    if (haversineM(at, segment.midpoint) > radiusM) continue;
    if (!worst || segment.state.peakDepthCm > worst.state.peakDepthCm) worst = segment;
  }
  return worst;
}
