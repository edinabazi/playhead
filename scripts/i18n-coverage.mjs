import console from "node:console";
import fs from "node:fs";
import path from "node:path";

// Counts files that use useTranslation vs files that still hold English UI literals.
const root = "src/renderer/src/features";

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
};

// Heuristic: JSX text or quoted literal that looks like a sentence-case English UI string.
const literalRe = />\s*[A-Z][a-z]+(?:\s+[a-z]+){1,5}\s*</g;
const attrRe = /(?:title|aria-label|placeholder|label)="[A-Z][a-z]+(?:\s+[a-z]+){1,5}"/g;

const files = walk(root);
let withT = 0;
const offenders = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const usesT = /useTranslation\s*\(/.test(src);
  if (usesT) withT++;

  const lit = (src.match(literalRe) || []).length;
  const attr = (src.match(attrRe) || []).length;
  const total = lit + attr;
  if (total > 0 && !usesT) offenders.push({ file, lit, attr, total });
}

console.log(`renderer feature files scanned: ${files.length}`);
console.log(`files using useTranslation:    ${withT}`);
console.log("");
console.log("Files with English literals but NO useTranslation:");
const sorted = offenders.sort((a, b) => b.total - a.total);
for (const o of sorted) {
  console.log(`  ${String(o.total).padStart(3)}  ${o.file}`);
}
console.log("");
console.log(`total such files: ${sorted.length}`);
