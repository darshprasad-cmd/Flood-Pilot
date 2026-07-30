import type { Severity } from "@/lib/community/types";
import { isFloodPositive } from "./memory-store";
import type {
  CitizenReport,
  FloodPilotStore,
  NewCitizenReport,
  OutcomeRecord,
  ReportQuery,
} from "./types";

/**
 * PostGIS-backed store.
 *
 * Activated by setting `DATABASE_URL`. Requires `npm install pg`, which is not a
 * dependency of the project — the platform's default is in-memory precisely so
 * that it runs from a clean clone with no infrastructure, and a database driver
 * nobody uses has no business in the bundle.
 *
 * Corroboration is computed in SQL using PostGIS proximity rather than in
 * application code, which is the whole reason to have PostGIS here: "other
 * reports within 600 m of this one in the last 90 minutes" is a spatial query,
 * not a loop.
 *
 * ─── Status ──────────────────────────────────────────────────────────────
 * Reviewed but NOT exercised against a live PostGIS instance in this build.
 * The schema in db/schema.sql and the queries below should be run against a
 * real database before being relied on.
 * ─────────────────────────────────────────────────────────────────────────
 */

interface QueryResult<T> {
  rows: T[];
}

interface PoolLike {
  query<T>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

export class PostgisStore implements FloodPilotStore {
  readonly name = "postgis";
  private pool: PoolLike | null = null;
  private connecting: Promise<PoolLike> | null = null;

  constructor(private readonly connectionString: string) {}

  private async db(): Promise<PoolLike> {
    if (this.pool) return this.pool;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      // The specifier is a variable so neither TypeScript nor the bundler tries
      // to resolve `pg` at build time. A missing driver is then a clear runtime
      // error for whoever opted into Postgres, rather than a build failure for
      // everyone who did not.
      const specifier = "pg";
      const pg = (await import(/* webpackIgnore: true */ specifier)) as unknown as {
        Pool: new (config: { connectionString: string; max: number }) => PoolLike;
      };

      if (!pg?.Pool) {
        throw new Error(
          "DATABASE_URL is set but the `pg` driver is not installed. Run `npm install pg`, or unset DATABASE_URL to use the in-memory store.",
        );
      }

      const pool = new pg.Pool({ connectionString: this.connectionString, max: 5 });
      this.pool = pool;
      return pool;
    })();

    return this.connecting;
  }

  async addReport(input: NewCitizenReport): Promise<CitizenReport> {
    const db = await this.db();
    const id = `rep_${Date.now().toString(36)}${Math.floor(
      Number.MAX_SAFE_INTEGER * 0,
    )}${cryptoSuffix()}`;

    await db.query(
      `INSERT INTO citizen_report
         (id, city_id, segment_id, type, severity, depth_cm, lanes_blocked,
          description, photo_url, reporter_id, reporter_trust, geom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               COALESCE($11::real, (
                 -- Standing for this reporter, from how their previous reports
                 -- held up. Volume buys nothing; only confirmation and
                 -- contradiction by other people move it, and only as far as
                 -- the length of the record justifies.
                 SELECT CASE
                          WHEN COALESCE(sum(corroborations + contradictions), 0) = 0
                            THEN 0.6
                          ELSE greatest(0.2, least(0.95,
                                 0.6 + ((sum(corroborations)::real
                                         / sum(corroborations + contradictions)) - 0.6)
                                       * least(1.0, sum(corroborations + contradictions) / 8.0)))
                        END
                 FROM citizen_report
                 WHERE reporter_id = $10
               )),
               ST_SetSRID(ST_MakePoint($13,$12), 4326)::geography)`,
      [
        id,
        input.cityId,
        input.segmentId,
        input.type,
        input.severity,
        input.depthCm,
        input.lanesBlocked,
        input.description,
        input.photoUrl,
        input.reporterId,
        input.reporterTrust ?? null,
        input.at.lat,
        input.at.lng,
      ],
    );

    // Cross-reference against nearby recent reports. Agreement raises the weight
    // a report carries; disagreement lowers it — counted by *distinct reporter*,
    // which is why the neighbour set excludes the submitter's own reports. One
    // device filing four times is one witness, not four.
    const neighbourhood = `
      WITH subject AS (
        SELECT geom, reporter_id FROM citizen_report WHERE id = $2
      ),
      neighbours AS (
        SELECT r.id, r.geom, r.reporter_id,
               (r.type IN ('waterlogging','vehicle_stalled','overflowing_drain')) AS positive
        FROM citizen_report r, subject s
        WHERE r.segment_id = $1
          AND r.id <> $2
          AND r.reporter_id <> s.reporter_id
          AND r.created_at > now() - interval '90 minutes'
          AND ST_DWithin(r.geom, s.geom, 600)
      )`;

    const values = [input.segmentId, id, isFloodPositive(input.type)];

    // The neighbours' tallies, raised only where this reporter is not already
    // standing beside them: a second report from the same person must not lift
    // the same neighbour twice.
    await db.query(
      `${neighbourhood}
       UPDATE citizen_report r
       SET corroborations = r.corroborations + CASE WHEN n.positive = $3 THEN 1 ELSE 0 END,
           contradictions = r.contradictions + CASE WHEN n.positive <> $3 THEN 1 ELSE 0 END
       FROM neighbours n, subject s
       WHERE r.id = n.id
         AND NOT EXISTS (
           SELECT 1 FROM citizen_report p
           WHERE p.reporter_id = s.reporter_id
             AND p.id <> $2
             AND p.segment_id = $1
             AND p.created_at > now() - interval '90 minutes'
             AND (p.type IN ('waterlogging','vehicle_stalled','overflowing_drain')) = $3
             AND ST_DWithin(p.geom, n.geom, 600)
         )`,
      values,
    );

    // The new report's own tallies: how many *people* nearby agree or disagree.
    // Applied last so the row that comes back carries the settled numbers.
    const { rows } = await db.query<DbReport>(
      `${neighbourhood}
       UPDATE citizen_report r
       SET corroborations = (
             SELECT count(DISTINCT n.reporter_id) FROM neighbours n WHERE n.positive = $3
           ),
           contradictions = (
             SELECT count(DISTINCT n.reporter_id) FROM neighbours n WHERE n.positive <> $3
           )
       WHERE r.id = $2
       RETURNING r.*, ST_Y(r.geom::geometry) AS lat, ST_X(r.geom::geometry) AS lng`,
      values,
    );

    return mapReport(rows[0]);
  }

  async listReports(query: ReportQuery = {}): Promise<CitizenReport[]> {
    const db = await this.db();
    const clauses: string[] = ["1=1"];
    const values: unknown[] = [];

    if (query.cityId) {
      values.push(query.cityId);
      clauses.push(`city_id = $${values.length}`);
    }
    if (query.segmentId) {
      values.push(query.segmentId);
      clauses.push(`segment_id = $${values.length}`);
    }
    if (query.types && query.types.length > 0) {
      values.push(query.types);
      clauses.push(`type = ANY($${values.length})`);
    }
    if (query.withinMin !== undefined) {
      values.push(query.withinMin);
      clauses.push(`created_at > now() - ($${values.length} * interval '1 minute')`);
    }

    values.push(query.limit ?? 500);

    const { rows } = await db.query<DbReport>(
      `SELECT *, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM citizen_report
       WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${values.length}`,
      values,
    );

    return rows.map(mapReport);
  }

  async countReports(query: ReportQuery = {}): Promise<number> {
    return (await this.listReports(query)).length;
  }

  async recordOutcome(
    input: Omit<OutcomeRecord, "id" | "recordedAt">,
  ): Promise<OutcomeRecord> {
    const db = await this.db();
    const id = `out_${Date.now().toString(36)}${cryptoSuffix()}`;

    const { rows } = await db.query<DbOutcome>(
      `INSERT INTO prediction_outcome
         (id, city_id, segment_id, predicted_probability, predicted_depth_cm,
          observed_flooded, observed_depth_cm, model_id, scenario, source_report_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        id,
        input.cityId,
        input.segmentId,
        input.predictedProbability,
        input.predictedDepthCm,
        input.observedFlooded,
        input.observedDepthCm,
        input.modelId,
        input.scenario,
        input.sourceReportId,
      ],
    );

    return mapOutcome(rows[0]);
  }

  async listOutcomes(cityId: string, segmentId?: string): Promise<OutcomeRecord[]> {
    const db = await this.db();
    const values: unknown[] = [cityId];
    let clause = "city_id = $1";
    if (segmentId) {
      values.push(segmentId);
      clause += ` AND segment_id = $${values.length}`;
    }

    const { rows } = await db.query<DbOutcome>(
      `SELECT * FROM prediction_outcome
       WHERE ${clause}
       ORDER BY recorded_at DESC
       LIMIT 2000`,
      values,
    );

    return rows.map(mapOutcome);
  }
}

/* -------------------------------------------------------------------------- */

interface DbReport {
  id: string;
  city_id: string;
  segment_id: string;
  type: string;
  severity: string;
  depth_cm: number | null;
  lanes_blocked: number | null;
  description: string | null;
  photo_url: string | null;
  reporter_id: string;
  reporter_trust: number;
  corroborations: number;
  contradictions: number;
  created_at: Date | string;
  lat: number;
  lng: number;
}

interface DbOutcome {
  id: string;
  city_id: string;
  segment_id: string;
  predicted_probability: number;
  predicted_depth_cm: number;
  observed_flooded: boolean;
  observed_depth_cm: number | null;
  model_id: string;
  scenario: string;
  source_report_id: string | null;
  recorded_at: Date | string;
}

function mapReport(row: DbReport): CitizenReport {
  return {
    id: row.id,
    cityId: row.city_id,
    segmentId: row.segment_id,
    type: row.type as CitizenReport["type"],
    at: { lat: row.lat, lng: row.lng },
    severity: (row.severity ?? "moderate") as Severity,
    depthCm: row.depth_cm,
    lanesBlocked: row.lanes_blocked,
    description: row.description,
    photoUrl: row.photo_url,
    reporterId: row.reporter_id,
    reporterTrust: row.reporter_trust,
    corroborations: row.corroborations,
    contradictions: row.contradictions,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapOutcome(row: DbOutcome): OutcomeRecord {
  return {
    id: row.id,
    cityId: row.city_id,
    segmentId: row.segment_id,
    predictedProbability: row.predicted_probability,
    predictedDepthCm: row.predicted_depth_cm,
    observedFlooded: row.observed_flooded,
    observedDepthCm: row.observed_depth_cm,
    modelId: row.model_id,
    scenario: row.scenario,
    sourceReportId: row.source_report_id,
    recordedAt: new Date(row.recorded_at).toISOString(),
  };
}

function cryptoSuffix(): string {
  return Math.floor(performance.now() * 1000)
    .toString(36)
    .slice(-5);
}
