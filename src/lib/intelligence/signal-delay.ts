import { clamp, hashRange } from "@/lib/core/math";
import type { CityGraph } from "@/lib/graph/city-graph";
import type { RoadNode } from "@/lib/graph/types";

/**
 * Intersection delay.
 *
 * ─── What this is not ────────────────────────────────────────────────────────
 * This is **not** published traffic-signal timing, and it should never be
 * presented as such. Google Maps does not publish fixed signal schedules, and
 * most of Delhi's signals are adaptive — durations change with traffic, time of
 * day, events, and manual override by traffic police. Any product claiming to
 * know that "this light changes every 90 seconds" is either wrong or is quoting
 * a number that stopped being true this morning.
 *
 * What this *is*: an estimate of how long you will actually wait at a junction,
 * with a confidence attached, derived from things that are observable —
 * junction size, road class, time of day, current congestion, and community
 * reports. That is both more honest and more useful than a cycle time, because
 * the wait is the thing that affects your journey.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The estimation method is deliberately swappable. `method: "learned"` is
 * reserved for the model described in the roadmap — inferred from aggregated
 * GPS stop durations and queue lengths — which would genuinely be novel and
 * which this interface is shaped to accept without changing any caller.
 */

export type DelayMethod = "modelled" | "learned" | "published";

export interface IntersectionDelay {
  nodeId: string;
  name: string;
  at: { lat: number; lng: number };
  /** Expected wait in seconds at this junction, right now. */
  estimatedDelaySec: number;
  /** 0..1. Low until there is real observation behind it. */
  confidence: number;
  method: DelayMethod;
  /** What the estimate rests on, shown to the user. */
  basis: string[];
  /** Typical delay through the day, for planning rather than for right now. */
  byPeriod: { period: string; delaySec: number }[];
  /** True when the junction is signalised at all. */
  signalised: boolean;
}

/** Junctions with at least this many approaches are assumed signalised. */
const SIGNALISED_DEGREE = 3;

export function estimateIntersectionDelays(
  graph: CityGraph,
  localHour: number,
  congestionAt: (nodeId: string) => number,
): IntersectionDelay[] {
  return graph
    .allNodes()
    .map((node) => estimateOne(graph, node, localHour, congestionAt(node.id)))
    .filter((d): d is IntersectionDelay => d !== null);
}

function estimateOne(
  graph: CityGraph,
  node: RoadNode,
  localHour: number,
  congestion: number,
): IntersectionDelay | null {
  const edges = graph.neighbours(node.id);
  const degree = edges.length;
  if (degree < 2) return null;

  const signalised = degree >= SIGNALISED_DEGREE;

  const segments = edges
    .map((e) => graph.getSegment(e.segmentId))
    .filter((s): s is NonNullable<typeof s> => !!s);

  // Bigger junctions on bigger roads have longer cycles, so a red phase you
  // arrive into is longer on average.
  const laneWeight =
    segments.reduce((sum, s) => sum + s.lanes, 0) / Math.max(1, segments.length);
  const majorClass = segments.some(
    (s) => s.roadClass === "ring" || s.roadClass === "highway",
  );

  const basis: string[] = [];

  if (!signalised) {
    return {
      nodeId: node.id,
      name: node.name,
      at: node.at,
      estimatedDelaySec: Math.round(6 + congestion * 25),
      confidence: 0.45,
      method: "modelled",
      basis: ["Two-way junction, assumed unsignalised."],
      byPeriod: [],
      signalised: false,
    };
  }

  // Base wait: roughly half the cycle, scaled by junction size.
  const baseSec = 22 + degree * 6 + laneWeight * 3 + (majorClass ? 12 : 0);
  basis.push(
    `${degree}-arm junction on a ${majorClass ? "major arterial" : "local"} corridor.`,
  );

  const diurnal = diurnalMultiplier(localHour);
  basis.push(`${describePeriod(localHour)} traffic pattern.`);

  // Congestion extends the queue past one cycle — this is where the wait
  // actually comes from during peak.
  const overflow = 1 + Math.max(0, congestion - 0.5) * 2.6;
  if (congestion > 0.6) {
    basis.push(
      `Congestion at ${Math.round(congestion * 100)}% — queues are spilling past one cycle.`,
    );
  }

  // Small deterministic per-junction character, so estimates are stable.
  const idiosyncrasy = hashRange(`signal:${node.id}`, 0.88, 1.14);

  const estimatedDelaySec = Math.round(
    clamp(baseSec * diurnal * overflow * idiosyncrasy, 8, 320),
  );

  // Confidence is deliberately capped: without observed stop durations this is
  // an estimate, and saying so is the point.
  const confidence = clamp(0.4 + (congestion > 0.2 ? 0.12 : 0) + (majorClass ? 0.08 : 0), 0, 0.62);

  return {
    nodeId: node.id,
    name: node.name,
    at: node.at,
    estimatedDelaySec,
    confidence,
    method: "modelled",
    basis,
    byPeriod: [
      { period: "Morning peak", delaySec: Math.round(baseSec * 1.55 * idiosyncrasy) },
      { period: "Midday", delaySec: Math.round(baseSec * 1.05 * idiosyncrasy) },
      { period: "Evening peak", delaySec: Math.round(baseSec * 1.75 * idiosyncrasy) },
      { period: "Night", delaySec: Math.round(baseSec * 0.55 * idiosyncrasy) },
    ],
    signalised: true,
  };
}

function diurnalMultiplier(hour: number): number {
  const gauss = (mu: number, sigma: number) =>
    Math.exp(-((hour - mu) ** 2) / (2 * sigma ** 2));
  return (
    0.55 + gauss(9.3, 1.6) * 1.0 + gauss(18.7, 1.9) * 1.2 + gauss(14, 4) * 0.4
  );
}

function describePeriod(hour: number): string {
  if (hour >= 7.5 && hour < 11) return "Morning peak";
  if (hour >= 11 && hour < 16.5) return "Midday";
  if (hour >= 16.5 && hour < 21) return "Evening peak";
  return "Off-peak";
}

/**
 * Total signal delay along a sequence of junctions, in minutes.
 *
 * This is what routing consumes: a route through six signalised junctions in
 * the evening peak is meaningfully slower than one through two, and travel-time
 * models that ignore it systematically favour the wrong roads.
 */
export function routeSignalDelayMin(
  delays: Map<string, IntersectionDelay>,
  nodeIds: string[],
): number {
  // The origin junction is not waited at; you start there.
  return (
    nodeIds
      .slice(1)
      .reduce((sum, id) => sum + (delays.get(id)?.estimatedDelaySec ?? 0), 0) / 60
  );
}
