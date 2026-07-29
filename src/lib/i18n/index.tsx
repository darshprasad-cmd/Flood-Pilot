"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  negotiateLocale,
  type LocaleCode,
  type LocaleMeta,
} from "./locales";
import { en, type Messages } from "./messages/en";
import { hi } from "./messages/hi";
import { pa } from "./messages/pa";
import { ur } from "./messages/ur";
import { bn } from "./messages/bn";
import { bho } from "./messages/bho";
import { mai } from "./messages/mai";

/**
 * Localisation.
 *
 * Client-side rather than routed (`/hi/app`, `/ur/app`), which is a real
 * trade-off worth naming: it keeps every existing route and API path working
 * unchanged, at the cost of the first server-rendered HTML always being
 * English. For an application people open, choose a language in, and then use —
 * as opposed to a page they land on from search — that is the right way round.
 *
 * The choice persists in localStorage and is applied to `<html lang>` and
 * `<html dir>`, so Urdu genuinely renders right-to-left rather than merely
 * displaying Arabic script left-to-right.
 */

const DICTIONARIES: Record<LocaleCode, Messages> = {
  en,
  hi,
  pa,
  ur,
  bn,
  bho,
  mai,
};

const STORAGE_KEY = "floodpilot.locale";

interface I18nValue {
  locale: LocaleCode;
  meta: LocaleMeta;
  t: Messages;
  setLocale: (locale: LocaleCode) => void;
  /** True until the stored preference has been read, to avoid a flash. */
  hydrated: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  // Resolve the preference on the client: stored choice first, then the
  // browser's own language list, then English.
  useEffect(() => {
    let resolved: LocaleCode = DEFAULT_LOCALE;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) {
        resolved = stored;
      } else if (navigator.languages?.length) {
        resolved = negotiateLocale(navigator.languages);
      }
    } catch {
      // Private browsing can throw on localStorage; English is a safe answer.
    }
    setLocaleState(resolved);
    setHydrated(true);
  }, []);

  // Keep the document in sync so CSS `:lang()` rules, font selection and RTL
  // all follow from one source of truth.
  useEffect(() => {
    const meta = LOCALES[locale];
    const root = document.documentElement;
    root.lang = locale;
    root.dir = meta.dir;
    root.style.setProperty("--font-locale", meta.fontFamily);
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply will not persist; the session still works.
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      meta: LOCALES[locale],
      t: DICTIONARIES[locale],
      setLocale,
      hydrated,
    }),
    [locale, setLocale, hydrated],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Rendering outside the provider is a programming error, but falling back to
    // English beats crashing a flood warning.
    return {
      locale: DEFAULT_LOCALE,
      meta: LOCALES[DEFAULT_LOCALE],
      t: en,
      setLocale: () => {},
      hydrated: true,
    };
  }
  return ctx;
}

/** Just the dictionary, for components that do not need the rest. */
export function useT(): Messages {
  return useI18n().t;
}

export { LOCALES, LOCALE_ORDER, DEFAULT_LOCALE } from "./locales";
export type { LocaleCode, LocaleMeta } from "./locales";
export type { Messages } from "./messages/en";
