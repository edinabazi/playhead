import type { Dictionary, TranslationValues } from "./types";

const placeholderPattern = /\{(\w+)\}/g;

/**
 * Replaces `{name}` placeholders with values.
 *
 * An unknown placeholder is left verbatim rather than blanked: showing `{count}`
 * in the UI is a loud, fixable bug report, whereas an empty string silently looks
 * like a translation mistake.
 */
export function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(placeholderPattern, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/**
 * Looks up `key`, falling back to English and finally to the key itself.
 * Never throws: a missing translation must not take down the UI.
 */
export function translate(
  dictionary: Dictionary,
  fallback: Dictionary,
  key: string,
  values?: TranslationValues,
): string {
  const template = dictionary[key] ?? fallback[key] ?? key;
  return interpolate(template, values);
}
