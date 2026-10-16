import type { AppLanguage, ResolvedLanguage } from "./types";
import { isAppLanguage } from "../../../../shared/language";

export const supportedLanguages: ResolvedLanguage[] = ["en", "zh-CN"];

/**
 * Maps a BCP 47 locale tag onto the closest language we ship.
 *
 * Chinese variants (`zh`, `zh-CN`, `zh-Hans`, `zh-SG`, …) all resolve to Simplified
 * Chinese; Traditional variants (`zh-TW`, `zh-HK`, `zh-Hant`) resolve to English
 * rather than showing Simplified text, which would read as a bug.
 */
export function resolveLanguageFromLocale(locale: string | undefined | null): ResolvedLanguage {
  const normalized = normalizeLocaleTag(locale);
  if (!normalized) return "en";

  if (normalized === "zh") return "zh-CN";
  if (normalized.startsWith("zh-")) {
    if (isTraditionalChineseTag(normalized)) return "en";
    return "zh-CN";
  }

  return "en";
}

function normalizeLocaleTag(locale: string | undefined | null): string {
  return (locale || "").trim().replace(/_/g, "-").toLowerCase();
}

function isTraditionalChineseTag(normalizedTag: string): boolean {
  if (normalizedTag.includes("hant")) return true;
  const region = normalizedTag.split("-")[1] || "";
  return ["tw", "hk", "mo"].includes(region);
}

/**
 * Turns the stored setting into a concrete dictionary to use.
 * A `system` setting is resolved from the OS/browser locale.
 */
export function resolveLanguage(
  setting: AppLanguage,
  systemLocale: string | undefined | null = detectSystemLocale(),
): ResolvedLanguage {
  if (setting === "en" || setting === "zh-CN") return setting;
  return resolveLanguageFromLocale(systemLocale);
}

export function detectSystemLocale(): string {
  if (typeof navigator === "undefined") return "en";
  return navigator.languages?.[0] || navigator.language || "en";
}

export { isAppLanguage };
