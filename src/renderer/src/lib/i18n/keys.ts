import type { en } from "./en";

/**
 * Every valid translation key, derived from the English source dictionary.
 *
 * Using this type on dictionary literals means a typo like `nav.artist`
 * is a compile error instead of a string that silently renders untranslated.
 */
export type TranslationKey = keyof typeof en;
