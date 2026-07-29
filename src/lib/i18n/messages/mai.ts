import type { Messages } from "./en";

/**
 * Maithili — significant regional dialect in Delhi.
 *
 * Written in genuine Maithili rather than Devanagari-transliterated Hindi:
 * "अछि" for है, "अहाँ" for आप, "किएक" for क्यों, "कतय" for कहाँ,
 * "एखन" for अभी, "बतबैत अछि" for बताता है.
 */
export const mai: Messages = {
  meta: {
    languageName: "मैथिली",
    chooseLanguage: "भाषा चुनू",
    translationNote:
      "इंटरफेस आ सुरक्षा सलाह अनुवादित अछि। मॉडलक विस्तृत व्याख्या एखन खाली अंग्रेजीमे अछि।",
  },

  common: {
    launchApp: "एप खोलू",
    close: "बन्न करू",
    why: "किएक?",
    loading: "लोड भ' रहल अछि…",
    live: "लाइव डेटा",
    simulated: "बनाओल परिस्थिति",
    restricted: "प्रतिबंधित",
    signOut: "साइन आउट",
    source: "स्रोत",
    now: "एखन",
    min: "मिनट",
    hr: "घंटा",
    cm: "सेमी",
    km: "किमी",
    people: "लोक",
  },

  nav: {
    howItWorks: "कोना काज करैत अछि",
    features: "विशेषता",
    architecture: "बनावट",
    government: "सरकार",
    roadmap: "आगुक योजना",
  },

  hero: {
    eyebrow: "दिल्ली NCR · संस्करण 1",
    titleLine1: "दिल्लीमे बाढ़ि चारि अलग-अलग तरहेँ अबैत अछि।",
    titleLine2: "मौसमक एप ओहिमे सँ खाली एकटा बतबैत अछि।",
    lede:
      "FloodPilot बतबैत अछि जे शहरमे कतय पानि जमत, कतेक गहीँर आ कहिया — फेर एकटा खास लोकके, हुनकर खास गाड़ीक हिसाबेँ बतबैत अछि जे की करबाक अछि।",
    secondaryCta: "कोना काज करैत अछि",
    noSignup: "कोनो साइन-अप नै। लाइव खुजल डेटा पर चलैत अछि।",
  },

  app: {
    journey: "यात्रा",
    from: "कतय सँ",
    to: "कतय धरि",
    leavingIn: "निकलबामे",
    threeHours: "3 घंटा",
    vehicle: "गाड़ी",
    model: "मॉडल",
    year: "साल",
    tyres: "टायर",
    context: "संदर्भ",
    purpose: "उद्देश्य",
    urgency: "आवश्यकता",
    canWorkRemotely: "ई काज घर सँ भ' सकैत अछि",
    plan: "यात्राक योजना बनाउ",
    planning: "योजना बनि रहल अछि…",
    thisJourney: "ई यात्रा",
    cityConditions: "शहरक स्थिति",
    recommendedAction: "सुझाओल काज",
    alsoConsidered: "आन विकल्प सेहो देखल गेल",
    otherOptions: "आन विकल्प",
    estimatedJourney: "अनुमानित यात्रा",
    actNow: "एखने करू",
    controlRooms: "बाढ़ि नियंत्रण कक्ष",
    ifYouAreStuck: "जँ अहाँ फँसि जाइ",
    clearanceHint:
      "खाली ग्राउंड क्लीयरेंस सँ नै तय होइत अछि जे अहाँ पानि पार क' सकब — गाड़ीक बनावट प्राय: बेसी महत्वक अछि।",
    tabPlan: "योजना",
    tabMap: "नक्शा",
    tabBrief: "सार",
  },

  stats: {
    roadsAtRisk: "खतरामे सड़क",
    impassable: "नै चलबा योग्य",
    deepest: "सभ सँ गहीँर",
    peopleExposed: "प्रभावित लोक",
    underpassesAtRisk: "खतरामे अंडरपास",
    hotspotsActive: "सक्रिय हॉटस्पॉट",
    floodRisk: "बाढ़िक खतरा",
    trunkDrains: "पैघ नाला आ जमुना",
    highestRiskRoads: "सभ सँ बेसी खतराबला सड़क",
    worstFirst: "सभ सँ खराब पहिने",
    rightNow: "एखन",
  },

  risk: {
    safe: "सुरक्षित",
    low: "कम",
    moderate: "मध्यम",
    high: "बेसी",
    severe: "गंभीर",
    critical: "अति गंभीर",
  },

  confidence: {
    label: "विश्वास",
    high: "उच्च",
    moderate: "मध्यम",
    low: "कम",
  },

  decision: {
    leave_now: "एखने निकलू",
    delay_departure: "निकलबामे देरी करू",
    use_metro: "मेट्रो सँ जाउ",
    use_cab: "कैब लिअ'",
    work_remotely: "घर सँ काज करू",
    cancel_trip: "यात्रा रद्द करू",
    move_vehicle: "अपन गाड़ी एखने हटाउ",
    shelter_in_place: "जतय छी ओतहि रुकू",
  },

  purpose: {
    commute: "रोजक आबा-जाही",
    medical: "इलाज",
    school_run: "बच्चाके स्कूल",
    work_critical: "जरूरी काज",
    airport: "हवाई अड्डा",
    leisure: "घुमबा-फिरबा",
    delivery: "डिलीवरी वा ढुलाई",
  },

  urgency: {
    flexible: "लचीला — रुकि सकैत छी",
    deadline: "समय-सीमा अछि",
    leave_now: "रुकि नै सकैत छी",
  },

  tyre: {
    standard: "सामान्य",
    wet_grip: "भीजल पकड़",
    all_terrain: "ऑल-टेरेन",
    worn: "घिसल",
  },

  vehicleCard: {
    title: "गाड़ीक सहनशक्ति",
    safe: "सुरक्षित",
    borderline: "सीमा पर",
    unsafe: "असुरक्षित",
    safeBlurb: "ई गाड़ी एकरा आरामसँ पार क' लेत।",
    borderlineBlurb: "पार भ' सकैत अछि, मुदा कोनो गुंजाइश नै बचैत अछि।",
    unsafeBlurb: "ई गाड़ी एतेक पानि पार नै क' सकैत अछि।",
    waterOnRoute: "रस्तामे पानि",
    safeWadingDepth: "सुरक्षित गहराइ",
    wadingLimit: "सुरक्षित सीमा",
    airIntake: "एयर इनटेक",
  },

  route: {
    fastest: "सभ सँ तेज रस्ता",
    recommended: "सुझाओल सुरक्षित रस्ता",
    leastDangerous: "सभ सँ कम खतरनाक रस्ता",
    whatMapsGives: "जे कोनो नक्शा एप बतौत",
    whatWeRecommend: "जे FloodPilot सुझबैत अछि",
    bestAvailable: "सभ सँ नीक उपलब्ध — तइयो सुरक्षित नै",
    extraTime: "अतिरिक्त समय",
    riskReduction: "खतरामे कमी",
    lessWater: "कम पानि",
    underpassesAvoided: "बचाओल अंडरपास",
    safeRouteScore: "सुरक्षित रस्ता स्कोर",
    peakRisk: "अधिकतम खतरा",
    underpasses: "अंडरपास",
    segmentByStep: "हिस्सा-दर-हिस्सा",
    roads: "सड़क",
    underpass: "अंडरपास",
    impassable: "नै चलबा योग्य",
    sameRouteSafe:
      "दुनू खोज एकहि सड़क चुनलक। एखन कोनो आन सुरक्षित विकल्प नै अछि जकरा लेल समय देबय पड़य — ई नीक बात अछि।",
    sameRouteUnsafe:
      "दुनू खोज एकहि सड़क चुनलक कारण बाकी सभ आरो खराब अछि। रस्ता बदलला सँ ई यात्रा ठीक नै होएत।",
    noRoute: "ई दुनू ठामक बीच कोनो रस्ता नै बनि सकल।",
  },

  timeline: {
    title: "अनुमानक समयरेखा",
    next12h: "अगिला 12 घंटा",
    recommendedDeparture: "सुझाओल प्रस्थान समय",
    windowCloses: "समय समाप्त भ' रहल अछि",
    noSafeWindow: "कोनो सुरक्षित समय नै",
    empty: "अगिला बारह घंटामे किछु होएबाक अनुमान नै अछि।",
  },

  explain: {
    title: "ई सलाह किएक?",
    predictionTitle: "ई अनुमान किएक?",
    eyebrow: "व्याख्या योग्य AI",
    factor: "कारण",
    factors: "कारण",
    basedOn: "अनुमान एहि पर आधारित",
    transparency: "पारदर्शिता",
    notConnected: "पसंदीदा स्रोत जुड़ल नै अछि",
    agents: "एकरा बनयबाक एजेंट",
    architecture: "AI बनावट",
  },

  report: {
    eyebrow: "लाइव सीखब",
    title: "एतुका स्थिति बताउ",
    flooded_road: "पानि जमल अछि",
    road_clear: "साफ अछि",
    drain_blockage: "नाला बन्न अछि",
    vehicle_stalled: "गाड़ी बन्न भ' गेल",
    depthPlaceholder: "गहराइ सेमीमे (वैकल्पिक)",
    submit: "रिपोर्ट पठाउ",
    sending: "पठाओल जा रहल अछि…",
    thanks:
      "धन्यवाद — एहि सड़कक अनुमान अपडेट भ' गेल आ अहाँक रिपोर्ट अनुमानक तुलनामे दर्ज भ' गेल।",
    none:
      "एहि सड़क सँ एखन कोनो रिपोर्ट नै। रिपोर्ट सँ अनुमान तुरंत बदलैत अछि आ समयक संग ओकर असर घटैत अछि।",
  },

  segment: {
    floodProbability: "बाढ़िक संभावना",
    peakDepth: "अधिकतम गहराइ",
    timeToFlood: "पानि जमबामे समय",
    recovery: "पानि उतरबामे",
    modelledDepth: "अनुमानित पानिक गहराइ",
    failureModes: "बिगड़बाक तरीका",
    whatGoesWrong: "एतय की गलत होएबाक आशंका अछि",
    infrastructure: "बुनियादी ढाँचा",
    whatIsHere: "एतय की अछि",
    elevation: "उँचाइ",
    slope: "ढलान",
    drainCapacity: "नालाक क्षमता",
    floodplainExposure: "बाढ़ि क्षेत्रमे स्थिति",
    basementParking: "बेसमेंट पार्किंग",
    pumpStations: "पंपिंग स्टेशन",
    floodHistory: "बाढ़िक इतिहास",
    recordedEvents: "दर्ज घटना",
    register: "जलजमाव रजिस्टर",
    standingWater: "8 सेमी — पानि जमल",
    impassableAt: "30 सेमी — नै चलबा योग्य",
    peak: "अधिकतम",
  },

  gov: {
    operations: "संचालन",
    floodControl: "बाढ़ि नियंत्रण",
    deployment: "तैनाती",
    highRiskRoads: "बेसी खतराबला सड़क",
    drainFailures: "नाला विफलता",
    hotspots: "हॉटस्पॉट",
    citizenReports: "नागरिक रिपोर्ट",
    pumps: "पंप",
    teams: "टीम",
    pumpsToDeploy: "तैनात करबा योग्य पंप",
    teamsToDeploy: "तैनात करबा योग्य टीम",
    basements: "बेसमेंट",
    gaugeReadings: "जमुनाक जलस्तर",
    warning: "चेतावनी",
    danger: "खतरा",
    accessCode: "एक्सेस कोड",
    signIn: "साइन इन",
    checking: "जाँच भ' रहल अछि…",
    codeNotRecognised: "एक्सेस कोड पहिचानल नै गेल।",
    dashboardTitle: "बाढ़ि संचालन डैशबोर्ड",
    dashboardBlurb:
      "एहि दृश्यमे संसाधनक तैनाती आ बुनियादी ढाँचाक विफलताक अनुमान अछि। ई सार्वजनिक एपक हिस्सा नै अछि।",
  },
};
