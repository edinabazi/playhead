import fs from "node:fs";
import console from "node:console";

const en = fs.readFileSync("src/renderer/src/lib/i18n/en.ts", "utf8");
const zh = fs.readFileSync("src/renderer/src/lib/i18n/locales/zh-CN.ts", "utf8");

const keys = (src) => [...src.matchAll(/^\s{2}"([^"]+)":/gm)].map((m) => m[1]);

const kEn = keys(en);
const kZh = keys(zh);

console.log("en keys:", kEn.length, " zh keys:", kZh.length);
console.log("duplicate keys in en:", kEn.length - new Set(kEn).size);

const missing = kEn.filter((k) => !kZh.includes(k));
const stray = kZh.filter((k) => !kEn.includes(k));
console.log("missing in zh:", missing.length, missing);
console.log("stray in zh:", stray.length, stray);

// Placeholder parity
const values = (src) => {
  const out = {};
  const re = /^\s{2}"([^"]+)":\s*([\s\S]*?)(?=^\s{2}"|\n\};)/gm;
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
};
const vEn = values(en);
const vZh = values(zh);
const ph = (s) => ((s || "").match(/\{(\w+)\}/g) || []).sort().join(",");
const mismatch = kEn.filter((k) => ph(vEn[k]) !== ph(vZh[k]));
console.log("placeholder mismatch:", mismatch.length, mismatch.slice(0, 15));
