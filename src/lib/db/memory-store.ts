import { haversineM } from "@/lib/core/math";
import type {
  CitizenReport,
  FloodPilotStore,
  NewCitizenReport,
  OutcomeRecord,
  ReportQuery,
} from "./types";

/**
 * In-memory store.
 *
 * Deliberately the default: FloodPilot has to run from a clean clone with no
 * database, no keys and no services. On serverless the lifetime is the lifetime
 * of the instance, which is fine for the citizen-report loop and is the reason
 * `FloodPilotStore` exists as an interface rather than being inlined everywhere.
 */
export class MemoryStore implements FloodPilotStore {
  readonly name = "memory";

  private reports: CitizenReport[] = [];
  private outcomes: OutcomeRecord[] = [];
  private counter = 0;

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${Date.now().toString(36)}${this.counter.toString(36)}`;
  }

  async addReport(input: NewCitizenReport): Promise<CitizenReport> {
    const report: CitizenReport = {
      ...input,
      id: this.nextId("rep"),
      createdAt: new Date().toISOString(),
      reporterTrust: input.reporterTrust ?? 0.6,
      corroborations: 0,
      contradictions: 0,
    };

    // Cross-reference against nearby recent reports. Agreement raises the weight
    // a report carries; disagreement lowers it. This is the cheapest possible
    // defence against a single bad actor moving a prediction on their own.
    const cutoff = Date.now() - 90 * 60_000;
    for (const other of this.reports) {
      if (other.segmentId !== report.segmentId) continue;
      if (Date.parse(other.createdAt) < cutoff) continue;
      if (haversineM(other.at, report.at) > 600) continue;

      const bothSayFlooded =
        isFloodPositive(other.type) === isFloodPositive(report.type);
      if (bothSayFlooded) {
        other.corroborations += 1;
        report.corroborations += 1;
      } else {
        other.contradictions += 1;
        report.contradictions += 1;
      }
    }

    this.reports.push(report);
    // Keep memory bounded on long-lived instances.
    if (this.reports.length > 5000) this.reports.splice(0, 1000);
    return report;
  }

  async listReports(query: ReportQuery = {}): Promise<CitizenReport[]> {
    const cutoff =
      query.withinMin !== undefined ? Date.now() - query.withinMin * 60_000 : null;

    const matched = this.reports
      .filter((r) => !query.cityId || r.cityId === query.cityId)
      .filter((r) => !query.segmentId || r.segmentId === query.segmentId)
      .filter((r) => !query.types || query.types.includes(r.type))
      .filter((r) => cutoff === null || Date.parse(r.createdAt) >= cutoff)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return query.limit ? matched.slice(0, query.limit) : matched;
  }

  async countReports(query: ReportQuery = {}): Promise<number> {
    return (await this.listReports(query)).length;
  }

  async recordOutcome(
    input: Omit<OutcomeRecord, "id" | "recordedAt">,
  ): Promise<OutcomeRecord> {
    const record: OutcomeRecord = {
      ...input,
      id: this.nextId("out"),
      recordedAt: new Date().toISOString(),
    };
    this.outcomes.push(record);
    if (this.outcomes.length > 5000) this.outcomes.splice(0, 1000);
    return record;
  }

  async listOutcomes(cityId: string, segmentId?: string): Promise<OutcomeRecord[]> {
    return this.outcomes
      .filter((o) => o.cityId === cityId)
      .filter((o) => !segmentId || o.segmentId === segmentId)
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  }
}

/**
 * Does this report assert that there is water on the road?
 *
 * Used only to decide whether two nearby reports corroborate or contradict each
 * other, so it deliberately groups every water-positive type together.
 */
export function isFloodPositive(type: string): boolean {
  return (
    type === "waterlogging" ||
    type === "vehicle_stalled" ||
    type === "overflowing_drain"
  );
}
