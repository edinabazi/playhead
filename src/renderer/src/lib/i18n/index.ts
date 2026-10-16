export { en } from "./en";
export { zhCN } from "./locales/zh-CN";
export { I18nProvider, registerDictionary, useI18n, useTranslation, type Translate } from "./i18n-context";
export {
  detectSystemLocale,
  isAppLanguage,
  resolveLanguage,
  resolveLanguageFromLocale,
  supportedLanguages,
} from "./locale";
export { interpolate, translate } from "./translate";
export type {
  AppLanguage,
  Dictionary,
  ResolvedLanguage,
  TranslationValues,
} from "./types";
export type { TranslationKey } from "./keys";
