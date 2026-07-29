/**
 * Languages FloodPilot speaks.
 *
 * This list is Delhi's actual linguistic landscape, not a generic i18n starter
 * set. The city's flood risk falls hardest on exactly the populations least
 * likely to be reading English — the migrant communities in the trans-Yamuna
 * colonies and the low-lying settlements along the floodplain — so a flood
 * warning that only exists in English is a warning that misses the people who
 * most need it.
 *
 * `role` records why each language is here, because that reasoning should
 * survive contact with whoever maintains this next.
 */

export const LOCALES = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    script: "Latin",
    role: "Business and media standard",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    dir: "ltr",
    script: "Devanagari",
    role: "Dominant official language",
    fontFamily: '"Noto Sans Devanagari", "Inter", ui-sans-serif, sans-serif',
  },
  pa: {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    dir: "ltr",
    script: "Gurmukhi",
    role: "Large cultural influence",
    fontFamily: '"Noto Sans Gurmukhi", "Inter", ui-sans-serif, sans-serif',
  },
  ur: {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    dir: "rtl",
    script: "Nastaliq",
    role: "Strong historical presence",
    fontFamily: '"Noto Nastaliq Urdu", "Noto Naskh Arabic", serif',
  },
  bn: {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    dir: "ltr",
    script: "Bengali",
    role: "Key neighbourhood pockets",
    fontFamily: '"Noto Sans Bengali", "Inter", ui-sans-serif, sans-serif',
  },
  bho: {
    code: "bho",
    name: "Bhojpuri",
    nativeName: "भोजपुरी",
    dir: "ltr",
    script: "Devanagari",
    role: "Growing migrant community",
    fontFamily: '"Noto Sans Devanagari", "Inter", ui-sans-serif, sans-serif',
  },
  mai: {
    code: "mai",
    name: "Maithili",
    nativeName: "मैथिली",
    dir: "ltr",
    script: "Devanagari",
    role: "Significant regional dialect",
    fontFamily: '"Noto Sans Devanagari", "Inter", ui-sans-serif, sans-serif',
  },
} as const;

export type LocaleCode = keyof typeof LOCALES;

export type LocaleMeta = (typeof LOCALES)[LocaleCode];

export const LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];

/**
 * Display order.
 *
 * Hindi first because it is the language most Delhi residents actually read,
 * then English, then the rest by community size. Alphabetical order would be
 * tidier and less useful.
 */
export const LOCALE_ORDER: LocaleCode[] = [
  "hi",
  "en",
  "pa",
  "ur",
  "bn",
  "bho",
  "mai",
];

export const DEFAULT_LOCALE: LocaleCode = "en";

export function isLocale(value: string | null | undefined): value is LocaleCode {
  return !!value && (LOCALE_CODES as string[]).includes(value);
}

export function resolveLocale(value: string | null | undefined): LocaleCode {
  if (isLocale(value)) return value;

  // Accept regional tags such as "hi-IN" or "pa-Guru-IN".
  const base = value?.split("-")[0]?.toLowerCase();
  return isLocale(base) ? base : DEFAULT_LOCALE;
}

/** Best match from an Accept-Language header or navigator.languages. */
export function negotiateLocale(preferred: readonly string[]): LocaleCode {
  for (const candidate of preferred) {
    const base = candidate.split("-")[0]?.toLowerCase();
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
