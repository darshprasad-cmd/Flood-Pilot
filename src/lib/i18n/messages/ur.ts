import type { Messages } from "./en";

/**
 * Urdu — strong historical presence in Delhi.
 *
 * The only right-to-left locale here, which is why `dir` is a first-class field
 * on the locale record rather than an afterthought. Vocabulary leans on what is
 * actually spoken in Old Delhi and the walled city rather than on formal
 * literary Urdu — نالہ for a drain, انڈر پاس borrowed as-is.
 */
export const ur: Messages = {
  meta: {
    languageName: "اردو",
    chooseLanguage: "زبان منتخب کریں",
    translationNote:
      "انٹرفیس اور حفاظتی ہدایات ترجمہ شدہ ہیں۔ ماڈل کی تفصیلی وضاحت فی الحال صرف انگریزی میں ہے۔",
  },

  common: {
    launchApp: "نقشہ کھولیں",
    close: "بند کریں",
    why: "کیوں؟",
    loading: "لوڈ ہو رہا ہے…",
    live: "براہِ راست ڈیٹا",
    simulated: "فرضی منظرنامہ",
    restricted: "محدود",
    signOut: "سائن آؤٹ",
    source: "ماخذ",
    now: "ابھی",
    min: "منٹ",
    hr: "گھنٹے",
    cm: "سینٹی میٹر",
    km: "کلومیٹر",
    people: "لوگ",
    back: "واپس",
    continue: "آگے بڑھیں",
    skip: "چھوڑ دیں",
    yes: "ہاں",
    no: "نہیں",
    search: "تلاش",
    change: "بدلیں",
    simple: "سادہ",
    detailed: "تفصیلی",
    showWorking: "حساب دکھائیں",
    hideWorking: "حساب چھپائیں",
    offline: "آف لائن — اس ڈیوائس پر محفوظ پچھلے حالات دکھائے جا رہے ہیں۔",
    share: "یہ سڑک شیئر کریں",
    copied: "لنک کاپی ہو گیا",
  },

  nav: {
    howItWorks: "کیسے کام کرتا ہے",
    features: "خصوصیات",
    architecture: "ساخت",
    government: "حکومت",
    roadmap: "آئندہ منصوبہ",
    about: "تعارف",
  },

  landing: {
    eyebrow: "دہلی NCR",
    title: "آگے کا سب سے محفوظ راستہ جانیں۔",
    lede:
      "ایک ذہین نقشہ جو دہلی کی بارش، نالوں، زمین کی بلندی اور سڑکوں کو پڑھتا ہے — اور پھر بتاتا ہے کہ آپ کو کرنا کیا ہے۔",
    primaryCta: "نقشہ کھولیں",
    secondaryCta: "یہ ہے کیا",
    cityRightNow: "دہلی اس وقت",
    roadsWatched: "زیرِ نگرانی سڑکیں",
    setupTime: "سیٹ اپ میں تقریباً 40 سیکنڈ۔ سائن اپ کی ضرورت نہیں۔",
    resume: "جہاں چھوڑا تھا وہیں سے جاری رکھیں",
    meaningNote:
      "दिशा کا مطلب ہے سمت — صرف یہ نہیں کہ کس طرف، بلکہ یہ کہ صحیح طرف کون سی ہے۔",
  },

  onboarding: {
    welcomeTitle: "آگے کا سب سے محفوظ راستہ جانیں۔",
    welcomeBody:
      "چند سوالوں کے جواب دیں اور یہ نقشہ آپ کا اپنا بن جائے گا — آپ کا علاقہ، آپ کی سڑکیں، آپ کی گاڑی۔",
    welcomeCta: "شروع کریں",
    welcomeNote: "تقریباً 40 سیکنڈ۔ آپ کے جواب اسی فون میں رہتے ہیں۔",

    skipSetup: "سیٹ اپ چھوڑ دیں",
    stepOf: "مرحلہ {n} از {total}",

    searchPlaceholder: "علاقہ تلاش کریں…",
    noMatches: "اس نام کا کوئی علاقہ نہیں ملا۔",
    popular: "عام انتخاب",
    allAreas: "تمام علاقے",
    optionalNote: "اختیاری — آپ اسے چھوڑ سکتے ہیں۔",

    qHome: "آپ رہتے کہاں ہیں؟",
    hHome: "تاکہ نقشہ پورے شہر کے بجائے آپ کے محلے پر نظر رکھے۔",
    qWork: "عام طور پر کہاں آنا جانا ہوتا ہے؟",
    hWork: "دفتر، کالج، جہاں زیادہ تر دن جاتے ہیں۔",
    qCommute: "وہاں عام طور پر کس چیز سے جاتے ہیں؟",
    hCommute: "پانی ہر گاڑی کو الگ الگ گہرائی پر روک دیتا ہے۔",
    qVehicle: "آپ کون سی گاڑی چلاتے ہیں؟",
    hVehicle:
      "گاڑی اصل میں ایئر انٹیک کی وجہ سے رکتی ہے، گراؤنڈ کلیئرنس کی وجہ سے نہیں — اس لیے یہاں اصل گاڑی بتانا ضروری ہے۔",
    qBasement: "کیا آپ بیسمنٹ میں گاڑی کھڑی کرتے ہیں؟",
    hBasement:
      "اوپر سڑک ڈوبنے سے بہت پہلے بیسمنٹ ریمپ کی طرف سے بھرنے لگتی ہے۔ اگر ایسا ہے تو آپ کو گاڑی پہلے ہی ہٹانے کو کہا جائے گا۔",
    qFrequent: "اور کہیں اکثر جانا ہوتا ہے؟",
    hFrequent: "اسکول، والدین کا گھر، کلینک۔ ان پر بھی نظر رکھی جائے گی۔",
    qProactive: "پانی بھرنے سے پہلے اطلاع چاہیے؟",
    hProactive:
      "آپ کو تب بتایا جائے گا جب نکلنے کا وقت ختم ہو رہا ہو — سڑک ڈوب جانے کے بعد نہیں۔",
    qEmergency: "اور ہنگامی الرٹ؟",
    hEmergency:
      "جمنا کے انتباہ، انخلا کی اطلاعات اور کنٹرول روم کی ہدایات۔",

    buildingTitle: "آپ کا نقشہ بن رہا ہے",
    buildingBody:
      "بارش، نالے، زمین کی بلندی اور آپ کے مقامات کے درمیان ہر سڑک پڑھی جا رہی ہے۔",
    finish: "میرا ڈیش بورڈ کھولیں",

    placeIndia: "بھارت",
    placeCity: "دہلی NCR",
  },

  commute: {
    car: "کار",
    two_wheeler: "بائیک یا اسکوٹی",
    metro: "میٹرو",
    bus: "بس",
    auto: "آٹو یا کیب",
    walk: "پیدل",
  },

  alerts: {
    title: "الرٹ",
    none: "ابھی کوئی ایسی بات نہیں جس پر دھیان دینا پڑے۔",
    enableNotifications: "ایپ بند ہو تب بھی مجھے بتائیں",
    notificationsOn: "یہ ایپ بند ہو تب بھی آپ کو بتا دیا جائے گا۔",
    notificationsBlocked:
      "آپ کے براؤزر کی سیٹنگ میں اس سائٹ کے نوٹیفکیشن بند ہیں۔",

    departureTitle: "نکلنے کا وقت ختم ہو رہا ہے",
    departureBody:
      "{clock} تک نکل جائیں۔ اس کے بعد یہ سفر محفوظ نہیں رہے گا — یعنی اب سے تقریباً {min} منٹ بعد۔",
    noWindowTitle: "آج نکلنے کا کوئی محفوظ وقت نہیں",
    noWindowBody:
      "اگلے بارہ گھنٹوں میں کوئی ایسا وقت نہیں جب یہ سفر محفوظ ہو۔ میٹرو کا سوچیں، یا نہ جائیں۔",
    routeTitle: "آپ کا راستہ بند ہے",
    routeBody:
      "آپ کے سب سے محفوظ راستے کی {count} سڑکوں پر پانی اتنا گہرا ہے کہ یہ گاڑی پار نہیں کر سکتی۔",
    homeRisingTitle: "آپ کے قریب پانی جمع ہو رہا ہے",
    homeRisingBody:
      "اندازے کے مطابق {place} میں پانی {depth} سینٹی میٹر ہے اور ابھی اور بڑھ رہا ہے۔",
    homeFloodingTitle: "آپ کے علاقے میں پانی بھر رہا ہے",
    homeFloodingBody:
      "اندازے کے مطابق {place} میں پانی {depth} سینٹی میٹر ہے۔ جس پانی کی تہہ نظر نہ آئے، اس میں گاڑی مت لے جائیں۔",
    moveCarTitle: "اپنی گاڑی ابھی ہٹائیں",
    moveCarBody:
      "اندازے کے مطابق {place} میں پانی {depth} سینٹی میٹر ہے۔ اوپر سڑک ڈوبنے سے بہت پہلے بیسمنٹ ریمپ سے بھر جاتی ہے — ابھی موقع ہے، گاڑی ہٹا لیں۔",
    placeTitle: "{place} خطرے میں ہے",
    placeBody: "اندازے کے مطابق پانی {depth} سینٹی میٹر ہے۔",
    riverWarningTitle: "جمنا انتباہی سطح سے اوپر",
    riverDangerTitle: "جمنا خطرے کی سطح سے اوپر",
    riverBody:
      "{river} {level} میٹر پر — {status}۔ خطرے کی سطح {danger} میٹر ہے۔ سیلابی علاقہ چھوڑ دیں۔",
  },

  dashboard: {
    tabToday: "آج",
    tabMap: "نقشہ",
    tabJourney: "سفر",
    tabArea: "میرا علاقہ",
    goodMorning: "صبح بخیر",
    goodAfternoon: "دوپہر بخیر",
    goodEvening: "شام بخیر",
    goodNight: "شام بخیر",
    qSafeToTravel: "کیا نکلنا محفوظ ہے؟",
    qMyArea: "کیا میرا علاقہ خطرے میں ہے؟",
    qMyCar: "کیا گاڑی ہٹا لوں؟",
    qRoute: "کون سا راستہ سب سے محفوظ ہے؟",
    qDisruptions: "آگے کیا توقع رکھوں؟",
    answerYes: "ہاں — آپ جا سکتے ہیں۔",
    answerCaution: "ابھی نکل جائیں، اور سنبھل کر۔",
    answerWait: "ابھی نہیں۔ رک جائیں۔",
    answerNo: "نہیں۔ گاڑی لے کر مت نکلیں۔",
    areaClear: "آپ کا علاقہ صاف ہے۔",
    areaWatch: "آپ کے قریب پانی جمع ہو رہا ہے۔",
    areaFlooding: "آپ کے علاقے میں پانی بھر رہا ہے۔",
    carSafe: "گاڑی جہاں کھڑی ہے، ٹھیک ہے۔",
    carMove: "اپنی گاڑی ابھی ہٹائیں۔",
    noJourneyYet: "سفر کا منصوبہ بنائیں تاکہ وہاں کا سب سے محفوظ راستہ دکھایا جا سکے۔",
    planJourney: "محفوظ سفر کا منصوبہ بنائیں",
    checkArea: "میرا علاقہ دیکھیں",
    reportSomething: "کچھ رپورٹ کریں",
    viewAlerts: "الرٹ دیکھیں",
    nothingExpected: "اگلے چند گھنٹوں میں کوئی رکاوٹ متوقع نہیں۔",
    yourPlaces: "آپ کے مقامات",
    home: "گھر",
    work: "روز کا سفر",
    editSetup: "اپنی تفصیلات بدلیں",
    lastUpdated: "اپ ڈیٹ",
  },

  hero: {
    eyebrow: "دہلی NCR · ورژن 1",
    titleLine1: "دہلی میں سیلاب چار مختلف طریقوں سے آتا ہے۔",
    titleLine2: "موسم کی ایپ ان میں سے صرف ایک بتاتی ہے۔",
    lede:
      "दिशाAI بتاتا ہے کہ شہر میں کہاں پانی جمع ہوگا، کتنا گہرا اور کب — پھر ایک مخصوص شخص کو، اس کی مخصوص گاڑی کے حساب سے بتاتا ہے کہ کرنا کیا ہے۔",
    secondaryCta: "کیسے کام کرتا ہے",
    noSignup: "کوئی سائن اپ نہیں۔ براہِ راست کھلے ڈیٹا پر چلتا ہے۔",
  },

  app: {
    journey: "سفر",
    from: "کہاں سے",
    to: "کہاں تک",
    leavingIn: "روانگی میں",
    threeHours: "3 گھنٹے",
    vehicle: "گاڑی",
    model: "ماڈل",
    year: "سال",
    tyres: "ٹائر",
    context: "سیاق",
    purpose: "مقصد",
    urgency: "عجلت",
    canWorkRemotely: "یہ کام گھر سے ہو سکتا ہے",
    plan: "سفر کی منصوبہ بندی کریں",
    planning: "منصوبہ بن رہا ہے…",
    thisJourney: "یہ سفر",
    cityConditions: "شہر کی صورتحال",
    recommendedAction: "تجویز کردہ اقدام",
    alsoConsidered: "دیگر متبادل بھی دیکھے گئے",
    otherOptions: "دوسرے متبادل",
    estimatedJourney: "متوقع سفر",
    actNow: "ابھی کریں",
    controlRooms: "سیلاب کنٹرول روم",
    ifYouAreStuck: "اگر آپ پھنس جائیں",
    clearanceHint:
      "صرف گراؤنڈ کلیئرنس سے طے نہیں ہوتا کہ آپ پانی پار کر سکیں گے — گاڑی کی ساخت اکثر زیادہ اہم ہوتی ہے۔",
    tabPlan: "منصوبہ",
    tabMap: "نقشہ",
    tabBrief: "خلاصہ",
  },

  stats: {
    roadsAtRisk: "خطرے میں سڑکیں",
    impassable: "ناقابلِ گزر",
    deepest: "سب سے گہرا",
    peopleExposed: "متاثرہ لوگ",
    underpassesAtRisk: "خطرے میں انڈر پاس",
    hotspotsActive: "فعال ہاٹ اسپاٹ",
    floodRisk: "سیلاب کا خطرہ",
    trunkDrains: "بڑے نالے اور جمنا",
    highestRiskRoads: "سب سے زیادہ خطرے والی سڑکیں",
    worstFirst: "سب سے خراب پہلے",
    rightNow: "اس وقت",
  },

  risk: {
    safe: "محفوظ",
    low: "کم",
    moderate: "درمیانہ",
    high: "زیادہ",
    severe: "شدید",
    critical: "انتہائی شدید",
  },

  confidence: {
    label: "اعتماد",
    high: "زیادہ",
    moderate: "درمیانہ",
    low: "کم",
  },

  decision: {
    leave_now: "ابھی نکلیں",
    delay_departure: "روانگی مؤخر کریں",
    use_metro: "میٹرو سے جائیں",
    use_cab: "کیب لیں",
    work_remotely: "گھر سے کام کریں",
    cancel_trip: "سفر منسوخ کریں",
    move_vehicle: "اپنی گاڑی ابھی ہٹائیں",
    shelter_in_place: "جہاں ہیں وہیں رکیں",
  },

  purpose: {
    commute: "روز کی آمد و رفت",
    medical: "طبی",
    school_run: "بچوں کو اسکول",
    work_critical: "ضروری کام",
    airport: "ہوائی اڈہ",
    leisure: "تفریح",
    delivery: "ڈیلیوری یا مال برداری",
  },

  urgency: {
    flexible: "لچکدار — انتظار ہو سکتا ہے",
    deadline: "وقت کی پابندی ہے",
    leave_now: "انتظار نہیں کر سکتے",
  },

  tyre: {
    standard: "عام",
    wet_grip: "گیلی گرفت",
    all_terrain: "آل ٹیرین",
    worn: "گھسے ہوئے",
  },

  vehicleCard: {
    title: "گاڑی کی برداشت",
    safe: "محفوظ",
    borderline: "حد پر",
    unsafe: "غیر محفوظ",
    safeBlurb: "یہ گاڑی اسے آسانی سے پار کر لے گی۔",
    borderlineBlurb: "پار ہو سکتی ہے، مگر کوئی گنجائش نہیں بچتی۔",
    unsafeBlurb: "یہ گاڑی اتنا پانی پار نہیں کر سکتی۔",
    waterOnRoute: "راستے میں پانی",
    safeWadingDepth: "محفوظ گہرائی",
    wadingLimit: "محفوظ حد",
    airIntake: "ایئر انٹیک",
  },

  route: {
    fastest: "تیز ترین راستہ",
    recommended: "تجویز کردہ محفوظ راستہ",
    leastDangerous: "سب سے کم خطرناک راستہ",
    whatMapsGives: "جو کوئی نقشہ ایپ بتائے گی",
    whatWeRecommend: "جو दिशाAI تجویز کرتا ہے",
    bestAvailable: "بہترین دستیاب — پھر بھی محفوظ نہیں",
    extraTime: "اضافی وقت",
    riskReduction: "خطرے میں کمی",
    lessWater: "کم پانی",
    underpassesAvoided: "بچائے گئے انڈر پاس",
    safeRouteScore: "محفوظ راستہ اسکور",
    peakRisk: "زیادہ سے زیادہ خطرہ",
    underpasses: "انڈر پاس",
    segmentByStep: "حصہ بہ حصہ",
    roads: "سڑکیں",
    underpass: "انڈر پاس",
    impassable: "ناقابلِ گزر",
    sameRouteSafe:
      "دونوں تلاشوں نے ایک ہی سڑکیں چنیں۔ ابھی کوئی زیادہ محفوظ متبادل نہیں جس کے لیے وقت دینا پڑے — یہ اچھی خبر ہے۔",
    sameRouteUnsafe:
      "دونوں تلاشوں نے ایک ہی سڑکیں چنیں کیونکہ باقی سب اس سے بدتر ہیں۔ راستہ بدلنے سے یہ سفر ٹھیک نہیں ہوگا۔",
    noRoute: "ان دونوں مقامات کے درمیان کوئی راستہ نہیں بنایا جا سکا۔",
  },

  timeline: {
    title: "پیشگوئی کی ٹائم لائن",
    next12h: "اگلے 12 گھنٹے",
    recommendedDeparture: "تجویز کردہ روانگی",
    windowCloses: "وقت ختم ہو رہا ہے",
    noSafeWindow: "کوئی محفوظ وقت نہیں",
    empty: "اگلے بارہ گھنٹوں میں کچھ ہونے کی پیشگوئی نہیں ہے۔",
  },

  explain: {
    title: "یہ مشورہ کیوں؟",
    predictionTitle: "یہ پیشگوئی کیوں؟",
    eyebrow: "قابلِ وضاحت AI",
    factor: "وجہ",
    factors: "وجوہات",
    basedOn: "پیشگوئی ان پر مبنی ہے",
    transparency: "شفافیت",
    notConnected: "ترجیحی ماخذ منسلک نہیں ہیں",
    agents: "اسے بنانے والے ایجنٹ",
    architecture: "AI ساخت",
  },

  report: {
    eyebrow: "براہِ راست سیکھنا",
    title: "یہاں کی صورتحال بتائیں",
    flooded_road: "پانی بھرا ہے",
    road_clear: "صاف ہے",
    drain_blockage: "نالہ بند ہے",
    vehicle_stalled: "گاڑی بند ہو گئی",
    depthPlaceholder: "گہرائی سینٹی میٹر میں (اختیاری)",
    submit: "رپورٹ بھیجیں",
    sending: "بھیجا جا رہا ہے…",
    thanks:
      "شکریہ — اس سڑک کی پیشگوئی اپ ڈیٹ کر دی گئی ہے اور آپ کی رپورٹ پیشگوئی کے مقابلے میں درج کر لی گئی ہے۔",
    none:
      "اس سڑک سے ابھی کوئی رپورٹ نہیں۔ رپورٹ سے پیشگوئی فوراً بدلتی ہے اور وقت کے ساتھ اس کا اثر کم ہوتا ہے۔",
  },

  segment: {
    floodProbability: "سیلاب کا امکان",
    peakDepth: "زیادہ سے زیادہ گہرائی",
    timeToFlood: "پانی بھرنے میں وقت",
    recovery: "پانی اترنے میں",
    modelledDepth: "متوقع پانی کی گہرائی",
    failureModes: "ناکامی کے طریقے",
    whatGoesWrong: "یہاں کیا غلط ہونے کا اندیشہ ہے",
    infrastructure: "بنیادی ڈھانچہ",
    whatIsHere: "یہاں کیا ہے",
    elevation: "بلندی",
    slope: "ڈھلان",
    drainCapacity: "نالے کی گنجائش",
    floodplainExposure: "سیلابی علاقے میں حیثیت",
    basementParking: "بیسمنٹ پارکنگ",
    pumpStations: "پمپنگ اسٹیشن",
    floodHistory: "سیلاب کی تاریخ",
    recordedEvents: "درج واقعات",
    register: "آب زدگی رجسٹر",
    standingWater: "8 سینٹی میٹر — پانی جمع",
    impassableAt: "30 سینٹی میٹر — ناقابلِ گزر",
    peak: "زیادہ سے زیادہ",
    shareBody: "{name} — ابھی اندازاً {depth} سینٹی میٹر پانی۔ दिशाAI:",
  },

  gov: {
    operations: "آپریشنز",
    floodControl: "سیلاب کنٹرول",
    deployment: "تعیناتی",
    highRiskRoads: "زیادہ خطرے والی سڑکیں",
    drainFailures: "نالہ ناکامی",
    hotspots: "ہاٹ اسپاٹ",
    citizenReports: "شہریوں کی رپورٹیں",
    pumps: "پمپ",
    teams: "ٹیمیں",
    pumpsToDeploy: "تعینات کیے جانے والے پمپ",
    teamsToDeploy: "تعینات کی جانے والی ٹیمیں",
    basements: "بیسمنٹ",
    gaugeReadings: "جمنا کی سطح",
    warning: "انتباہ",
    danger: "خطرہ",
    accessCode: "رسائی کوڈ",
    signIn: "سائن ان",
    checking: "جانچ ہو رہی ہے…",
    codeNotRecognised: "رسائی کوڈ پہچانا نہیں گیا۔",
    dashboardTitle: "سیلاب آپریشنز ڈیش بورڈ",
    dashboardBlurb:
      "اس منظر میں وسائل کی تعیناتی اور بنیادی ڈھانچے کی ناکامی کی پیشگوئیاں ہیں۔ یہ عوامی ایپ کا حصہ نہیں ہے۔",
  },
};
