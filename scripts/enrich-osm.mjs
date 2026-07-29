#!/usr/bin/env node
/**
 * Extract Delhi's (or any city's) drainage geography from OpenStreetMap.
 *
 * Overpass is slow and rate-limited, so this runs offline and writes a
 * simplified layer into `public/data/<city>-osm-drainage.json` for the runtime to
 * read. Re-run it when you want fresher OSM data; the app works without it.
 *
 *   node scripts/enrich-osm.mjs delhi
 *   node scripts/enrich-osm.mjs bengaluru
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Overpass mirrors, tried in order. The main endpoint is heavily loaded and
 * times out on a bbox the size of the NCR; the alternatives usually do not.
 */
const ENDPOINTS = process.env.OVERPASS_API_URL
  ? [process.env.OVERPASS_API_URL]
  : [
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass-api.de/api/interpreter",
      "https://overpass.osm.ch/api/interpreter",
    ];

/** Keep the file small: no drainage channel needs more than this many points. */
const MAX_POINTS_PER_WAY = 24;

const CITIES = {
  // [south, west, north, east]
  delhi: [28.4, 76.84, 28.88, 77.4],
  bengaluru: [12.83, 77.46, 13.06, 77.78],
};

/**
 * Split into separate passes.
 *
 * One combined query over a bbox this size reliably times out on the public
 * endpoints. Each pass is small enough to complete, and a pass that fails only
 * costs that one layer rather than the whole extraction.
 */
function buildQueries([south, west, north, east]) {
  const bbox = `${south},${west},${north},${east}`;
  return [
    {
      name: "drainage channels",
      fills: ["waterways"],
      query: `[out:json][timeout:120];
(
  way["waterway"~"^(drain|canal|ditch)$"](${bbox});
);
out geom 4000;`,
    },
    {
      name: "streams and rivers",
      fills: ["waterways"],
      query: `[out:json][timeout:120];
(
  way["waterway"~"^(stream|river)$"](${bbox});
);
out geom 3000;`,
    },
    {
      name: "culverts and underpasses",
      fills: ["culverts", "underpasses"],
      query: `[out:json][timeout:120];
(
  node["man_made"="culvert"](${bbox});
  way["tunnel"="culvert"](${bbox});
  way["highway"]["tunnel"="yes"](${bbox});
);
out center 3000;`,
    },
    {
      name: "water bodies",
      fills: ["waterBodies"],
      query: `[out:json][timeout:120];
(
  way["natural"="water"](${bbox});
  way["landuse"="reservoir"](${bbox});
);
out center 3000;`,
    },
  ];
}

/** Keep endpoints and thin the middle — shape is preserved, size is not. */
function simplify(path) {
  if (path.length <= MAX_POINTS_PER_WAY) return path;
  const step = (path.length - 1) / (MAX_POINTS_PER_WAY - 1);
  const out = [];
  for (let i = 0; i < MAX_POINTS_PER_WAY; i++) {
    out.push(path[Math.round(i * step)]);
  }
  return out;
}

function round(v) {
  return Math.round(v * 1e5) / 1e5;
}

function emptyLayer(cityId) {
  return {
    cityId,
    generatedAt: new Date().toISOString(),
    waterways: [],
    culverts: [],
    underpasses: [],
    bridges: [],
    waterBodies: [],
    counts: {},
  };
}

function parseInto(layer, payload) {
  const bump = (key) => {
    layer.counts[key] = (layer.counts[key] ?? 0) + 1;
  };

  for (const el of payload.elements ?? []) {
    const tags = el.tags ?? {};
    const path = (el.geometry ?? []).map((g) => ({
      lat: round(g.lat),
      lng: round(g.lon),
    }));
    const centre =
      el.lat !== undefined && el.lon !== undefined
        ? { lat: round(el.lat), lng: round(el.lon) }
        : el.center
          ? { lat: round(el.center.lat), lng: round(el.center.lon) }
          : path.length > 0
            ? path[Math.floor(path.length / 2)]
            : null;

    const name = tags.name ?? null;

    if (tags.waterway) {
      if (path.length >= 2) {
        layer.waterways.push({
          id: el.id,
          kind: tags.waterway,
          name,
          path: simplify(path),
        });
        bump(`waterway:${tags.waterway}`);
      }
      continue;
    }

    if (tags.man_made === "culvert" || tags.tunnel === "culvert") {
      if (centre) {
        layer.culverts.push({ id: el.id, kind: "culvert", name, at: centre });
        bump("culvert");
      }
      continue;
    }

    if (tags.highway && (tags.tunnel === "yes" || String(tags.layer ?? "").startsWith("-"))) {
      if (centre) {
        layer.underpasses.push({
          id: el.id,
          kind: tags.tunnel === "yes" ? "tunnel" : "below_grade",
          name,
          at: centre,
        });
        bump("underpass");
      }
      continue;
    }

    if (tags.highway && tags.bridge === "yes") {
      if (centre) {
        layer.bridges.push({ id: el.id, kind: "bridge", name, at: centre });
        bump("bridge");
      }
      continue;
    }

    if (tags.natural === "water" || tags.landuse === "reservoir") {
      if (centre) {
        layer.waterBodies.push({
          id: el.id,
          kind: tags.natural === "water" ? "water" : "reservoir",
          name,
          at: centre,
        });
        bump("water_body");
      }
    }
  }

  return layer;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run one pass, trying each mirror in turn with a short backoff. */
async function runPass(query, label) {
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        // Overpass wants the raw query as the body and rejects requests
        // without a User-Agent identifying the client.
        const res = await fetch(endpoint, {
          method: "POST",
          body: query,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "User-Agent":
              "FloodPilot/0.2 (urban flood intelligence; drainage extraction)",
            Accept: "application/json",
          },
        });

        if (res.ok) return await res.json();

        console.log(
          `  ${label}: ${new URL(endpoint).host} returned ${res.status} (attempt ${attempt})`,
        );
      } catch (err) {
        console.log(`  ${label}: ${new URL(endpoint).host} failed — ${err.message}`);
      }
      await sleep(3000 * attempt);
    }
  }
  return null;
}

async function main() {
  const cityId = process.argv[2] || "delhi";
  const bounds = CITIES[cityId];
  if (!bounds) {
    console.error(
      `Unknown city "${cityId}". Known: ${Object.keys(CITIES).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Extracting ${cityId} drainage geography from OpenStreetMap...`);

  const dir = join(process.cwd(), "public", "data");
  const path = join(dir, `${cityId}-osm-drainage.json`);

  // Overpass rate-limits and times out unpredictably, and a partial run that
  // wiped a good layer would be worse than not running at all. Load whatever is
  // already there and only replace the collections whose pass succeeded.
  let existing = null;
  try {
    existing = JSON.parse(await readFile(path, "utf8"));
    console.log(
      `Existing layer found: ${existing.waterways?.length ?? 0} channels, ${
        existing.waterBodies?.length ?? 0
      } water bodies. Failed passes will keep it.`,
    );
  } catch {
    /* first run */
  }

  const layer = emptyLayer(cityId);
  const failures = [];
  const succeeded = new Set();

  for (const pass of buildQueries(bounds)) {
    console.log(`- ${pass.name}`);
    const payload = await runPass(pass.query, pass.name);
    if (payload) {
      parseInto(layer, payload);
      for (const key of pass.fills) succeeded.add(key);
    } else {
      failures.push(pass.name);
    }
  }

  if (failures.length === buildQueries(bounds).length && !existing) {
    console.error(
      "\nEvery Overpass pass failed and there is nothing cached. The public endpoints are rate-limiting; retry later or set OVERPASS_API_URL.",
    );
    process.exit(1);
  }

  // Union with whatever was cached, deduplicated by OSM id.
  //
  // A union rather than a per-collection replace, because two passes both feed
  // `waterways` — if one succeeded and the other did not, replacing would
  // silently drop half the drainage network.
  if (existing) {
    for (const key of ["waterways", "culverts", "underpasses", "bridges", "waterBodies"]) {
      const seen = new Set(layer[key].map((item) => item.id));
      for (const item of existing[key] ?? []) {
        if (!seen.has(item.id)) {
          layer[key].push(item);
          seen.add(item.id);
        }
      }
    }
  }
  void succeeded;

  if (failures.length > 0) {
    console.log(
      `\nPartial extraction — these passes failed and kept their cached data: ${failures.join(", ")}`,
    );
  }

  await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(layer));

  const sizeKb = Math.round(JSON.stringify(layer).length / 1024);
  console.log(`\nWrote ${path} (${sizeKb} KB)`);
  console.log(`  drainage channels : ${layer.waterways.length}`);
  console.log(`  culverts          : ${layer.culverts.length}`);
  console.log(`  underpasses       : ${layer.underpasses.length}`);
  console.log(`  bridges           : ${layer.bridges.length}`);
  console.log(`  water bodies      : ${layer.waterBodies.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
