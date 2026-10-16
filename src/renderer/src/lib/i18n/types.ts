import type { AppLanguage, ResolvedLanguage } from "../../../../shared/language";

/** Re-exported from `shared/language` so main and renderer share one definition. */
export type { AppLanguage, ResolvedLanguage };

export type TranslationValues = Record<string, string | number>;

/**
 * A dictionary maps a stable dot-separated key to its translation.
 * `en` is the source of truth: `TranslationKey` is derived from it, so a key that
 * does not exist in `en` fails `npm run typecheck` instead of rendering blank.
 */
export type Dictionary = Record<string, string>;
