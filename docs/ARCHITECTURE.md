# FloodPilot Architecture

FloodPilot is built as four stacked layers. Each layer only knows about the one
below it, so any single layer can be replaced without touching the others.

```
┌──────────────────────────────────────────────────────────────┐
│  4. Surfaces      landing · citizen app (/app) · gov (/gov)  │
├──────────────────────────────────────────────────────────────┤
│  3. Agents        prediction · route · vehicle · decision ·  │
│                   infrastructure · citizen                   │
├──────────────────────────────────────────────────────────────┤
│  2. Engines       hazard engine · risk graph · routing ·     │
│                   survivability · calibration                │
├──────────────────────────────────────────────────────────────┤
│  1. Signals       weather · elevation · drains · traffic ·   │
│                   history · river discharge · user reports   │
└──────────────────────────────────────────────────────────────┘
```

## 1. Signals

Every external input is a `SignalProvider`. Providers declare their own freshness
and reliability, which is what lets the layers above compute an honest confidence
score instead of a decorative one.

Real, keyless sources (Open-Meteo) are used where they exist; the rest are
simulated behind the same interface so they can be swapped for procurement-grade
feeds later without changing a caller.

## 2. Engines

### Hazard engine

Flooding is *one* hazard, not the architecture. A `HazardModel` is a generic
contract — extract features, return a prediction with probability, magnitude,
time-to-onset, confidence and ranked drivers. Heatwaves, dust storms, air quality
and outages register the same way. Nothing in the engine core is flood-specific.

### Scoring models

A `HazardModel` delegates the actual numbers to a `ScoringModel`. Both the
built-in heuristic and any future gradient-boosted model consume the identical
ordered `FEATURE_SPEC`, so replacing the heuristic with XGBoost/LightGBM means
implementing one interface — no feature plumbing changes.

### Road risk graph

The city is a graph of junctions and road segments. Static attributes (elevation,
slope, drains, catchment, history) are seeded; dynamic attributes (flood
probability, depth, confidence, traffic, drain capacity, timestamp) are written
by the hazard engine and read by routing.

### Routing

Risk-weighted shortest path over that graph. Cost blends travel time with a
vehicle-aware risk penalty, and segments deeper than a vehicle can survive are
hard-blocked rather than merely penalised.

## 3. Agents

Six independent, replaceable services behind one `Agent<In, Out>` contract. Each
returns data *plus* explanations, confidence and provenance. The return type
makes explanations non-optional, so an unexplained AI output cannot compile.

## 4. Surfaces

Next.js App Router. The citizen app and the government dashboard consume the same
agents through HTTP routes; the government dashboard is access-gated in
middleware and never linked from citizen surfaces.

---

*This document tracks the code. Sections are expanded as each layer lands.*
