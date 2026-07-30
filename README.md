# दिशाAI

Know the Safest Way Forward.

दिशा (*disha*) is Hindi for direction. With AI it says what this is: something
that tells you which way to go.

दिशाAI predicts where Delhi waterlogs, how deep, and when. It then works out
what that means for one person, in one vehicle, on one journey, and says what to
do. Every recommendation shows its reasoning, and every prediction carries a
confidence score computed from the state of its inputs.

Live at <https://dishaai-delhi.netlify.app>.

> The GitHub repo is still called `Flood-Pilot`, from before the rename. The
> package is `dishaai` and every user-facing string reads दिशाAI.

## Running it

```bash
npm install && npm run dev
```

Open <http://localhost:3000>. There are no required API keys, no database and no
sign-up. It runs on live open data as-is.

| Route | What it is |
| --- | --- |
| `/` | The map. Live Delhi risk and one action |
| `/app` | First visit: the setup conversation. After that, your dashboard |
| `/about` | Mechanisms, architecture, data sources, limitations |
| `/gov` | Operations dashboard, access-gated |

The development access code for `/gov` is `delhi-flood-control`. Set
`GOV_ACCESS_CODE` to change it. It is already set to something else on the
deployed site.

## Tech stack

Four runtime dependencies.

```
next       15    App Router, RSC, middleware, serverless and edge
react      19
react-dom  19
leaflet    1.9   driven imperatively, not through react-leaflet
```

| Layer | Choice |
| --- | --- |
| Language | TypeScript 5.7, `strict` |
| Styling | Tailwind v4, CSS-first `@theme`, no config file |
| Build | Next 15 with PostCSS 8, Node 20 |
| Maps | Leaflet 1.9 with the SVG renderer, CARTO dark basemap |
| Storage | In-memory by default, PostGIS behind `DATABASE_URL` |
| Offline | Hand-written service worker, 120 lines |
| Hosting | Netlify. Serverless function plus one edge function for middleware |

126 TypeScript files, roughly 31,900 lines.

### What is deliberately absent

No charting library. The rainfall bars are flex divs and the depth curve is a
25-point SVG polygon, which is not worth 40 kB of gzip.

No state management library. React context covers the two things that are
genuinely global, language and profile.

No i18n framework. `Messages` is derived from the English dictionary with
literal types widened to `string`, so adding an English key is a compile error
in the other six locales until it is translated.

No ORM. The PostGIS adapter is parameterised SQL behind an interface. `pg` is
imported through a variable specifier so neither TypeScript nor the bundler
resolves it at build time when it is not installed.

No service-worker toolchain, and no image pipeline: the PWA icon rasteriser in
`scripts/make-icons.mjs` uses Node's built-in `zlib` and nothing else.

### Data layer

Live and keyless: Open-Meteo for rainfall, observed history, elevation and river
discharge. OpenStreetMap via Overpass for drains, culverts, underpasses and water
bodies, extracted offline into committed JSON (1,475 channels, 640 underpasses).

Written and env-gated: IMD, CWC, Google Maps Platform. Each reports which
provider actually answered, so a fallback is visible rather than silent.

### Engine

`HazardModel` is a generic contract and flooding is one registered hazard.
Scoring goes through a swappable `ScoringModel` over a 19-feature ordered
`FLOOD_FEATURE_SPEC`; the built-in heuristic and any future gradient-boosted
model return the same signed contributions, which for a tree model is the SHAP
vector.

Above that: a lumped-reservoir hydrology model producing a hydrograph, a
time-dependent Dijkstra that evaluates depth at the moment of arrival rather than
at request time, vehicle survivability from intake height, and per-segment online
calibration driven by verified citizen reports.

`AgentEnvelope.explanations` is typed `NonEmpty<Explanation>`, so an agent that
returns an unexplained result does not compile.

## Delhi floods four different ways

Most flood tools model rainfall and stop there. Delhi needs four models, because
the mechanisms have different warning times and different right answers.

| Mechanism | Warning time | What helps |
| --- | --- | --- |
| Cloudburst. Intensity overwhelms the storm network | ~20 minutes | Route around it, or don't go |
| Trunk drain backup. The Najafgarh drain runs full and surcharges onto the road | Hours after the rain | Wait. The water is still rising |
| Underpass filling. Minto Bridge, Pul Prahladpur: sealed boxes below grade | Minutes | Avoid entirely. Depth reaches 2 m |
| Yamuna flooding. Above 205.33 m the city's outfalls reverse | 48–72 hours | Leave the floodplain. This lasts days |

The whole road network spans about 34 metres of elevation. Delhi has very little
gravity available to move water, which is most of the problem.

## What it does

**Risk-based routing.** Depth is evaluated at the time you would arrive at each
road, not at the time you press the button. A stretch that is clear now but 40 cm
deep in eighteen minutes counts as unsafe.

**Vehicle survivability.** Ground clearance is the wrong number to reason from.
What stops a car is water reaching the air intake, and intake height depends more
on body style than on clearance. A hatchback and a motorcycle with the same
clearance behave very differently.

**A decision at the end.** Leave now, delay, take the Metro, take a cab, work
from home, cancel, or move your car out of the basement before 19:40.

**Waterlogging model.** Per road: accumulation probability, depth over time,
drain overflow likelihood, time until impassable, recovery time once the rain
stops, and nine failure modes with the evidence each one rests on.

**Forecast.** The next twelve hours of rainfall, and a band per road showing
when water crosses the action threshold, when it peaks, and when it clears.

**Explanations are structural.** `AgentEnvelope.explanations` is typed
`NonEmpty<Explanation>`, so an agent that returns an unexplained result fails to
compile.

**Alerts.** Departure window closing, water building near home, route blocked,
move the car, Yamuna above warning level. Gated by the two alert questions asked
during setup, and available as system notifications if you opt in.

**Live learning.** Citizen reports re-weight predictions immediately and are
recorded against what was forecast, which drives a per-segment correction.

**Community reports.** Sixteen report types with GPS, severity and lane
blockage. Reports are checked against corroboration, rainfall, traffic, history
and the model before they move anything, then clustered into events with the
cause inferred.

**Seven languages.** Hindi, English, Punjabi, Urdu, Bengali, Bhojpuri, Maithili.
See [`docs/I18N.md`](docs/I18N.md).

**Offline.** A service worker keeps the shell and the last predictions on the
device, and the header prints the time they were computed so stale data is not
mistaken for current.

**Phones.** iPhone and Android layouts, safe-area handling, 16 px form controls
so iOS does not zoom on focus, and a PWA manifest.

## Data sources

Indian government sources are preferred wherever they cover a signal. Where they
need credentials the app falls back to an open source and reports which provider
actually answered.

| Source | Provides | Status |
| --- | --- | --- |
| [IMD](https://api.imd.gov.in/) | Rainfall forecast, hourly rainfall, intensity, QPF, colour-coded warnings | Adapter written, needs `IMD_API_KEY` |
| [CWC](https://cwc.gov.in/) | Yamuna level, discharge, gauge thresholds, flood warnings | Adapter written, needs `CWC_API_KEY`, or enter a bulletin reading via `YAMUNA_LEVEL_M` |
| [Delhi I&FC](https://ifc.delhi.gov.in/) | Trunk drains, barrages, control rooms, helplines | Seeded from published information |
| [DDMA](https://ddma.delhi.gov.in/) | Flood-prone areas, advisories, historical behaviour | Seeded from published information |
| [Google Maps Platform](https://developers.google.com/maps) | Road elevation, live congestion, alternate routes | Adapter written, needs `GOOGLE_MAPS_API_KEY` |
| [OpenStreetMap](https://overpass-api.de/) | Drains, canals, culverts, underpasses, water bodies | Live. 1,475 channels and 640 underpasses extracted |
| [Open-Meteo](https://open-meteo.com/) | Rainfall, observed history, elevation, river discharge | Live. The keyless fallback |

Google is used as a data source, not as the decision-maker. Its Directions API
is consulted as a cross-check only: it optimises for time and does not know that
the underpass on its fastest route is about to be under a metre of water.

Refresh the OpenStreetMap drainage layer:

```bash
npm run enrich:osm delhi
```

## Configuration

All optional. Copy `.env.example` to `.env.local`.

| Variable | Effect |
| --- | --- |
| `IMD_API_KEY` | Makes IMD the primary rainfall source |
| `IMD_API_BASE` | Point at whichever IMD host your credential covers |
| `CWC_API_KEY` | Live Yamuna gauge feed |
| `YAMUNA_LEVEL_M` | Enter a gauge reading from a CWC bulletin by hand |
| `GOOGLE_MAPS_API_KEY` | Google elevation and live congestion |
| `DATABASE_URL` | Switch to PostGIS. Also run `npm install pg` |
| `GOV_ACCESS_CODE` | Operations dashboard access code |
| `FLOODPILOT_HOTSPOTS_URL` | Override the waterlogging register at runtime |

## Results

Numbers below came out of running the system.

Under a cloudburst the model ranks Delhi's known waterlogging points in this
order without any location being special-cased: Minto Bridge (1.85 m), Zakhira
(1.28 m), Sarai Kale Khan–Ashram (92 cm), Pul Prahladpur (81 cm), Palam, Dhaula
Kuan, Rajghat–ITO, Geeta Colony.

Risk-based routing diverges from time-based routing where you would expect:

| Journey | Fastest | Recommended |
| --- | --- | --- |
| Najafgarh → Karol Bagh | 82 min, 1.25 m, 1 underpass | 105 min, 12 cm, 0 underpasses |
| Saket → ITO | 43 min, 78 cm, 1 underpass | 65 min, 31 cm, 0 underpasses |
| Punjabi Bagh → CP | 42 min, 78 cm | 118 min, 25 cm |

When a Maruti Swift cannot cross the city during a cloudburst, the route is
relabelled "Least dangerous route, best available, still not safe", the
impassable leg is flagged on its own, and the decision agent recommends the Metro
rather than a route.

Live learning moves predictions in both directions. Three citizen reports of
flooding on a low-risk road took it from 3.9% to 26.3%, with citizen reports
becoming the largest single driver at 30% of total contribution. Two later "road
clear" reports brought it back to 14%.

## Architecture

Four layers, each aware only of the one below it. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/ROADMAP.md`](docs/ROADMAP.md).

```
Surfaces    map landing · setup · Today · Forecast · journey · operations
Agents      prediction · route · vehicle · decision · infrastructure · citizen
Engines     hazard model · risk graph · routing · survivability · calibration
Signals     IMD · CWC · Google · OSM · Open-Meteo · citizen reports
```

There are two map components on purpose. `RiskMap` is the instrument: clicked,
hovered, read off. `CinematicMap` is scenery with a camera, and carries the
landing page and the setup flow. Merging them would put cinematic behaviour one
bad conditional away from the screen people use during a flood.

Adding a city is a data exercise. Supply GIS layers, a drainage network,
historical flood records and source preferences as a `CityPlugin`. The hazard
engine, routing, vehicle model, decision engine and UI stay as they are.
Bengaluru ships alongside Delhi to keep that claim testable.

Flooding is one hazard rather than the architecture. `HazardModel` is generic, so
heatwaves, dust storms, air quality and power outages register through the same
contract.

The scoring model is meant to be swapped. The built-in heuristic and any future
gradient-boosted model consume the same ordered `FLOOD_FEATURE_SPEC` and return
the same signed contributions, which for a tree model is the SHAP vector.
Replacing it means implementing one interface.

## Limitations

Junctions, corridors, trunk drains and gauge thresholds are real. Segment
geometry is a straight-line approximation between junction centroids. This is a
risk graph, not a survey-grade centreline dataset.

Flood history is an illustrative seed compiled from widely reported waterlogging
events. Provenance labels it as seeded. It is not a PWD, MCD or DDMA incident
record.

Drain inlet positions and silting are modelled. No municipal drainage inventory
is published to connect to.

The PostGIS adapter and schema have been reviewed but never run against a live
database.

Traffic is modelled from time of day, road class and rainfall unless a Google key
is present. Intersection delay is an estimate, not published signal timing, since
Delhi's signals are adaptive and no schedule is published.

Translations have not been reviewed by native speakers. Key parity and
placeholder integrity are checked mechanically; register and tone are not. See
[`docs/I18N.md`](docs/I18N.md).

दिशाAI is decision support, not an emergency service. In an emergency: Delhi
Flood Control Room 1800-11-0093, DDMA 1077, Traffic Police 1095.

## Deployment

Netlify, at <https://dishaai-delhi.netlify.app>.

The subdomain is romanised because a DNS label cannot contain Devanagari.
Everything a user sees still reads दिशाAI: tab title, PWA name, home-screen icon
and wordmark.

`netlify.toml` supplies the build command, Node 20, security headers for `/gov`,
and bundles `public/data/**` into the serverless functions so the OpenStreetMap
drainage layer is readable at runtime. The Next.js Runtime is not pinned there;
Netlify installs the version it ships.

```bash
npx netlify-cli deploy --build --prod
```

### Continuous deployment

Linking the GitHub repo needs an OAuth grant only the account owner can give:
*Project configuration → Build & deploy → Continuous deployment → Link
repository*, then GitHub, `darshprasad-cmd/Flood-Pilot`, branch `main`. Leave the
build settings alone once linked. Until that is done, deploys are manual.

### Environment variables

None are required. Add any of `IMD_API_KEY`, `CWC_API_KEY` (or
`YAMUNA_LEVEL_M`), `GOOGLE_MAPS_API_KEY`, `DATABASE_URL`, `GOV_ACCESS_CODE`,
`FLOODPILOT_HOTSPOTS_URL` under *Site configuration → Environment variables*.

### On serverless

The default store is in-memory, so citizen reports and the learned calibration
live for the lifetime of a function instance and are not shared between them.
That is workable for evaluation and wrong for production. Set `DATABASE_URL` and
apply `db/schema.sql` for anything real.

```bash
npm run build && npm start   # production build locally
```
