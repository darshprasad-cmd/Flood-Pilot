# FloodPilot

**AI Urban Flood Intelligence for Delhi NCR.**

FloodPilot is not a weather dashboard. It predicts where Delhi waterlogs, how
deep, and when — then tells one specific person, in one specific vehicle, on one
specific journey, what to do about it.

Every recommendation carries its reasoning. Every prediction carries a confidence
score that is earned from the state of its inputs, not printed for reassurance.

---

## Run it

```bash
npm install && npm run dev
```

Open <http://localhost:3000> and click **Launch App**. No API keys, no database,
no sign-up — it runs on live open data out of the box.

| Route | What it is |
| --- | --- |
| `/` | Landing page |
| `/app` | The application |
| `/gov` | Operations dashboard (access-gated) |

The development access code for the operations dashboard is
`delhi-flood-control`. Set `GOV_ACCESS_CODE` to change it.

---

## Why Delhi floods four different ways

Most flood tools model rainfall. Delhi needs four separate models, because the
four mechanisms have completely different warning times and completely different
right answers:

| Mechanism | Warning time | What actually helps |
| --- | --- | --- |
| **Cloudburst** — intensity overwhelms the storm network | ~20 minutes | Route around it, or don't go |
| **Trunk drain backup** — the Najafgarh drain runs full and surcharges onto the road | Hours *after* the rain | Wait it out; the water is still rising |
| **Underpass filling** — Minto Bridge, Pul Prahladpur: sealed boxes below grade | Minutes | Absolute avoidance; depth reaches 2 m |
| **Yamuna flooding** — above 205.33 m the city's outfalls reverse | ~48–72 hours | Evacuate the floodplain; days, not hours |

The whole road network spans about 34 metres of elevation. That is the root of
the problem: Delhi has very little gravity available to move water.

---

## What it does

- **Risk-based routing.** Not the fastest route — the one you survive. Depth is
  evaluated at the moment you would *reach* each road, so a stretch that is clear
  now but 40 cm deep in eighteen minutes is correctly treated as unsafe.
- **Vehicle survivability.** Ground clearance is the wrong number. What stops you
  is the air intake, and where that sits depends on body style far more than on
  clearance. A hatchback and a motorcycle with identical clearance behave
  completely differently.
- **A decision, not a dashboard.** Leave now, delay, take the Metro, take a cab,
  work remotely, cancel — or move your car out of the basement before 19:40.
- **Waterlogging engine.** Per road: accumulation probability, depth over time,
  drain overflow likelihood, time until impassable, recovery time after the rain
  stops, and nine modelled failure modes each stating the basis it rests on.
- **Explainable by construction.** `AgentEnvelope.explanations` is
  `NonEmpty<Explanation>` — an agent that returns an unexplained result does not
  compile.
- **Live learning.** Citizen reports re-weight predictions immediately and are
  recorded against what was forecast, driving a per-segment correction.
- **Community intelligence.** Sixteen report types with GPS, severity and lane
  blockage; every report verified against corroboration, rainfall, traffic,
  history and the model before it is allowed to move anything; reports clustered
  into *events* with the cause inferred — including causes nobody reported.
- **Seven languages.** Hindi, English, Punjabi, Urdu, Bengali, Bhojpuri and
  Maithili. See [`docs/I18N.md`](docs/I18N.md).
- **Works on a phone.** iPhone and Android layouts, safe-area handling, 16px
  controls so iOS does not zoom, and a PWA manifest.

---

## Data sources

Official Indian government sources are preferred for every signal they cover.
Where they require credentials, FloodPilot falls through to an open source and
**says so** — every prediction lists which provider actually answered.

| Source | Provides | Status |
| --- | --- | --- |
| [IMD](https://api.imd.gov.in/) | Rainfall forecast, hourly rainfall, intensity, QPF, colour-coded warnings | Adapter ready · needs `IMD_API_KEY` |
| [CWC](https://cwc.gov.in/) | Yamuna level, discharge, gauge thresholds, flood warnings | Adapter ready · needs `CWC_API_KEY`, or enter a bulletin reading via `YAMUNA_LEVEL_M` |
| [Delhi I&FC](https://ifc.delhi.gov.in/) | Trunk drain network, barrages, control rooms, helplines | Seeded from published information |
| [DDMA](https://ddma.delhi.gov.in/) | Flood-prone areas, advisories, historical behaviour | Seeded from published information |
| [Google Maps Platform](https://developers.google.com/maps) | Road elevation, live congestion, alternate routes | Adapter ready · needs `GOOGLE_MAPS_API_KEY` |
| [OpenStreetMap](https://overpass-api.de/) | Drains, canals, culverts, underpasses, water bodies | **Live** — 1,475 drainage channels and 640 underpasses extracted |
| [Open-Meteo](https://open-meteo.com/) | Rainfall, observed history, elevation, river discharge | **Live** — the keyless fallback |

Google is used as a *source*, never as the decision-maker. Its Directions API is
consulted only as a cross-check: a maps API optimises for time and has no idea
the underpass on its fastest route is about to be under a metre of water.

Refresh the OpenStreetMap drainage layer with:

```bash
npm run enrich:osm delhi
```

---

## Configuration

Everything is optional. Copy `.env.example` to `.env.local` to enable more.

| Variable | Effect |
| --- | --- |
| `IMD_API_KEY` | Makes IMD the primary rainfall source |
| `IMD_API_BASE` | Point at whichever IMD host your credential covers |
| `CWC_API_KEY` | Live Yamuna gauge feed |
| `YAMUNA_LEVEL_M` | Enter the current gauge reading from a CWC bulletin by hand |
| `GOOGLE_MAPS_API_KEY` | Google elevation and live congestion |
| `DATABASE_URL` | Switch to PostGIS (also run `npm install pg`) |
| `GOV_ACCESS_CODE` | Operations dashboard access code |
| `FLOODPILOT_HOTSPOTS_URL` | Override the waterlogging register at runtime |

---

## Verified behaviour

These are results from running the system, not claims about it.

**The model finds Delhi's real hotspots without any location being
special-cased.** Under a cloudburst it ranks, in order: Minto Bridge (1.85 m),
Zakhira (1.28 m), Sarai Kale Khan–Ashram (92 cm), Pul Prahladpur (81 cm), Palam,
Dhaula Kuan, Rajghat–ITO, Geeta Colony.

**Risk-based routing diverges from time-based routing exactly where it should.**

| Journey | Fastest | Recommended |
| --- | --- | --- |
| Najafgarh → Karol Bagh | 82 min, 1.25 m, 1 underpass | 105 min, 12 cm, 0 underpasses |
| Saket → ITO | 43 min, 78 cm, 1 underpass | 65 min, 31 cm, 0 underpasses |
| Punjabi Bagh → CP | 42 min, 78 cm | 118 min, 25 cm |

**It refuses to pretend.** When a Maruti Swift genuinely cannot cross the city
during a cloudburst, the route is relabelled *"Least dangerous route — best
available, still not safe"*, the impassable leg is flagged individually, and the
decision agent recommends the Metro instead of a route.

**Live learning moves the number in both directions.** Three citizen reports of
flooding on a low-risk road took it from 3.9% to 26.3%, with citizen reports
becoming the top driver at 30% of total contribution. Two subsequent "road
clear" reports brought it back to 14%.

---

## Architecture

Four layers, each only aware of the one below it. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for detail and
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what is next.

```
Surfaces    landing · citizen app · operations dashboard
Agents      prediction · route · vehicle · decision · infrastructure · citizen
Engines     hazard model · risk graph · routing · survivability · calibration
Signals     IMD · CWC · Google · OSM · Open-Meteo · citizen reports
```

**Adding a city is a data exercise.** Supply GIS layers, a drainage network,
historical flood records and source preferences as a `CityPlugin`. The hazard
engine, routing, vehicle model, decision engine and UI are unchanged. Bengaluru
ships alongside Delhi specifically to keep that claim honest.

**Flooding is one hazard, not the architecture.** `HazardModel` is generic —
heatwaves, dust storms, air quality and power outages register through the same
contract.

**The model is meant to be replaced.** Both the built-in heuristic and any future
gradient-boosted model consume the identical ordered `FLOOD_FEATURE_SPEC` and
return the same signed contributions — for a tree model, the SHAP vector.
Swapping it means implementing one interface.

---

## Honest limits

- Junctions, corridors, trunk drains and gauge thresholds are real. **Segment
  geometry is a straight-line approximation** between junction centroids — this
  is a risk graph, not a survey-grade centreline dataset.
- **Flood history is an illustrative seed** compiled from widely reported
  waterlogging events. It is labelled as seeded in provenance and is not an
  official BBMP, PWD or DDMA incident record.
- Drain inlet positions and silting are **modelled**; no municipal drainage
  inventory is publicly available to connect.
- The **PostGIS adapter and schema have not been run against a live database**
  in this build. They are reviewed but unverified.
- Traffic is modelled from time of day, road class and rainfall unless a Google
  key is present.
- FloodPilot is **decision support, not an emergency service.** In an emergency:
  Delhi Flood Control Room 1800-11-0093 · DDMA 1077 · Traffic Police 1095.

---

## Deployment — Netlify

`netlify.toml` is committed and the repository is deploy-ready. Netlify
auto-detects Next.js and installs its Next.js Runtime; the config supplies the
build command, Node 20, security headers for `/gov`, and — importantly — bundles
`public/data/**` into the serverless functions so the OpenStreetMap drainage
layer is readable at runtime.

**Connect the repo (recommended, no CLI):**

1. <https://app.netlify.com/start> → *Import from Git* → GitHub →
   `darshprasad-cmd/Flood-Pilot`
2. Leave the build settings alone — they come from `netlify.toml`
3. Deploy

**Or from the command line:**

```bash
npx netlify-cli login
npx netlify-cli init
npx netlify-cli deploy --build --prod
```

### Environment variables

None are required — the app runs on open data out of the box. Add any of these
under *Site configuration → Environment variables* to enable more:
`IMD_API_KEY`, `CWC_API_KEY` (or `YAMUNA_LEVEL_M`), `GOOGLE_MAPS_API_KEY`,
`DATABASE_URL`, `GOV_ACCESS_CODE`, `FLOODPILOT_HOTSPOTS_URL`.

Set `GOV_ACCESS_CODE` before sharing the URL — otherwise the operations
dashboard is reachable with the documented development code.

### What to expect on serverless

The default store is in-memory, so citizen reports and the learned calibration
live for the lifetime of a function instance and are not shared between them.
That is fine for evaluation and wrong for production: set `DATABASE_URL` and
apply `db/schema.sql` for anything real.

```bash
npm run build && npm start   # production build locally
```
