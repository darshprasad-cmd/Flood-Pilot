/**
 * English messages — the source of truth.
 *
 * Every other locale is typed against this object, so adding a key here is a
 * compile error everywhere until it is translated. That is deliberate: a
 * half-translated flood warning is worse than an untranslated one, because the
 * user cannot tell which half they are missing.
 *
 * Scope note: this covers the interface and every safety-critical string —
 * decisions, risk levels, vehicle verdicts, alerts, timeline. The engine's
 * generated explanations (which interpolate live numbers) remain English for
 * now; see docs/I18N.md.
 */
export const en = {
  meta: {
    languageName: "English",
    chooseLanguage: "Choose language",
    translationNote:
      "Interface and safety guidance are translated. Detailed model explanations are currently English only.",
  },

  common: {
    launchApp: "Launch App",
    close: "Close",
    why: "Why?",
    loading: "Loading…",
    live: "Live data",
    simulated: "Simulated scenario",
    restricted: "Restricted",
    signOut: "Sign out",
    source: "Source",
    now: "Now",
    min: "min",
    hr: "hr",
    cm: "cm",
    km: "km",
    people: "people",
  },

  nav: {
    howItWorks: "How it works",
    features: "Features",
    architecture: "Architecture",
    government: "Government",
    roadmap: "Roadmap",
  },

  hero: {
    eyebrow: "Delhi NCR · Version 1",
    titleLine1: "Delhi floods in four different ways.",
    titleLine2: "A weather app tells you about one of them.",
    lede:
      "FloodPilot predicts where the city waterlogs, how deep, and when — then tells one specific person, in one specific vehicle, what to do about it.",
    secondaryCta: "How it works",
    noSignup: "No sign-up. Runs on live open data.",
  },

  app: {
    journey: "Journey",
    from: "From",
    to: "To",
    leavingIn: "Leaving in",
    threeHours: "3 hours",
    vehicle: "Vehicle",
    model: "Model",
    year: "Year",
    tyres: "Tyres",
    context: "Context",
    purpose: "Purpose",
    urgency: "Urgency",
    canWorkRemotely: "This could be done remotely",
    plan: "Plan this journey",
    planning: "Planning…",
    thisJourney: "This journey",
    cityConditions: "City conditions",
    recommendedAction: "Recommended action",
    alsoConsidered: "Also considered",
    otherOptions: "Other options",
    estimatedJourney: "Estimated journey",
    actNow: "Act now",
    controlRooms: "Flood control rooms",
    ifYouAreStuck: "If you are stuck",
    clearanceHint:
      "Clearance alone does not decide what you can cross — body style usually matters more.",
    tabPlan: "Plan",
    tabMap: "Map",
    tabBrief: "Brief",
  },

  stats: {
    roadsAtRisk: "Roads at risk",
    impassable: "Impassable",
    deepest: "Deepest",
    peopleExposed: "People exposed",
    underpassesAtRisk: "Underpasses at risk",
    hotspotsActive: "Hotspots active",
    floodRisk: "Flood risk",
    trunkDrains: "Trunk drains & Yamuna",
    highestRiskRoads: "Highest risk roads",
    worstFirst: "Worst first",
    rightNow: "Right now",
  },

  risk: {
    safe: "Safe",
    low: "Low",
    moderate: "Moderate",
    high: "High",
    severe: "Severe",
    critical: "Critical",
  },

  confidence: {
    label: "Confidence",
    high: "high",
    moderate: "moderate",
    low: "low",
  },

  decision: {
    leave_now: "Leave now",
    delay_departure: "Delay departure",
    use_metro: "Use the Metro",
    use_cab: "Take a cab",
    work_remotely: "Work remotely",
    cancel_trip: "Cancel the trip",
    move_vehicle: "Move your vehicle now",
    shelter_in_place: "Stay where you are",
  },

  purpose: {
    commute: "Commute",
    medical: "Medical",
    school_run: "School run",
    work_critical: "Work-critical",
    airport: "Airport",
    leisure: "Leisure",
    delivery: "Delivery or logistics",
  },

  urgency: {
    flexible: "Flexible — can wait",
    deadline: "Has a deadline",
    leave_now: "Cannot wait",
  },

  tyre: {
    standard: "Standard",
    wet_grip: "Wet grip",
    all_terrain: "All-terrain",
    worn: "Worn",
  },

  vehicleCard: {
    title: "Vehicle survivability",
    safe: "Safe",
    borderline: "Borderline",
    unsafe: "Unsafe",
    safeBlurb: "Well within what this vehicle handles.",
    borderlineBlurb: "Passable, but with no margin for error.",
    unsafeBlurb: "Beyond what this vehicle can cross.",
    waterOnRoute: "Water on route",
    safeWadingDepth: "Safe wading depth",
    wadingLimit: "Wading limit",
    airIntake: "Air intake",
  },

  route: {
    fastest: "Fastest route",
    recommended: "Recommended safe route",
    leastDangerous: "Least dangerous route",
    whatMapsGives: "What a maps app gives you",
    whatWeRecommend: "What FloodPilot recommends",
    bestAvailable: "Best available — still not safe",
    extraTime: "Extra time",
    riskReduction: "Risk reduction",
    lessWater: "Less water",
    underpassesAvoided: "Underpasses avoided",
    safeRouteScore: "Safe route score",
    peakRisk: "Peak risk",
    underpasses: "Underpasses",
    segmentByStep: "Segment by segment",
    roads: "roads",
    underpass: "Underpass",
    impassable: "Impassable",
    sameRouteSafe:
      "Both searches picked the same roads. There is no safer alternative to trade time for right now — which is good news.",
    sameRouteUnsafe:
      "Both searches picked the same roads because every alternative is worse. Changing route cannot fix this journey.",
    noRoute: "No route could be planned between these two junctions.",
  },

  timeline: {
    title: "Prediction timeline",
    next12h: "Next 12 hours",
    recommendedDeparture: "Recommended departure",
    windowCloses: "Window closes",
    noSafeWindow: "No safe window",
    empty: "Nothing forecast to happen in the next twelve hours.",
  },

  explain: {
    title: "Why this recommendation?",
    predictionTitle: "Why this prediction?",
    eyebrow: "Explainable AI",
    factor: "factor",
    factors: "factors",
    basedOn: "Prediction based on",
    transparency: "Transparency",
    notConnected: "Preferred sources not connected",
    agents: "Agents that produced this",
    architecture: "AI architecture",
  },

  report: {
    eyebrow: "Live learning",
    title: "Report conditions here",
    flooded_road: "Flooded",
    road_clear: "Clear",
    drain_blockage: "Drain blocked",
    vehicle_stalled: "Vehicle stalled",
    depthPlaceholder: "Depth in cm (optional)",
    submit: "Submit report",
    sending: "Sending…",
    thanks:
      "Thank you — the prediction for this road has been updated and your report is recorded against what was forecast.",
    none:
      "No reports from this road yet. Reports change the prediction immediately and are decayed over time.",
  },

  segment: {
    floodProbability: "Flood probability",
    peakDepth: "Peak depth",
    timeToFlood: "Time to flood",
    recovery: "Recovery",
    modelledDepth: "Modelled water depth",
    failureModes: "Failure modes",
    whatGoesWrong: "What is likely to go wrong here",
    infrastructure: "Infrastructure",
    whatIsHere: "What is here",
    elevation: "Elevation",
    slope: "Slope",
    drainCapacity: "Drain capacity",
    floodplainExposure: "Floodplain exposure",
    basementParking: "Basement parking",
    pumpStations: "Pumping stations",
    floodHistory: "Flood history",
    recordedEvents: "Recorded events",
    register: "Waterlogging register",
    standingWater: "8 cm — standing water",
    impassableAt: "30 cm — impassable",
    peak: "Peak",
  },

  gov: {
    operations: "Operations",
    floodControl: "flood control",
    deployment: "Deployment",
    highRiskRoads: "High-risk roads",
    drainFailures: "Drain failures",
    hotspots: "Hotspots",
    citizenReports: "Citizen reports",
    pumps: "pumps",
    teams: "teams",
    pumpsToDeploy: "Pumps to deploy",
    teamsToDeploy: "Teams to deploy",
    basements: "Basements",
    gaugeReadings: "Yamuna gauges",
    warning: "Warning",
    danger: "Danger",
    accessCode: "Access code",
    signIn: "Sign in",
    checking: "Checking…",
    codeNotRecognised: "Access code not recognised.",
    dashboardTitle: "Flood operations dashboard",
    dashboardBlurb:
      "This view carries resource deployment and infrastructure failure predictions. It is not part of the public application.",
  },
} as const;

/**
 * Widen the literal types from `as const` back to `string`.
 *
 * Without this, `Messages` would demand that every locale use the *English*
 * literal for every key — which typechecks only if nothing is ever translated.
 */
type Translated<T> = {
  [K in keyof T]: T[K] extends string ? string : Translated<T[K]>;
};

export type Messages = Translated<typeof en>;

export type MessageNamespace = keyof Messages;
