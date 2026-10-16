"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { en } from "./en";
import { zhCN } from "./locales/zh-CN";
import { resolveLanguage } from "./locale";
import { translate } from "./translate";
import type { AppLanguage, Dictionary, ResolvedLanguage, TranslationValues } from "./types";

export type Translate = (key: string, values?: TranslationValues) => string;

interface I18nContextValue {
  /** The language setting, including `system`. */
  language: AppLanguage;
  /** The concrete language currently rendering. */
  resolvedLanguage: ResolvedLanguage;
  t: Translate;
}

const dictionaries: Record<ResolvedLanguage, Dictionary> = {
  en,
  "zh-CN": zhCN,
};

/**
 * Registers a resolved language's dictionary.
 *
 * Dictionaries are injected rather than imported statically so that adding a
 * language is a one-line change here, and so tests can install a stub.
 */
export function registerDictionary(language: ResolvedLanguage, dictionary: Dictionary): void {
  dictionaries[language] = dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  language = "system",
  children,
}: {
  language?: AppLanguage;
  children: ReactNode;
}) {
  const resolvedLanguage = resolveLanguage(language);

  const t = useCallback<Translate>(
    (key, values) => translate(dictionaries[resolvedLanguage], en, key, values),
    [resolvedLanguage],
  );

  // Keeps assistive tech, hyphenation, and font fallback correct for the active language.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = resolvedLanguage;
  }, [resolvedLanguage]);

  const value = useMemo<I18nContextValue>(
    () => ({ language, resolvedLanguage, t }),
    [language, resolvedLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Returns the translator. Falls back to English when used outside a provider,
 * mirroring how `useIcons` degrades outside `IconProvider`.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    language: "en",
    resolvedLanguage: "en",
    t: (key, values) => translate(en, en, key, values),
  };
}

/** Convenience hook for components that only need the translator. */
export function useTranslation(): Translate {
  return useI18n().t;
}
