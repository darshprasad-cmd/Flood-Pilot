import type { LatLng } from "@/lib/core/types";

export const REPORT_TYPES = [
  "flooded_road",
  "road_clear",
  "drain_blockage",
  "vehicle_stalled",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_META: Record<
  ReportType,
  { label: string; blurb: string; needsDepth: boolean; icon: string }
> = {
  flooded_road: {
    label: "Road is flooded",
    blurb: "Standing water you would not drive a normal car through.",
    needsDepth: true,
    icon: "water",
  },
  road_clear: {
    label: "Road is clear",
    blurb: "Passable now — just as valuable as a flood report.",
    needsDepth: false,
    icon: "check",
  },
  drain_blockage: {
    label: "Drain is blocked",
    blurb: "Choked inlet or silted storm drain.",
    needsDepth: false,
    icon: "drain",
  },
  vehicle_stalled: {
    label: "Vehicle stalled",
    blurb: "A vehicle has stopped in the water here.",
    needsDepth: true,
    icon: "alert",
  },
};

export interface CitizenReport {
  id: string;
  type: ReportType;
  cityId: string;
  segmentId: string;
  at: LatLng;
  depthCm: number | null;
  note: string | null;
  reporterId: string;
  createdAt: string;
  /** 0..1 — how much weight this reporter's observations carry. */
  reporterTrust: number;
  /** Set once other reports corroborate or contradict this one. */
  corroborations: number;
  contradictions: number;
}

export type NewCitizenReport = Omit<
  CitizenReport,
  "id" | "createdAt" | "corroborations" | "contradictions" | "reporterTrust"
> & { reporterTrust?: number };

/**
 * A prediction paired with what actually happened.
 *
 * This is the substrate for live learning: the residual between predicted and
 * observed drives a per-segment correction today, and is exactly the training
 * table a gradient-boosted model would be fitted on later.
 */
export interface OutcomeRecord {
  id: string;
  cityId: string;
  segmentId: string;
  predictedProbability: number;
  predictedDepthCm: number;
  observedFlooded: boolean;
  observedDepthCm: number | null;
  modelId: string;
  scenario: string;
  recordedAt: string;
  /** Which report produced this observation, when there was one. */
  sourceReportId: string | null;
}

export interface ReportQuery {
  cityId?: string;
  segmentId?: string;
  /** Only reports newer than this many minutes. */
  withinMin?: number;
  types?: ReportType[];
  limit?: number;
}

/**
 * Persistence contract.
 *
 * The default implementation is in-memory so the platform runs with zero
 * infrastructure. Swapping in Postgres, KV or DynamoDB means implementing this
 * interface — no caller touches storage directly.
 */
export interface FloodPilotStore {
  readonly name: string;
  addReport(report: NewCitizenReport): Promise<CitizenReport>;
  listReports(query?: ReportQuery): Promise<CitizenReport[]>;
  countReports(query?: ReportQuery): Promise<number>;
  recordOutcome(record: Omit<OutcomeRecord, "id" | "recordedAt">): Promise<OutcomeRecord>;
  listOutcomes(cityId: string, segmentId?: string): Promise<OutcomeRecord[]>;
}
