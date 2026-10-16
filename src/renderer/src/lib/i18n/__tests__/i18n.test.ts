import { describe, expect, it } from "vitest";
import { en } from "../en";
import { zhCN } from "../locales/zh-CN";
import { resolveLanguage, resolveLanguageFromLocale } from "../locale";
import { interpolate, translate } from "../translate";

describe("i18n locale resolution", () => {
  it("maps Simplified Chinese tags to zh-CN", () => {
    for (const locale of ["zh", "zh-CN", "zh-Hans", "zh-SG", "zh_CN", "ZH-cn"]) {
      expect(resolveLanguageFromLocale(locale)).toBe("zh-CN");
    }
  });

  it("does not show Simplified text for Traditional Chinese users", () => {
    for (const locale of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant"]) {
      expect(resolveLanguageFromLocale(locale)).toBe("en");
    }
  });

  it("falls back to English for unsupported and empty locales", () => {
    for (const locale of ["en-US", "fr", "de-DE", "", undefined, null]) {
      expect(resolveLanguageFromLocale(locale)).toBe("en");
    }
  });

  it("resolves the system setting, but honours an explicit choice", () => {
    expect(resolveLanguage("system", "zh-CN")).toBe("zh-CN");
    expect(resolveLanguage("system", "en-GB")).toBe("en");
    // An explicit pick wins over the OS locale.
    expect(resolveLanguage("en", "zh-CN")).toBe("en");
    expect(resolveLanguage("zh-CN", "en-US")).toBe("zh-CN");
  });
});

describe("i18n interpolation", () => {
  it("substitutes placeholders", () => {
    expect(interpolate("{count} tracks", { count: 12 })).toBe("12 tracks");
  });

  it("substitutes every occurrence", () => {
    expect(interpolate("{a}-{b}-{a}", { a: "x", b: "y" })).toBe("x-y-x");
  });

  it("leaves unknown placeholders visible instead of blanking them", () => {
    expect(interpolate("{count} tracks", {})).toBe("{count} tracks");
    expect(interpolate("{count} tracks", { other: 1 })).toBe("{count} tracks");
  });

  it("returns the template untouched when no values are given", () => {
    expect(interpolate("{count} tracks")).toBe("{count} tracks");
  });
});

describe("i18n translate", () => {
  it("translates a known key", () => {
    expect(translate(zhCN, en, "nav.artists")).toBe("艺术家");
    expect(translate(en, en, "nav.artists")).toBe("Artists");
  });

  it("falls back to English when a key is missing from the target dictionary", () => {
    const partial = { "nav.artists": "艺术家" };
    expect(translate(partial, en, "nav.albums")).toBe("Albums");
  });

  it("returns the key itself when unknown everywhere, rather than throwing", () => {
    expect(translate(zhCN, en, "does.not.exist")).toBe("does.not.exist");
  });

  it("interpolates through translation", () => {
    expect(translate(zhCN, en, "library.trackCount", { count: 7 })).toBe("7 首曲目");
  });
});

describe("dictionary coverage", () => {
  it("has no missing keys in zh-CN", () => {
    const missing = Object.keys(en).filter((key) => !(key in zhCN));
    expect(missing).toEqual([]);
  });

  it("has no stray keys in zh-CN", () => {
    const stray = Object.keys(zhCN).filter((key) => !(key in en));
    expect(stray).toEqual([]);
  });

  it("has no empty translations", () => {
    const empty = Object.entries(zhCN)
      .filter(([, value]) => !value.trim())
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("keeps placeholders consistent between en and zh-CN", () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) || []).sort();
    const mismatched = Object.keys(en).filter(
      (key) => placeholders(en[key]).join("|") !== placeholders(zhCN[key]).join("|"),
    );
    expect(mismatched).toEqual([]);
  });
});
