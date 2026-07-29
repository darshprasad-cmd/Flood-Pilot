# Roadmap

Delhi is version one. The engine is city-agnostic and hazard-agnostic by
construction, so most of what follows is data and integration work rather than
redesign.

---

## Shipped

- Delhi NCR road risk graph — 87 junctions, 120 segments
- Trunk drain network: Najafgarh, supplementary, Barapullah, Shahdara, Kushak,
  Civil Lines, plus the Yamuna
- Yamuna floodplain exposure per segment, with the CWC gauge at Old Railway
  Bridge and its real 204.50 / 205.33 / 206.00 m thresholds
- 24-entry waterlogging register, overridable at runtime
- Waterlogging engine: probability, depth, drain overflow, time to impassable,
  recovery time, nine failure modes
- Risk-based routing with arrival-time depth evaluation
- Vehicle survivability across a 50-entry catalogue weighted to Delhi traffic
- Six-agent layer with type-enforced explanations and an audit trace
- Decision engine with journey-purpose awareness
- Prediction timeline and departure window
- Citizen reporting with live calibration
- Gated operations dashboard
- IMD, CWC, Google and OSM adapters; OSM live with 1,475 drainage channels
- PostGIS schema and adapter (unverified against a live database)
- Bengaluru as a second city plugin

---

## Next

**Connect the official feeds.** The IMD and CWC adapters are written and
env-gated; they become primary the moment credentials are issued. This is the
single highest-value item — it moves rainfall from a global model to the
authoritative national one, and the Yamuna from an estimate to a reading.

**Verify PostGIS.** Run the schema and adapter against a live instance. Until
that happens the register and learning history do not survive a restart.

**Train a gradient-boosted model.** The outcome table is the training set and
`FLOOD_FEATURE_SPEC` is the contract. The heuristic was always meant to be
replaced; enough verified outcomes make that possible without touching anything
downstream.

**Municipal asset registers.** Drain inlet positions and silting are currently
modelled. PWD and I&FC hold the real inventories; connecting them would move
deployment advice from indicative to operational.

**Finer resolution.** Ward and colony level rather than road segments, which is
what matters for low-lying colonies and basement risk.

---

## Then

- **Mumbai, Chennai, Bengaluru** as full deployments with their own GIS layers,
  drainage datasets and state government feeds
- **Property-level risk** — basements, ground floors, parking structures
- **Fleet and logistics** — whole-fleet survivability, depot exposure, dispatch
  integration
- **Push alerts** tied to a personal departure window rather than a broadcast
- **Post-event reconstruction** for control rooms: what was predicted, what
  happened, what the gap was

---

## Beyond flooding

The `HazardModel` contract is deliberately hazard-agnostic. Each of these is a
new model and a new feature spec against the same engine, graph, routing and
decision layers:

- **Heatwaves** — a hazard whose subject is a ward rather than a road, which is
  precisely why `HazardContext` takes a generic subject
- **Dust storms** — visibility and respiratory exposure
- **Air quality** — Delhi's other annual emergency, with the same "what should I
  actually do" gap
- **Power outages** during monsoon
- **Water shortage** and supply disruption

---

## Known gaps

Stated plainly, because a roadmap that only lists ambitions is not useful:

- Segment geometry is straight-line between junctions, not survey-grade
- Flood history is an illustrative seed, not an official incident record
- Drain inventories are modelled
- Traffic is modelled without a Google key
- PostGIS is unverified
- Routing runs on major corridors, so very local detours are not modelled
- Vehicle wading depths are derived from body style, not manufacturer fording
  ratings, which most passenger cars do not publish
