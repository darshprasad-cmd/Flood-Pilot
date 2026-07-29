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
    launchApp: "মানচিত্র খুলুন",
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
    back: "পিছনে",
    continue: "এগিয়ে যান",
    skip: "এড়িয়ে যান",
    yes: "হ্যাঁ",
    no: "না",
    search: "খুঁজুন",
    change: "বদলান",
    simple: "সহজ",
    detailed: "বিস্তারিত",
    showWorking: "হিসেব দেখান",
    hideWorking: "হিসেব লুকান",
    offline: "অফলাইন — এই ডিভাইসে সংরক্ষিত শেষ পরিস্থিতি দেখানো হচ্ছে।",
  },

  nav: {
    howItWorks: "কীভাবে কাজ করে",
    features: "বৈশিষ্ট্য",
    architecture: "কাঠামো",
    government: "সরকার",
    roadmap: "ভবিষ্যৎ পরিকল্পনা",
    about: "পরিচিতি",
  },

  landing: {
    eyebrow: "দিল্লি NCR",
    title: "সবচেয়ে নিরাপদ পথটি জেনে নিন।",
    lede:
      "একটি বুদ্ধিমান মানচিত্র — দিল্লির বৃষ্টি, নালা, উচ্চতা আর রাস্তা পড়ে বলে দেয় আপনার এখন কী করা উচিত।",
    primaryCta: "মানচিত্র খুলুন",
    secondaryCta: "এটি কী",
    cityRightNow: "দিল্লি এই মুহূর্তে",
    roadsWatched: "নজরে থাকা রাস্তা",
    setupTime: "সেট আপ করতে প্রায় ৪০ সেকেন্ড। সাইন-আপ লাগে না।",
    resume: "যেখানে ছেড়েছিলেন সেখান থেকে শুরু করুন",
    meaningNote:
      "दिशा শব্দের অর্থ দিক — শুধু কোন দিকে যাবেন তা নয়, কোন পথটি ঠিক তাও।",
  },

  onboarding: {
    welcomeTitle: "সবচেয়ে নিরাপদ পথটি জেনে নিন।",
    welcomeBody:
      "কয়েকটি প্রশ্নের উত্তর দিন, আর মানচিত্রটি হয়ে উঠবে আপনার নিজের — আপনার এলাকা, আপনার রাস্তা, আপনার গাড়ি।",
    welcomeCta: "শুরু করুন",
    welcomeNote: "প্রায় ৪০ সেকেন্ড। আপনার উত্তর এই ডিভাইসেই থাকে।",

    skipSetup: "সেটআপ এড়িয়ে যান",
    stepOf: "ধাপ {n} / {total}",

    searchPlaceholder: "এলাকা খুঁজুন…",
    noMatches: "এমন কোনও এলাকা পাওয়া যায়নি।",
    popular: "সাধারণ পছন্দ",
    allAreas: "সব এলাকা",
    optionalNote: "ঐচ্ছিক — এড়িয়ে যেতে পারেন।",

    qHome: "আপনি কোথায় থাকেন?",
    hHome: "যাতে মানচিত্র গোটা শহর নয়, আপনার পাড়ার উপর নজর রাখে।",
    qWork: "সাধারণত কোথায় যাতায়াত করেন?",
    hWork: "অফিস, কলেজ — বেশির ভাগ দিন যেখানে যান।",
    qCommute: "সাধারণত কীভাবে যান?",
    hCommute: "কত জলে আটকে যাবেন, তা গাড়ির ধরন অনুযায়ী অনেকটাই আলাদা।",
    qVehicle: "আপনি কী চালান?",
    hVehicle:
      "গ্রাউন্ড ক্লিয়ারেন্স নয়, আসলে এয়ার ইনটেকই আপনাকে থামায় — তাই আসল গাড়িটি জানা দরকার।",
    qBasement: "আপনি কি বেসমেন্টে গাড়ি রাখেন?",
    hBasement:
      "উপরের রাস্তা ডোবার অনেক আগেই বেসমেন্টের ঢাল বেয়ে জল ঢুকতে শুরু করে। রাখলে, আগেভাগেই গাড়ি সরাতে বলা হবে।",
    qFrequent: "আর কোথায় প্রায়ই যান?",
    hFrequent: "স্কুল, বাবা-মায়ের বাড়ি, ক্লিনিক। এগুলোর উপরেও নজর রাখা হবে।",
    qProactive: "জল জমা শুরুর আগেই সতর্কতা?",
    hProactive:
      "রাস্তা ডুবে যাওয়ার পরে নয় — বেরোনোর সময় ফুরিয়ে আসার আগেই জানানো হবে।",
    qEmergency: "আর জরুরি সতর্কতা?",
    hEmergency:
      "যমুনা নদীর সতর্কবার্তা, সরে যাওয়ার নির্দেশ ও কন্ট্রোল রুমের পরামর্শ।",

    buildingTitle: "আপনার মানচিত্র তৈরি হচ্ছে",
    buildingBody:
      "বৃষ্টি, নিকাশি, উচ্চতা এবং আপনার জায়গাগুলির মাঝের প্রতিটি রাস্তা পড়া হচ্ছে।",
    finish: "আমার ড্যাশবোর্ড খুলুন",

    placeIndia: "ভারত",
    placeCity: "দিল্লি NCR",
  },

  commute: {
    car: "গাড়ি",
    two_wheeler: "দু-চাকা",
    metro: "মেট্রো",
    bus: "বাস",
    auto: "অটো বা ক্যাব",
    walk: "হেঁটে",
  },

  alerts: {
    title: "সতর্কতা",
    none: "এখন আপনার নজর দেওয়ার মতো কিছু নেই।",
    enableNotifications: "অ্যাপ বন্ধ থাকলেও আমাকে জানান",
    notificationsOn: "এই অ্যাপ বন্ধ থাকলেও আপনাকে জানানো হবে।",
    notificationsBlocked:
      "আপনার ব্রাউজারের সেটিংসে এই সাইটের নোটিফিকেশন বন্ধ করা আছে।",

    departureTitle: "বেরোনোর সময় ফুরিয়ে আসছে",
    departureBody:
      "{clock}-এর মধ্যে বেরোন। তারপর এই যাত্রা আর নিরাপদ থাকবে না — এখন থেকে প্রায় {min} মিনিট।",
    noWindowTitle: "আজ নিরাপদে বেরোনোর কোনও সময় নেই",
    noWindowBody:
      "আগামী বারো ঘণ্টায় এমন কোনও সময় নেই যখন এই যাত্রা নিরাপদ। মেট্রোয় যান, বা না যাওয়াই ভালো।",
    routeTitle: "আপনার পথ বন্ধ",
    routeBody:
      "আপনার সবচেয়ে নিরাপদ পথের {count}টি রাস্তায় এত জল যে এই গাড়ি পেরোতে পারবে না।",
    homeRisingTitle: "আপনার কাছে জল জমছে",
    homeRisingBody: "{place}-এ অনুমিত জল {depth} সেমি, এখনও বাড়ছে।",
    homeFloodingTitle: "আপনার এলাকায় জল জমে যাচ্ছে",
    homeFloodingBody:
      "{place}-এ অনুমিত জল {depth} সেমি। যে জমা জলের তলা দেখা যাচ্ছে না, তার মধ্যে দিয়ে গাড়ি চালাবেন না।",
    moveCarTitle: "এখনই গাড়ি সরান",
    moveCarBody:
      "{place}-এ অনুমিত জল {depth} সেমি। উপরের রাস্তা ডোবার অনেক আগেই বেসমেন্টের ঢাল বেয়ে জল ভরে যায় — সময় থাকতে সরিয়ে নিন।",
    placeTitle: "{place} ঝুঁকিতে",
    placeBody: "অনুমিত জল {depth} সেমি।",
    riverWarningTitle: "যমুনা সতর্কতা স্তরের উপরে",
    riverDangerTitle: "যমুনা বিপদসীমার উপরে",
    riverBody:
      "{river}-এ জল {level} মিটার — {status}। বিপদসীমা {danger} মিটার। প্লাবনভূমি ছেড়ে চলে যান।",
  },

  dashboard: {
    tabToday: "আজ",
    tabMap: "মানচিত্র",
    tabJourney: "যাত্রা",
    tabArea: "আমার এলাকা",
    goodMorning: "শুভ সকাল",
    goodAfternoon: "শুভ অপরাহ্ন",
    goodEvening: "শুভ সন্ধ্যা",
    goodNight: "শুভ সন্ধ্যা",
    qSafeToTravel: "বেরোনো কি নিরাপদ?",
    qMyArea: "আমার এলাকা কি ঝুঁকিতে?",
    qMyCar: "গাড়ি কি সরাব?",
    qRoute: "কোন পথ সবচেয়ে নিরাপদ?",
    qDisruptions: "কী হতে পারে?",
    answerYes: "হ্যাঁ — যেতে পারেন।",
    answerCaution: "এখনই বেরোন, আর সাবধানে যান।",
    answerWait: "এখন নয়। অপেক্ষা করুন।",
    answerNo: "না। এই পথে গাড়ি চালাবেন না।",
    areaClear: "আপনার এলাকা পরিষ্কার।",
    areaWatch: "আপনার কাছাকাছি জল জমছে।",
    areaFlooding: "আপনার এলাকায় জল জমে যাচ্ছে।",
    carSafe: "গাড়ি যেখানে আছে, নিরাপদেই আছে।",
    carMove: "এখনই গাড়ি সরান।",
    noJourneyYet: "যাত্রার পরিকল্পনা করুন, নিরাপদ পথ দেখিয়ে দেওয়া হবে।",
    planJourney: "নিরাপদ যাত্রার পরিকল্পনা",
    checkArea: "আমার এলাকা দেখুন",
    reportSomething: "কিছু জানান",
    viewAlerts: "সতর্কতা দেখুন",
    nothingExpected: "আগামী কয়েক ঘণ্টায় সমস্যার আশঙ্কা নেই।",
    yourPlaces: "আপনার জায়গা",
    home: "বাড়ি",
    work: "নিয়মিত যাত্রা",
    editSetup: "আমার তথ্য বদলান",
    lastUpdated: "হালনাগাদ",
  },

  hero: {
    eyebrow: "দিল্লি NCR · সংস্করণ ১",
    titleLine1: "দিল্লিতে বন্যা চারটি আলাদা উপায়ে আসে।",
    titleLine2: "আবহাওয়ার অ্যাপ তার একটির কথা বলে।",
    lede:
      "दिशाAI জানায় শহরের কোথায় জল জমবে, কতটা গভীর এবং কখন — তারপর একজন নির্দিষ্ট মানুষকে, তার নির্দিষ্ট গাড়ির হিসেবে বলে কী করতে হবে।",
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
    whatWeRecommend: "दिशाAI যা প্রস্তাব করে",
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
