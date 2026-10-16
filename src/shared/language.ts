/**
 * UI language definitions, shared by main and renderer.
 *
 * Kept in `shared` (not in the renderer's i18n folder) because the main process
 * has to normalize this value when it persists settings.
 */

/** Languages a user can pick. `system` follows the OS locale. */
export type AppLanguage = "system" | "en" | "zh-CN";

/** Languages that have a concrete dictionary behind them. */
export type ResolvedLanguage = "en" | "zh-CN";

export const appLanguages: AppLanguage[] = ["system", "en", "zh-CN"];

export const defaultAppLanguage: AppLanguage = "system";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "system" || value === "en" || value === "zh-CN";
}

/**
 * Coerces a stored/unknown value into a valid language, falling back to the
 * default. Used when reading settings files written by older versions.
 */
export function normalizeAppLanguage(value: unknown): AppLanguage {
  return isAppLanguage(value) ? value : defaultAppLanguage;
}
