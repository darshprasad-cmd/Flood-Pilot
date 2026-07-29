import type {
  CommunityReport,
  NewCommunityReport,
  ReportType,
} from "@/lib/community/types";

/**
 * Storage speaks the community-report vocabulary.
 *
 * The report model outgrew "flooded / clear / blocked drain / stalled" once the
 * platform started ingesting construction, accidents, closures and the rest, so
 * `CommunityReport` in `lib/community/types.ts` is now the single definition and
 * this module re-exports it rather than keeping a parallel one.
 */
export type { CommunityReport, NewCommunityReport, ReportType };
export { REPORT_TYPES, REPORT_META, SEVERITIES } from "@/lib/community/types";

/** Retained alias: a great deal of code still says CitizenReport. */
export type CitizenReport = CommunityReport;
export type NewCitizenReport = NewCommunityReport;

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
