# FloodPilot Architecture

Four stacked layers. Each layer only knows about the one below it, so any single
layer can be replaced without touching the others.

```
┌──────────────────────────────────────────────────────────────┐
│  4. Surfaces      landing · citizen app (/app) · gov (/gov)  │
├──────────────────────────────────────────────────────────────┤
│  3. Agents        prediction · route · vehicle · decision ·  │
│                   infrastructure · citizen                   │
├──────────────────────────────────────────────────────────────┤
│  2. Engines       hazard engine · risk graph · routing ·     │
│                   waterlogging · survivability · calibration │
├──────────────────────────────────────────────────────────────┤
│  1. Signals       IMD · CWC · Google · OSM · Open-Meteo ·    │
│                   traffic model · citizen reports            │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Signals

`src/lib/signals/`

Every external input is a provider with declared availability and provenance.
Providers are resolved in the order the city plugin prefers them, and the one
that actually answered is recorded — which is what makes the "prediction based
on" panel truthful rather than decorative.

| File | Responsibility |
| --- | --- |
| `providers/imd.ts` | IMD rainfall, QPF, colour-coded warnings. Env-gated. |
| `providers/cwc.ts` | Yamuna gauges with real CWC thresholds; manual bulletin entry path. |
| `providers/google.ts` | Elevation, congestion from travel times, Directions as cross-check only. |
| `providers/osm.ts` | Overpass extraction of drains, canals, culverts, underpasses. |
| `weather.ts` | Open-Meteo forecast and the rainfall scenario system. |
| `antecedent.ts` | 30-day observed rainfall → soil saturation. |
| `traffic.ts` | Congestion modelled from time of day, road class and rainfall. |
| `reports.ts` | Time-decayed, corroboration-weighted citizen report signal. |

Two rules the rest of the codebase depends on:

1. **Providers never throw.** A failed upstream degrades confidence; it does not
   take down the page.
2. **Providers never hang.** Every call is on a hard timeout, because a slow
   weather API must not hold a route calculation open.

Rainfall is sampled on an eight-cell grid and interpolated per road. Delhi
routinely records 100 mm in Najafgarh and 5 mm in Mayur Vihar in the same three
hours; a single centroid reading would be actively misleading.

---

## 2. Engines

`src/lib/engine/`, `src/lib/hazard/`, `src/lib/graph/`, `src/lib/routing/`

### Hazard engine

Flooding is *one hazard*, not the architecture. `HazardModel` is a generic
contract — extract features, return probability, magnitude, time-to-onset,
confidence and ranked drivers. Heatwaves, dust storms, air quality and outages
register the same way, and nothing in the engine core is flood-specific.

### Scoring models

A `HazardModel` delegates the numbers to a `ScoringModel`. The built-in
heuristic is a logistic model in log-odds space whose weights were tuned against
known Delhi behaviour. Two properties make it a placeholder rather than a dead
end:

- **Contributions are exact.** `weight × (value − neutral)` *is* the feature's
  effect on the log-odds, so the "Why?" panel reads the model rather than a
  narrative bolted on beside it.
- **It implements an interface.** A gradient-boosted model consumes the same
  ordered `FLOOD_FEATURE_SPEC` and returns the same shape — for a tree model,
  the SHAP vector. Replacing `heuristic-model.ts` changes nothing else.

The `neutral` field on every feature is the attribution baseline, playing exactly
the role of a SHAP base value.

### Road risk graph

`CityGraph` is built once per process from a `CityPlugin` and cached; only
`SegmentState` — the risk numbers — is recomputed each tick. That split is what
lets an expensive network be reused while the dynamics stay fresh.

Static attributes: elevation, slope, catchment, impervious fraction, drain
inventory and condition, trunk-drain proximity and siltation, floodplain
exposure, basement parking, pump stations, flood history, hotspot register entry.

### Waterlogging engine

`waterlogging.ts` answers the operational questions probability cannot:

- **Drain overflow likelihood** — three independent routes (rainfall intensity
  outmatching inlets, trunk drain surcharge, river holding the outfall shut)
  combined as independent failures, then coupled to modelled depth so "certain
  overflow" cannot be reported alongside "4 cm of water".
- **Time to impassable** — when depth crosses 30 cm.
- **Recovery time** — extrapolated from the terminal drainage rate, degraded by
  how blocked the outfall is. This is why Geeta Colony stays under for a day and
  Vasant Kunj clears in an hour.
- **Nine failure modes** — clogged drains, storm drain overflow, waterlogged
  intersections, underpass filling, basement parking, road closure, pump
  capacity, drain backflow, construction obstruction. Each states its basis,
  because a modelled risk presented as an observation is worse than none.

### Depth model

`hydrology.ts` is a lumped reservoir model producing a hydrograph, not a single
number:

```
ponded' = ponded + inflow − drainage,  then gravity recession
```

Inflow is rainfall × runoff coefficient × catchment gain. Drainage is effective
capacity against a 25 mm/hr design storm. Recession is suppressed by river
backwater and trunk-drain pressure — which is exactly what turns a two-hour
closure into a two-day one.

### Routing

Time-dependent search where the depth used for a segment is the depth at the
moment you would *reach* it. Risk penalties are expressed in equivalent minutes
so the trade is legible. Water beyond the vehicle's limit is a large finite wall
rather than infinity, so a least-dangerous route always exists to show.

### Calibration

`calibration.ts` fits a per-segment correction from verified outcomes: a bias in
log-odds space and a multiplier on depth, both clamped. This is the *architecture*
for learning rather than a clever learner — the same table is the training set
for a gradient-boosted model, and the correction shrinks as the model absorbs it.

---

## 3. Agents

`src/lib/agents/`

Six independent services behind one `Agent<In, Out>` contract. Each returns data
*plus* explanations, confidence and provenance.

The obligation is enforced by the type system: `AgentEnvelope.explanations` is
`NonEmpty<Explanation>`, so an agent returning an unexplained result does not
compile. That is the mechanism behind "never return unexplained AI outputs" —
not a convention anyone has to remember.

| Agent | Produces |
| --- | --- |
| Prediction | Flood predictions for every road segment |
| Route | Fastest vs safest comparison over the risk graph |
| Vehicle | Survivability against a specific depth |
| Decision | The action to take, including not travelling |
| Infrastructure | Deployment, drain failures, hotspots for control rooms |
| Citizen | Personalised alerts for one journey |

The orchestrator composes them and returns an agent trace — who produced what,
at what latency and confidence — which is what makes a recommendation auditable
rather than oracular.

---

## 4. Surfaces

Next.js App Router. The citizen app and the operations dashboard consume the same
agents through HTTP routes. The dashboard is gated in middleware covering both
the pages **and** the API behind them, because a dashboard with an open endpoint
is hidden rather than gated.

---

## Multi-city

`src/lib/cities/`

A `CityPlugin` supplies junctions, segments, trunk drains, river gauges, the
hotspot register, control rooms, rainfall normals and source preferences.
Everything above it is city-agnostic.

Delhi is version one and everything is tuned for it. Bengaluru ships alongside —
deliberately thinner, with no trunk-drain network and no river gauge, because its
flooding is pluvial and lake-overflow driven — as evidence that the multi-city
claim survives contact with a second city.

---

## Storage

`FloodPilotStore` is an interface. The default is in-memory so the platform runs
from a clean clone with no infrastructure. `PostgisStore` activates on
`DATABASE_URL` and computes report corroboration as a PostGIS proximity query,
which is the actual reason to have PostGIS here.

`db/schema.sql` carries the internal GIS layers: road segments, drain networks,
flood hotspots, waterlogging history, risk zones, citizen reports, prediction
outcomes, and a `segment_accuracy` view.

**Not yet exercised against a live PostGIS instance.** Reviewed, not verified.
