import type { Messages } from "./en";

/**
 * Bhojpuri — Delhi's growing migrant community.
 *
 * This is the locale that matters most for the outcome the product exists to
 * change. Bhojpuri speakers are concentrated in the trans-Yamuna colonies, the
 * Yamuna Pushta settlements and the informal housing along the floodplain —
 * which is to say, precisely the places that go under first and stay under
 * longest.
 *
 * Written in genuine Bhojpuri rather than Devanagari-transliterated Hindi:
 * "बा" for है, "रउआ" for आप, "काहे" for क्यों, "बतावेला" for बताता है.
 */
export const bho: Messages = {
  meta: {
    languageName: "भोजपुरी",
    chooseLanguage: "भाषा चुनीं",
    translationNote:
      "इंटरफेस आ सुरक्षा के सलाह अनुवाद कइल गइल बा। मॉडल के विस्तार से बतावल फिलहाल खाली अंग्रेजी में बा।",
  },

  common: {
    launchApp: "नक्शा खोलीं",
    close: "बंद करीं",
    why: "काहे?",
    loading: "लोड होत बा…",
    live: "लाइव डेटा",
    simulated: "बनावल परिस्थिति",
    restricted: "रोक लागल",
    signOut: "साइन आउट",
    source: "स्रोत",
    now: "अबहीं",
    min: "मिनट",
    hr: "घंटा",
    cm: "सेमी",
    km: "किमी",
    people: "लोग",
    back: "पाछे",
    continue: "आगे बढ़ीं",
    skip: "छोड़ि दीं",
    yes: "हँ",
    no: "ना",
    search: "खोजीं",
    change: "बदलीं",
    simple: "सोझ",
    detailed: "विस्तार से",
    showWorking: "हिसाब देखाईं",
    hideWorking: "हिसाब छिपाईं",
    offline: "ऑफलाइन — एह फोन में सहेजल पहिलका हालत देखावल जात बा।",
  },

  nav: {
    howItWorks: "कइसे काम करेला",
    features: "खासियत",
    architecture: "बनावट",
    government: "सरकार",
    roadmap: "आगे के योजना",
    about: "परिचय",
  },

  landing: {
    eyebrow: "दिल्ली NCR",
    title: "जानीं, सबसे सुरक्षित रस्ता कवन बा।",
    lede:
      "एगो अकिलमंद नक्शा जवन दिल्ली के बरखा, नाला, ऊँचाई आ सड़क पढ़ेला — फेर बतावेला कि रउआ के का करे के बा।",
    primaryCta: "नक्शा खोलीं",
    secondaryCta: "ई का बा",
    cityRightNow: "दिल्ली अबहीं",
    roadsWatched: "नजर में सड़क",
    setupTime: "सेट होखे में करीब 40 सेकंड। कवनो साइन-अप ना।",
    resume: "जहवाँ छोड़ले रहीं उहँवें से आगे बढ़ीं",
    meaningNote:
      "दिशा माने रस्ता — खाली कवना ओर ना, बलुक सही ओर।",
  },

  onboarding: {
    welcomeTitle: "जानीं, सबसे सुरक्षित रस्ता कवन बा।",
    welcomeBody:
      "थोड़े सवाल के जवाब दीं आ ई रउआ के आपन नक्शा बन जाई — रउआ के इलाका, रउआ के सड़क, रउआ के गाड़ी।",
    welcomeCta: "शुरू करीं",
    welcomeNote: "करीब 40 सेकंड। रउआ के जवाब एहि फोन में रही।",

    skipSetup: "सेटअप छोड़ि दीं",
    stepOf: "{total} में से {n} चरण",

    searchPlaceholder: "इलाका खोजीं…",
    noMatches: "एह नाँव के कवनो इलाका ना मिलल।",
    popular: "अकसर चुनल जाए वाला",
    allAreas: "सगरी जगह",
    optionalNote: "मरजी के — रउआ एकरा छोड़ि सकेनी।",

    qHome: "रउआ कहवाँ रहेनी?",
    hHome: "जेहसे नक्शा पूरा शहर ना, रउआ के मोहल्ला पर नजर राखे।",
    qWork: "रउआ अकसर कहवाँ जाएनी?",
    hWork: "दफ्तर, कॉलेज, जहवाँ रोज-रोज जाएनी।",
    qCommute: "उहाँ आमतौर पर कइसे जाएनी?",
    hCommute: "पानी हर गाड़ी के अलग-अलग गहिराई पर रोक देला।",
    qVehicle: "रउआ कवन गाड़ी चलावेनी?",
    hVehicle:
      "रउआ के असल में रोकेला एयर इनटेक, ग्राउंड क्लीयरेंस ना — एहसे असली गाड़ी बतावल जरूरी बा।",
    qBasement: "रउआ गाड़ी बेसमेंट में लगावेनी?",
    hBasement:
      "ऊपर के सड़क डूबे से बहुत पहिलहीं बेसमेंट रैंप से भरे लागेला। अगर हँ, त रउआ के गाड़ी पहिलहीं हटावे के कहल जाई।",
    qFrequent: "अउरी कहीं अकसर जाएनी?",
    hFrequent: "स्कूल, माई-बाबूजी, कवनो क्लीनिक। एह सब पर भी नजर रही।",
    qProactive: "पानी भरे से पहिलहीं चेतावनी चाहीं?",
    hProactive:
      "रउआ के तबे बतावल जाई जब निकले के मौका बंद होखे लागी — सड़क डूब गइला के बाद ना।",
    qEmergency: "आ आपात के चेतावनी?",
    hEmergency:
      "जमुना नदी के चेतावनी, इलाका खाली करे के सूचना आ कंट्रोल रूम के सलाह।",

    buildingTitle: "रउआ के नक्शा बनत बा",
    buildingBody:
      "बरखा, नाला, ऊँचाई आ रउआ के जगहन के बीच के हर सड़क पढ़ल जात बा।",
    finish: "हमार डैशबोर्ड खोलीं",

    placeIndia: "भारत",
    placeCity: "दिल्ली NCR",
  },

  commute: {
    car: "कार",
    two_wheeler: "दुपहिया",
    metro: "मेट्रो",
    bus: "बस",
    auto: "ऑटो या कैब",
    walk: "पैदल",
  },

  alerts: {
    title: "चेतावनी",
    none: "अबहीं रउआ के धियान देवे लायक कुछ नइखे।",
    enableNotifications: "ऐप बंद रहे तबहूँ हमरा के बताईं",
    notificationsOn: "ई ऐप बंद रही तबहूँ रउआ के बतावल जाई।",
    notificationsBlocked:
      "रउआ के ब्राउजर सेटिंग में एह साइट खातिर सूचना रोकल बा।",

    departureTitle: "निकले के मौका बंद होत बा",
    departureBody:
      "{clock} ले निकल जाईं। ओकरा बाद ई यात्रा सुरक्षित ना रह जाई — अबहीं से करीब {min} मिनट बा।",
    noWindowTitle: "आजु निकले के कवनो सुरक्षित समय नइखे",
    noWindowBody:
      "अगिला बारह घंटा में कवनो अइसन समय नइखे जवना में ई यात्रा सुरक्षित रहे। मेट्रो से जाईं, ना त मत जाईं।",
    routeTitle: "रउआ के रस्ता बंद बा",
    routeBody:
      "रउआ के सबसे सुरक्षित रस्ता के {count} सड़क पर एतना गहिर पानी बा कि ई गाड़ी पार ना कर सकी।",
    homeRisingTitle: "रउआ के लगे पानी बढ़त बा",
    homeRisingBody: "{place} में अनुमान {depth} सेमी बा आ अबहीं बढ़ते जात बा।",
    homeFloodingTitle: "रउआ के इलाका में पानी भरत बा",
    homeFloodingBody:
      "{place} में अनुमान {depth} सेमी बा। जवना जमल पानी के तल ना लउके, ओहमें गाड़ी मत ले जाईं।",
    moveCarTitle: "आपन गाड़ी अबहीं हटाईं",
    moveCarBody:
      "{place} में अनुमान {depth} सेमी बा। ऊपर के सड़क डूबे से बहुत पहिलहीं बेसमेंट रैंप भर जाला — जब ले मौका बा तब ले हटा लीं।",
    placeTitle: "{place} खतरा में बा",
    placeBody: "अनुमान {depth} सेमी बा।",
    riverWarningTitle: "जमुना चेतावनी स्तर से ऊपर",
    riverDangerTitle: "जमुना खतरा स्तर से ऊपर",
    riverBody:
      "{river} {level} मीटर पर बा — {status}। खतरा स्तर {danger} मीटर बा। बाढ़ वाला इलाका छोड़ि दीं।",
  },

  dashboard: {
    tabToday: "आज",
    tabMap: "नक्शा",
    tabJourney: "यात्रा",
    tabArea: "हमार इलाका",
    goodMorning: "नीक भोर",
    goodAfternoon: "नीक दुपहरिया",
    goodEvening: "नीक साँझ",
    goodNight: "नीक साँझ",
    qSafeToTravel: "बाहर निकलल सुरक्षित बा?",
    qMyArea: "हमार इलाका खतरा में बा?",
    qMyCar: "गाड़ी हटावे के पड़ी का?",
    qRoute: "कवन रस्ता सबसे सुरक्षित बा?",
    qDisruptions: "आगे का होखे वाला बा?",
    answerYes: "हँ — रउआ जा सकेनी।",
    answerCaution: "अबहीं निकल जाईं, आ धियान से जाईं।",
    answerWait: "अबहीं ना। रुकीं।",
    answerNo: "ना। एहमें गाड़ी मत ले जाईं।",
    areaClear: "रउआ के इलाका साफ बा।",
    areaWatch: "रउआ के लगे पानी बढ़त बा।",
    areaFlooding: "रउआ के इलाका में पानी भरत बा।",
    carSafe: "गाड़ी जहवाँ बा उहँवें ठीक बा।",
    carMove: "आपन गाड़ी अबहीं हटाईं।",
    noJourneyYet: "यात्रा के योजना बनाईं, तब सबसे सुरक्षित रस्ता लउकी।",
    planJourney: "सुरक्षित यात्रा के योजना बनाईं",
    checkArea: "हमार इलाका देखीं",
    reportSomething: "कुछ बताईं",
    viewAlerts: "चेतावनी देखीं",
    nothingExpected: "अगिला कुछ घंटा में कवनो दिक्कत के अनुमान नइखे।",
    yourPlaces: "रउआ के जगह",
    home: "घर",
    work: "रोज के यात्रा",
    editSetup: "हमार जानकारी बदलीं",
    lastUpdated: "अपडेट भइल",
  },

  hero: {
    eyebrow: "दिल्ली NCR · संस्करण 1",
    titleLine1: "दिल्ली में बाढ़ चार अलग-अलग तरीका से आवेला।",
    titleLine2: "मौसम के ऐप ओहमें से खाली एगो बतावेला।",
    lede:
      "दिशाAI बतावेला कि शहर में कहवाँ पानी भरी, केतना गहिर आ कब — फेर एगो खास आदमी के, ओकर खास गाड़ी के हिसाब से बतावेला कि का करे के बा।",
    secondaryCta: "कइसे काम करेला",
    noSignup: "कवनो साइन-अप ना। लाइव खुलल डेटा पर चलेला।",
  },

  app: {
    journey: "यात्रा",
    from: "कहवाँ से",
    to: "कहवाँ ले",
    leavingIn: "निकले में",
    threeHours: "3 घंटा",
    vehicle: "गाड़ी",
    model: "मॉडल",
    year: "साल",
    tyres: "टायर",
    context: "संदर्भ",
    purpose: "काहे जाईं",
    urgency: "जरूरत",
    canWorkRemotely: "ई काम घरे से हो सकेला",
    plan: "यात्रा के योजना बनाईं",
    planning: "योजना बनत बा…",
    thisJourney: "ई यात्रा",
    cityConditions: "शहर के हालत",
    recommendedAction: "सलाह दिहल काम",
    alsoConsidered: "दोसर विकल्प भी देखल गइल",
    otherOptions: "दोसर विकल्प",
    estimatedJourney: "अनुमानित यात्रा",
    actNow: "अबहीं करीं",
    controlRooms: "बाढ़ नियंत्रण कक्ष",
    ifYouAreStuck: "अगर रउआ फँस जाईं",
    clearanceHint:
      "खाली ग्राउंड क्लीयरेंस से ना तय होखे कि रउआ पानी पार कर पाईब — गाड़ी के बनावट अक्सर जादे मायने रखेला।",
    tabPlan: "योजना",
    tabMap: "नक्शा",
    tabBrief: "सार",
  },

  stats: {
    roadsAtRisk: "खतरा में सड़क",
    impassable: "ना चले लायक",
    deepest: "सबसे गहिर",
    peopleExposed: "प्रभावित लोग",
    underpassesAtRisk: "खतरा में अंडरपास",
    hotspotsActive: "चालू हॉटस्पॉट",
    floodRisk: "बाढ़ के खतरा",
    trunkDrains: "बड़ नाला आ जमुना",
    highestRiskRoads: "सबसे जादे खतरा वाली सड़क",
    worstFirst: "सबसे खराब पहिले",
    rightNow: "अबहीं",
  },

  risk: {
    safe: "सुरक्षित",
    low: "कम",
    moderate: "मध्यम",
    high: "जादे",
    severe: "गंभीर",
    critical: "बहुते गंभीर",
  },

  confidence: {
    label: "भरोसा",
    high: "जादे",
    moderate: "मध्यम",
    low: "कम",
  },

  decision: {
    leave_now: "अबहीं निकलीं",
    delay_departure: "निकले में देर करीं",
    use_metro: "मेट्रो से जाईं",
    use_cab: "कैब लीं",
    work_remotely: "घरे से काम करीं",
    cancel_trip: "यात्रा रद्द करीं",
    move_vehicle: "आपन गाड़ी अबहीं हटाईं",
    shelter_in_place: "जहवाँ बानी उहँवें रुकीं",
  },

  purpose: {
    commute: "रोज के आवाजाही",
    medical: "इलाज",
    school_run: "बच्चा के स्कूल",
    work_critical: "जरूरी काम",
    airport: "हवाई अड्डा",
    leisure: "घूमे-फिरे",
    delivery: "डिलीवरी या ढुलाई",
  },

  urgency: {
    flexible: "लचीला — रुक सकेनी",
    deadline: "समय के बंधन बा",
    leave_now: "रुक ना सकेनी",
  },

  tyre: {
    standard: "सामान्य",
    wet_grip: "गीला पकड़",
    all_terrain: "ऑल-टेरेन",
    worn: "घिसल",
  },

  vehicleCard: {
    title: "गाड़ी के सहनशक्ति",
    safe: "सुरक्षित",
    borderline: "सीमा पर",
    unsafe: "असुरक्षित",
    safeBlurb: "ई गाड़ी एकरा आराम से पार कर लीही।",
    borderlineBlurb: "पार हो सकेला, बाकिर कवनो गुंजाइश ना बाँचे।",
    unsafeBlurb: "ई गाड़ी एतना पानी पार ना कर सकी।",
    waterOnRoute: "रस्ता में पानी",
    safeWadingDepth: "सुरक्षित गहिराई",
    wadingLimit: "सुरक्षित सीमा",
    airIntake: "एयर इनटेक",
  },

  route: {
    fastest: "सबसे तेज रस्ता",
    recommended: "सलाह दिहल सुरक्षित रस्ता",
    leastDangerous: "सबसे कम खतरनाक रस्ता",
    whatMapsGives: "जवन कवनो नक्शा ऐप बताई",
    whatWeRecommend: "जवन दिशाAI सलाह देला",
    bestAvailable: "सबसे नीक उपलब्ध — तबहूँ सुरक्षित ना",
    extraTime: "अउरी समय",
    riskReduction: "खतरा में कमी",
    lessWater: "कम पानी",
    underpassesAvoided: "बचल अंडरपास",
    safeRouteScore: "सुरक्षित रस्ता स्कोर",
    peakRisk: "सबसे जादे खतरा",
    underpasses: "अंडरपास",
    segmentByStep: "हिस्सा-दर-हिस्सा",
    roads: "सड़क",
    underpass: "अंडरपास",
    impassable: "ना चले लायक",
    sameRouteSafe:
      "दुनू खोज एके सड़क चुनलस। अबहीं कवनो दोसर सुरक्षित रस्ता नइखे जेकरा खातिर समय देवे के पड़े — ई नीक बात बा।",
    sameRouteUnsafe:
      "दुनू खोज एके सड़क चुनलस काहे कि बाकी सब अउरी खराब बा। रस्ता बदले से ई यात्रा ठीक ना होई।",
    noRoute: "ई दुनू जगह के बीच कवनो रस्ता ना बन सकल।",
  },

  timeline: {
    title: "अनुमान के समयरेखा",
    next12h: "अगिला 12 घंटा",
    recommendedDeparture: "सलाह दिहल निकले के समय",
    windowCloses: "समय खतम होत बा",
    noSafeWindow: "कवनो सुरक्षित समय नइखे",
    empty: "अगिला बारह घंटा में कुछ होखे के अनुमान नइखे।",
  },

  explain: {
    title: "ई सलाह काहे?",
    predictionTitle: "ई अनुमान काहे?",
    eyebrow: "समझावे वाला AI",
    factor: "कारण",
    factors: "कारण",
    basedOn: "अनुमान एह पर आधारित बा",
    transparency: "पारदर्शिता",
    notConnected: "पसंदीदा स्रोत जुड़ल नइखे",
    agents: "एकरा बनावे वाला एजेंट",
    architecture: "AI बनावट",
  },

  report: {
    eyebrow: "लाइव सीखल",
    title: "इहाँ के हालत बताईं",
    flooded_road: "पानी भरल बा",
    road_clear: "साफ बा",
    drain_blockage: "नाला जाम बा",
    vehicle_stalled: "गाड़ी बंद हो गइल",
    depthPlaceholder: "गहिराई सेमी में (मरजी के)",
    submit: "रिपोर्ट भेजीं",
    sending: "भेजल जात बा…",
    thanks:
      "धन्यवाद — एह सड़क के अनुमान अपडेट हो गइल आ रउआ के रिपोर्ट अनुमान के मुकाबले दर्ज हो गइल।",
    none:
      "एह सड़क से अबहीं कवनो रिपोर्ट नइखे। रिपोर्ट से अनुमान तुरंते बदलेला आ समय के साथे ओकर असर घटेला।",
  },

  segment: {
    floodProbability: "बाढ़ के संभावना",
    peakDepth: "सबसे जादे गहिराई",
    timeToFlood: "पानी भरे में समय",
    recovery: "पानी उतरे में",
    modelledDepth: "अनुमानित पानी के गहिराई",
    failureModes: "बिगड़े के तरीका",
    whatGoesWrong: "इहाँ का गलत होखे के डर बा",
    infrastructure: "बुनियादी ढाँचा",
    whatIsHere: "इहाँ का बा",
    elevation: "ऊँचाई",
    slope: "ढलान",
    drainCapacity: "नाला के क्षमता",
    floodplainExposure: "बाढ़ इलाका में स्थिति",
    basementParking: "बेसमेंट पार्किंग",
    pumpStations: "पंपिंग स्टेशन",
    floodHistory: "बाढ़ के इतिहास",
    recordedEvents: "दर्ज घटना",
    register: "जलभराव रजिस्टर",
    standingWater: "8 सेमी — पानी जमल",
    impassableAt: "30 सेमी — ना चले लायक",
    peak: "सबसे जादे",
  },

  gov: {
    operations: "संचालन",
    floodControl: "बाढ़ नियंत्रण",
    deployment: "तैनाती",
    highRiskRoads: "जादे खतरा वाली सड़क",
    drainFailures: "नाला के बिगड़ल",
    hotspots: "हॉटस्पॉट",
    citizenReports: "नागरिक रिपोर्ट",
    pumps: "पंप",
    teams: "टीम",
    pumpsToDeploy: "तैनात करे लायक पंप",
    teamsToDeploy: "तैनात करे लायक टीम",
    basements: "बेसमेंट",
    gaugeReadings: "जमुना के जलस्तर",
    warning: "चेतावनी",
    danger: "खतरा",
    accessCode: "एक्सेस कोड",
    signIn: "साइन इन",
    checking: "जाँच होत बा…",
    codeNotRecognised: "एक्सेस कोड पहिचानल ना गइल।",
    dashboardTitle: "बाढ़ संचालन डैशबोर्ड",
    dashboardBlurb:
      "एह में संसाधन के तैनाती आ बुनियादी ढाँचा के बिगड़े के अनुमान बा। ई सार्वजनिक ऐप के हिस्सा नइखे।",
  },
};
