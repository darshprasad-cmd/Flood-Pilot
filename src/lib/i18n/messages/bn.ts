import type { Messages } from "./en";

/**
 * Bengali — key neighbourhood pockets across Delhi.
 *
 * Concentrated in Chittaranjan Park, Karol Bagh, and the trans-Yamuna
 * settlements — the last of which sit inside the floodplain and behind the
 * Shahdara drain, where flooding is measured in days rather than hours.
 */
export const bn: Messages = {
  meta: {
    languageName: "বাংলা",
    chooseLanguage: "ভাষা নির্বাচন করুন",
    translationNote:
      "ইন্টারফেস ও নিরাপত্তা নির্দেশনা অনূদিত। মডেলের বিস্তারিত ব্যাখ্যা আপাতত শুধু ইংরেজিতে।",
  },

  common: {
    launchApp: "অ্যাপ খুলুন",
    close: "বন্ধ করুন",
    why: "কেন?",
    loading: "লোড হচ্ছে…",
    live: "সরাসরি তথ্য",
    simulated: "অনুকৃত পরিস্থিতি",
    restricted: "সীমাবদ্ধ",
    signOut: "সাইন আউট",
    source: "উৎস",
    now: "এখন",
    min: "মিনিট",
    hr: "ঘণ্টা",
    cm: "সেমি",
    km: "কিমি",
    people: "মানুষ",
  },

  nav: {
    howItWorks: "কীভাবে কাজ করে",
    features: "বৈশিষ্ট্য",
    architecture: "কাঠামো",
    government: "সরকার",
    roadmap: "ভবিষ্যৎ পরিকল্পনা",
  },

  hero: {
    eyebrow: "দিল্লি NCR · সংস্করণ ১",
    titleLine1: "দিল্লিতে বন্যা চারটি আলাদা উপায়ে আসে।",
    titleLine2: "আবহাওয়ার অ্যাপ তার একটির কথা বলে।",
    lede:
      "FloodPilot জানায় শহরের কোথায় জল জমবে, কতটা গভীর এবং কখন — তারপর একজন নির্দিষ্ট মানুষকে, তার নির্দিষ্ট গাড়ির হিসেবে বলে কী করতে হবে।",
    secondaryCta: "কীভাবে কাজ করে",
    noSignup: "সাইন-আপ লাগে না। সরাসরি মুক্ত তথ্যে চলে।",
  },

  app: {
    journey: "যাত্রা",
    from: "কোথা থেকে",
    to: "কোথায়",
    leavingIn: "রওনা হতে",
    threeHours: "৩ ঘণ্টা",
    vehicle: "গাড়ি",
    model: "মডেল",
    year: "বছর",
    tyres: "টায়ার",
    context: "প্রেক্ষাপট",
    purpose: "উদ্দেশ্য",
    urgency: "জরুরি অবস্থা",
    canWorkRemotely: "এই কাজ বাড়ি থেকে হতে পারে",
    plan: "যাত্রার পরিকল্পনা করুন",
    planning: "পরিকল্পনা হচ্ছে…",
    thisJourney: "এই যাত্রা",
    cityConditions: "শহরের অবস্থা",
    recommendedAction: "প্রস্তাবিত পদক্ষেপ",
    alsoConsidered: "অন্য বিকল্পও দেখা হয়েছে",
    otherOptions: "অন্য বিকল্প",
    estimatedJourney: "আনুমানিক যাত্রা",
    actNow: "এখনই করুন",
    controlRooms: "বন্যা নিয়ন্ত্রণ কক্ষ",
    ifYouAreStuck: "আপনি আটকে গেলে",
    clearanceHint:
      "শুধু গ্রাউন্ড ক্লিয়ারেন্স ঠিক করে না আপনি জল পেরোতে পারবেন কি না — গাড়ির গড়ন প্রায়ই বেশি গুরুত্বপূর্ণ।",
    tabPlan: "পরিকল্পনা",
    tabMap: "মানচিত্র",
    tabBrief: "সারসংক্ষেপ",
  },

  stats: {
    roadsAtRisk: "ঝুঁকিতে থাকা রাস্তা",
    impassable: "চলাচলের অযোগ্য",
    deepest: "সবচেয়ে গভীর",
    peopleExposed: "ক্ষতিগ্রস্ত মানুষ",
    underpassesAtRisk: "ঝুঁকিতে আন্ডারপাস",
    hotspotsActive: "সক্রিয় হটস্পট",
    floodRisk: "বন্যার ঝুঁকি",
    trunkDrains: "প্রধান নালা ও যমুনা",
    highestRiskRoads: "সবচেয়ে ঝুঁকিপূর্ণ রাস্তা",
    worstFirst: "সবচেয়ে খারাপ আগে",
    rightNow: "এই মুহূর্তে",
  },

  risk: {
    safe: "নিরাপদ",
    low: "কম",
    moderate: "মাঝারি",
    high: "বেশি",
    severe: "তীব্র",
    critical: "অতি তীব্র",
  },

  confidence: {
    label: "আস্থা",
    high: "উচ্চ",
    moderate: "মাঝারি",
    low: "কম",
  },

  decision: {
    leave_now: "এখনই বেরোন",
    delay_departure: "রওনা দেরি করুন",
    use_metro: "মেট্রোয় যান",
    use_cab: "ক্যাব নিন",
    work_remotely: "বাড়ি থেকে কাজ করুন",
    cancel_trip: "যাত্রা বাতিল করুন",
    move_vehicle: "আপনার গাড়ি এখনই সরান",
    shelter_in_place: "যেখানে আছেন সেখানেই থাকুন",
  },

  purpose: {
    commute: "নিত্য যাতায়াত",
    medical: "চিকিৎসা",
    school_run: "স্কুলে পৌঁছে দেওয়া",
    work_critical: "জরুরি কাজ",
    airport: "বিমানবন্দর",
    leisure: "অবসর",
    delivery: "ডেলিভারি বা পরিবহন",
  },

  urgency: {
    flexible: "নমনীয় — অপেক্ষা করা যায়",
    deadline: "সময়সীমা আছে",
    leave_now: "অপেক্ষা করা যাবে না",
  },

  tyre: {
    standard: "সাধারণ",
    wet_grip: "ভেজা গ্রিপ",
    all_terrain: "অল-টেরেইন",
    worn: "ক্ষয়ে যাওয়া",
  },

  vehicleCard: {
    title: "গাড়ির সহনক্ষমতা",
    safe: "নিরাপদ",
    borderline: "সীমারেখায়",
    unsafe: "অনিরাপদ",
    safeBlurb: "এই গাড়ি সহজেই পেরিয়ে যাবে।",
    borderlineBlurb: "পেরোতে পারে, তবে কোনও অবকাশ থাকে না।",
    unsafeBlurb: "এই গাড়ি এত জল পেরোতে পারবে না।",
    waterOnRoute: "পথে জল",
    safeWadingDepth: "নিরাপদ গভীরতা",
    wadingLimit: "নিরাপদ সীমা",
    airIntake: "এয়ার ইনটেক",
  },

  route: {
    fastest: "দ্রুততম পথ",
    recommended: "প্রস্তাবিত নিরাপদ পথ",
    leastDangerous: "সবচেয়ে কম বিপজ্জনক পথ",
    whatMapsGives: "কোনও মানচিত্র অ্যাপ যা দেবে",
    whatWeRecommend: "FloodPilot যা প্রস্তাব করে",
    bestAvailable: "সেরা উপলব্ধ — তবুও নিরাপদ নয়",
    extraTime: "অতিরিক্ত সময়",
    riskReduction: "ঝুঁকি হ্রাস",
    lessWater: "কম জল",
    underpassesAvoided: "এড়ানো আন্ডারপাস",
    safeRouteScore: "নিরাপদ পথ স্কোর",
    peakRisk: "সর্বোচ্চ ঝুঁকি",
    underpasses: "আন্ডারপাস",
    segmentByStep: "অংশে অংশে",
    roads: "রাস্তা",
    underpass: "আন্ডারপাস",
    impassable: "চলাচলের অযোগ্য",
    sameRouteSafe:
      "দুটি অনুসন্ধানই একই রাস্তা বেছেছে। এখন সময় দিয়ে পাওয়ার মতো আর কোনও নিরাপদ বিকল্প নেই — এটি ভালো খবর।",
    sameRouteUnsafe:
      "দুটি অনুসন্ধানই একই রাস্তা বেছেছে কারণ বাকি সব আরও খারাপ। পথ বদলে এই যাত্রা ঠিক হবে না।",
    noRoute: "এই দুই জায়গার মধ্যে কোনও পথ তৈরি করা যায়নি।",
  },

  timeline: {
    title: "পূর্বাভাসের সময়রেখা",
    next12h: "পরবর্তী ১২ ঘণ্টা",
    recommendedDeparture: "প্রস্তাবিত রওনার সময়",
    windowCloses: "সময় শেষ হয়ে আসছে",
    noSafeWindow: "কোনও নিরাপদ সময় নেই",
    empty: "পরবর্তী বারো ঘণ্টায় কিছু ঘটার পূর্বাভাস নেই।",
  },

  explain: {
    title: "এই পরামর্শ কেন?",
    predictionTitle: "এই পূর্বাভাস কেন?",
    eyebrow: "ব্যাখ্যাযোগ্য AI",
    factor: "কারণ",
    factors: "কারণ",
    basedOn: "পূর্বাভাস যার উপর ভিত্তি করে",
    transparency: "স্বচ্ছতা",
    notConnected: "পছন্দের উৎস সংযুক্ত নয়",
    agents: "যে এজেন্টরা এটি তৈরি করেছে",
    architecture: "AI কাঠামো",
  },

  report: {
    eyebrow: "সরাসরি শেখা",
    title: "এখানকার অবস্থা জানান",
    flooded_road: "জল জমেছে",
    road_clear: "পরিষ্কার",
    drain_blockage: "নালা বন্ধ",
    vehicle_stalled: "গাড়ি বন্ধ হয়ে গেছে",
    depthPlaceholder: "গভীরতা সেমিতে (ঐচ্ছিক)",
    submit: "রিপোর্ট পাঠান",
    sending: "পাঠানো হচ্ছে…",
    thanks:
      "ধন্যবাদ — এই রাস্তার পূর্বাভাস হালনাগাদ হয়েছে এবং আপনার রিপোর্ট পূর্বাভাসের বিপরীতে নথিভুক্ত হয়েছে।",
    none:
      "এই রাস্তা থেকে এখনও কোনও রিপোর্ট নেই। রিপোর্টে পূর্বাভাস সঙ্গে সঙ্গে বদলায় এবং সময়ের সঙ্গে তার প্রভাব কমে।",
  },

  segment: {
    floodProbability: "বন্যার সম্ভাবনা",
    peakDepth: "সর্বোচ্চ গভীরতা",
    timeToFlood: "জল জমতে সময়",
    recovery: "জল নামতে",
    modelledDepth: "অনুমিত জলের গভীরতা",
    failureModes: "বিপর্যয়ের ধরন",
    whatGoesWrong: "এখানে কী ভুল হওয়ার আশঙ্কা",
    infrastructure: "পরিকাঠামো",
    whatIsHere: "এখানে কী আছে",
    elevation: "উচ্চতা",
    slope: "ঢাল",
    drainCapacity: "নালার ক্ষমতা",
    floodplainExposure: "প্লাবনভূমিতে অবস্থান",
    basementParking: "বেসমেন্ট পার্কিং",
    pumpStations: "পাম্পিং স্টেশন",
    floodHistory: "বন্যার ইতিহাস",
    recordedEvents: "নথিভুক্ত ঘটনা",
    register: "জলাবদ্ধতা রেজিস্টার",
    standingWater: "৮ সেমি — জল জমা",
    impassableAt: "৩০ সেমি — চলাচলের অযোগ্য",
    peak: "সর্বোচ্চ",
  },

  gov: {
    operations: "পরিচালনা",
    floodControl: "বন্যা নিয়ন্ত্রণ",
    deployment: "মোতায়েন",
    highRiskRoads: "উচ্চ ঝুঁকির রাস্তা",
    drainFailures: "নালা বিপর্যয়",
    hotspots: "হটস্পট",
    citizenReports: "নাগরিক রিপোর্ট",
    pumps: "পাম্প",
    teams: "দল",
    pumpsToDeploy: "মোতায়েনযোগ্য পাম্প",
    teamsToDeploy: "মোতায়েনযোগ্য দল",
    basements: "বেসমেন্ট",
    gaugeReadings: "যমুনার জলস্তর",
    warning: "সতর্কতা",
    danger: "বিপদ",
    accessCode: "অ্যাক্সেস কোড",
    signIn: "সাইন ইন",
    checking: "যাচাই হচ্ছে…",
    codeNotRecognised: "অ্যাক্সেস কোড চেনা যায়নি।",
    dashboardTitle: "বন্যা পরিচালনা ড্যাশবোর্ড",
    dashboardBlurb:
      "এই দৃশ্যে সম্পদ মোতায়েন ও পরিকাঠামো বিপর্যয়ের পূর্বাভাস রয়েছে। এটি সর্বজনীন অ্যাপের অংশ নয়।",
  },
};
