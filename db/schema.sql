-- FloodPilot PostGIS schema
--
-- The internal GIS layers the platform maintains: road segments, drain
-- networks, flood hotspots, waterlogging history and risk zones — plus the
-- citizen reports and prediction outcomes that drive live learning.
--
-- The application runs without any of this. The default store is in-memory so
-- the platform works from a clean clone with no infrastructure; this schema is
-- what you deploy when you want the register and the learning history to
-- survive a restart and be shared across instances.
--
--   createdb floodpilot
--   psql floodpilot -c 'CREATE EXTENSION postgis;'
--   psql floodpilot -f db/schema.sql
--   export DATABASE_URL=postgres://user:pass@host:5432/floodpilot
--   npm install pg
--
-- NOTE: this schema and the adapter in src/lib/db/postgis-store.ts have not
-- been exercised against a live PostGIS instance in this build. Treat them as
-- reviewed-but-unverified until you have run them.

CREATE EXTENSION IF NOT EXISTS postgis;

/* ── Cities ──────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS city (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  country         TEXT NOT NULL,
  timezone        TEXT NOT NULL,
  centre          GEOGRAPHY(POINT, 4326) NOT NULL,
  bounds          GEOGRAPHY(POLYGON, 4326),
  elevation_min_m REAL,
  elevation_max_m REAL,
  flood_character TEXT
);

/* ── Road network ────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS junction (
  id           TEXT PRIMARY KEY,
  city_id      TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  ward         TEXT,
  elevation_m  REAL NOT NULL,
  metro_station TEXT,
  metro_line   TEXT,
  metro_walk_m INTEGER,
  geom         GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS junction_geom_idx ON junction USING GIST (geom);
CREATE INDEX IF NOT EXISTS junction_city_idx ON junction (city_id);

CREATE TABLE IF NOT EXISTS road_segment (
  id                    TEXT PRIMARY KEY,
  city_id               TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  corridor              TEXT NOT NULL,
  from_junction         TEXT NOT NULL REFERENCES junction(id),
  to_junction           TEXT NOT NULL REFERENCES junction(id),
  road_class            TEXT NOT NULL,
  lanes                 SMALLINT NOT NULL,
  speed_limit_kph       SMALLINT NOT NULL,
  length_m              REAL NOT NULL,
  elevation_m           REAL NOT NULL,
  slope_pct             REAL NOT NULL,
  catchment_index       REAL NOT NULL,
  impervious_index      REAL NOT NULL,
  is_underpass          BOOLEAN NOT NULL DEFAULT FALSE,
  drain_capacity_index  REAL NOT NULL,
  drain_density_per_km  REAL NOT NULL,
  floodplain_exposure   REAL NOT NULL DEFAULT 0,
  major_drain_id        TEXT,
  major_drain_distance_m REAL,
  basement_parking      SMALLINT NOT NULL DEFAULT 0,
  pump_stations         SMALLINT NOT NULL DEFAULT 0,
  construction_obstruction BOOLEAN NOT NULL DEFAULT FALSE,
  population_exposure   INTEGER NOT NULL DEFAULT 0,
  critical_facilities   TEXT[],
  geom                  GEOGRAPHY(LINESTRING, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS road_segment_geom_idx ON road_segment USING GIST (geom);
CREATE INDEX IF NOT EXISTS road_segment_city_idx ON road_segment (city_id);
CREATE INDEX IF NOT EXISTS road_segment_corridor_idx ON road_segment (city_id, corridor);

/* ── Drainage network ────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS major_drain (
  id                    TEXT PRIMARY KEY,
  city_id               TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL,
  design_capacity_cumecs REAL,
  siltation_index       REAL NOT NULL DEFAULT 0.5,
  outfall               TEXT,
  operator              TEXT,
  note                  TEXT,
  geom                  GEOGRAPHY(LINESTRING, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS major_drain_geom_idx ON major_drain USING GIST (geom);

CREATE TABLE IF NOT EXISTS drain_inlet (
  id                  TEXT PRIMARY KEY,
  segment_id          TEXT NOT NULL REFERENCES road_segment(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL,
  design_capacity_lps REAL,
  silting_index       REAL NOT NULL DEFAULT 0.5,
  last_cleaned        DATE,
  geom                GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS drain_inlet_geom_idx ON drain_inlet USING GIST (geom);
CREATE INDEX IF NOT EXISTS drain_inlet_segment_idx ON drain_inlet (segment_id);

/* ── River gauges ────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS gauge_station (
  id                 TEXT PRIMARY KEY,
  city_id            TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  river              TEXT NOT NULL,
  code               TEXT,
  operator           TEXT NOT NULL,
  warning_level_m    REAL NOT NULL,
  danger_level_m     REAL NOT NULL,
  evacuation_level_m REAL NOT NULL,
  driven_by          TEXT,
  upstream_lag_hr    REAL,
  geom               GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS gauge_reading (
  id            BIGSERIAL PRIMARY KEY,
  station_id    TEXT NOT NULL REFERENCES gauge_station(id) ON DELETE CASCADE,
  level_m       REAL NOT NULL,
  discharge_cumecs REAL,
  source        TEXT NOT NULL,
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gauge_reading_station_time_idx
  ON gauge_reading (station_id, observed_at DESC);

/* ── Hotspot register ────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS flood_hotspot (
  id                  TEXT PRIMARY KEY,
  city_id             TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  kind                TEXT NOT NULL,
  severity            TEXT NOT NULL,
  typical_depth_cm    REAL,
  typical_duration_hr REAL,
  pumps_deployed      SMALLINT,
  source              TEXT NOT NULL,
  note                TEXT,
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  geom                GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS flood_hotspot_geom_idx ON flood_hotspot USING GIST (geom);

CREATE TABLE IF NOT EXISTS hotspot_segment (
  hotspot_id TEXT NOT NULL REFERENCES flood_hotspot(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES road_segment(id) ON DELETE CASCADE,
  PRIMARY KEY (hotspot_id, segment_id)
);

/* ── Risk zones ──────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS risk_zone (
  id          TEXT PRIMARY KEY,
  city_id     TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,   -- floodplain | low_colony | basin | ward
  severity    TEXT,
  note        TEXT,
  geom        GEOGRAPHY(POLYGON, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS risk_zone_geom_idx ON risk_zone USING GIST (geom);

/* ── Waterlogging history ────────────────────────────────────────────── */

-- One row per observed flooding event on a road. This is the historical
-- learning table: what happened, how deep, how long, and how much traffic
-- disruption it caused.
CREATE TABLE IF NOT EXISTS waterlogging_event (
  id             BIGSERIAL PRIMARY KEY,
  city_id        TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  segment_id     TEXT NOT NULL REFERENCES road_segment(id) ON DELETE CASCADE,
  occurred_on    DATE NOT NULL,
  depth_cm       REAL,
  duration_hr    REAL,
  disruption_hr  REAL,
  rainfall_mm    REAL,
  river_level_m  REAL,
  source         TEXT NOT NULL,
  note           TEXT
);

CREATE INDEX IF NOT EXISTS waterlogging_event_segment_idx
  ON waterlogging_event (segment_id, occurred_on DESC);

/* ── Citizen reports ─────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS citizen_report (
  id             TEXT PRIMARY KEY,
  city_id        TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  segment_id     TEXT NOT NULL REFERENCES road_segment(id) ON DELETE CASCADE,
  -- waterlogging | overflowing_drain | drain_blockage | road_closure |
  -- accident | heavy_congestion | construction | metro_construction |
  -- fallen_tree | power_lines_down | broken_down_vehicle | vehicle_stalled |
  -- emergency_vehicles | pothole | water_tanker | road_clear
  type           TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'moderate',
  depth_cm       REAL,
  lanes_blocked  SMALLINT,
  description    TEXT,
  photo_url      TEXT,
  reporter_id    TEXT NOT NULL,
  reporter_trust REAL NOT NULL DEFAULT 0.6,
  corroborations SMALLINT NOT NULL DEFAULT 0,
  contradictions SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  geom           GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS citizen_report_recent_idx
  ON citizen_report (city_id, created_at DESC);
CREATE INDEX IF NOT EXISTS citizen_report_segment_idx
  ON citizen_report (segment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS citizen_report_geom_idx
  ON citizen_report USING GIST (geom);

/* ── Prediction outcomes (live learning) ─────────────────────────────── */

-- Every prediction that later received ground truth. This is both the input to
-- the per-segment calibration term and the training table for a gradient
-- boosted model fitted against FLOOD_FEATURE_SPEC.
CREATE TABLE IF NOT EXISTS prediction_outcome (
  id                     TEXT PRIMARY KEY,
  city_id                TEXT NOT NULL REFERENCES city(id) ON DELETE CASCADE,
  segment_id             TEXT NOT NULL REFERENCES road_segment(id) ON DELETE CASCADE,
  predicted_probability  REAL NOT NULL,
  predicted_depth_cm     REAL NOT NULL,
  observed_flooded       BOOLEAN NOT NULL,
  observed_depth_cm      REAL,
  model_id               TEXT NOT NULL,
  scenario               TEXT NOT NULL,
  source_report_id       TEXT REFERENCES citizen_report(id) ON DELETE SET NULL,
  recorded_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prediction_outcome_segment_idx
  ON prediction_outcome (segment_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS prediction_outcome_city_idx
  ON prediction_outcome (city_id, recorded_at DESC);

/* ── Per-road accuracy ───────────────────────────────────────────────── */

-- Rolling prediction accuracy per road, which is what the confidence layer
-- reads when it says "past predictions here have been off by N points".
CREATE OR REPLACE VIEW segment_accuracy AS
SELECT
  segment_id,
  city_id,
  count(*)                                              AS sample_count,
  avg(abs((CASE WHEN observed_flooded THEN 0.92 ELSE 0.08 END)
          - predicted_probability))                     AS mean_abs_error,
  avg(CASE WHEN observed_depth_cm IS NOT NULL AND predicted_depth_cm > 1
           THEN observed_depth_cm / predicted_depth_cm END) AS mean_depth_ratio,
  max(recorded_at)                                      AS last_verified_at
FROM prediction_outcome
GROUP BY segment_id, city_id;
