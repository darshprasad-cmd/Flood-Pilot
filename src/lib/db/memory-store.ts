import { clamp, haversineM } from "@/lib/core/math";
import type {
  CitizenReport,
  FloodPilotStore,
  NewCitizenReport,
  OutcomeRecord,
  ReportQuery,
} from "./types";

/** Two reports further apart than this are not about the same stretch of road. */
const CORROBORATION_RADIUS_M = 600;
/** Corroboration is about the present; ninety minutes is already generous. */
const CORROBORATION_WINDOW_MIN = 90;
/** No history yet. Deliberately mid-scale: unknown is not the same as good. */
const BASE_REPORTER_TRUST = 0.6;

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
      reporterTrust: input.reporterTrust ?? this.trustFor(input.reporterId),
      corroborations: 0,
      contradictions: 0,
    };

    // Cross-reference against nearby recent reports. Agreement raises the weight
    // a report carries; disagreement lowers it. This is the cheapest possible
    // defence against a single bad actor moving a prediction on their own — but
    // only when it counts *distinct reporters*. Counting reports instead meant
    // one device filing four times looked like four witnesses corroborating
    // each other, which was the whole of the spam problem.
    const cutoff = Date.now() - CORROBORATION_WINDOW_MIN * 60_000;
    const nearby = this.reports.filter(
      (other) =>
        other.segmentId === report.segmentId &&
        Date.parse(other.createdAt) >= cutoff &&
        haversineM(other.at, report.at) <= CORROBORATION_RADIUS_M,
    );

    const agreeing = new Set<string>();
    const contradicting = new Set<string>();

    for (const other of nearby) {
      // Nobody corroborates themselves, however many times they file.
      if (other.reporterId === report.reporterId) continue;

      const bothSayFlooded =
        isFloodPositive(other.type) === isFloodPositive(report.type);
      (bothSayFlooded ? agreeing : contradicting).add(other.reporterId);

      // And this reporter counts towards `other` once only, so their second
      // report near it cannot raise the same tally again.
      const alreadyCounted = nearby.some(
        (prior) =>
          prior !== other &&
          prior.reporterId === report.reporterId &&
          isFloodPositive(prior.type) === isFloodPositive(report.type) &&
          haversineM(prior.at, other.at) <= CORROBORATION_RADIUS_M,
      );
      if (alreadyCounted) continue;

      if (bothSayFlooded) other.corroborations += 1;
      else other.contradictions += 1;
    }

    report.corroborations = agreeing.size;
    report.contradictions = contradicting.size;

    this.reports.push(report);
    // Keep memory bounded on long-lived instances.
    if (this.reports.length > 5000) this.reports.splice(0, 1000);
    return report;
  }

  /**
   * Standing for a reporter, from how their previous reports held up.
   *
   * Keyed on the server-issued reporter id, so it survives across sessions and
   * cannot be reset by changing a field in a request. Volume buys nothing here:
   * the only input is whether other people confirmed or contradicted what this
   * person said, which is why a reporter with no verdicts yet stays at the base
   * rather than being rewarded or punished for showing up.
   */
  private trustFor(reporterId: string): number {
    let corroborated = 0;
    let contradicted = 0;

    for (const report of this.reports) {
      if (report.reporterId !== reporterId) continue;
      corroborated += report.corroborations;
      contradicted += report.contradictions;
    }

    const judged = corroborated + contradicted;
    if (judged === 0) return BASE_REPORTER_TRUST;

    // Move away from the base only as far as the record justifies. Three people
    // disagreeing with somebody's first report is not proof they are unreliable
    // — water recedes, and the first person to see a flooded road is routinely
    // contradicted by the people who drove through ten minutes earlier. A long
    // record decides; a couple of verdicts only nudge.
    const record = corroborated / judged;
    const settled = clamp(judged / 8);
    return clamp(
      BASE_REPORTER_TRUST + (record - BASE_REPORTER_TRUST) * settled,
      0.2,
      0.95,
    );
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
