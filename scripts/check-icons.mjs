/* Checks that every icon referenced in the code exists in icons.ts.
   Usage: node scripts/check-icons.mjs */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const iconsSource = readFileSync(resolve(process.cwd(), "src/components/ui/icons.ts"), "utf8");
const keys = new Set([...iconsSource.matchAll(/^\s*"([a-z0-9-]+)":\s*\{/gm)].map((m) => m[1]));

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !path.endsWith("icons.ts")) {
      files.push(path);
    }
  }
})("src");

/* Names that look like icons but are CSS classes used as strings. */
const CSS_CLASS_EXCEPTIONS = new Set(["reblog-line"]);

const found = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/["']([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:line|fill))["']/g)) {
    if (CSS_CLASS_EXCEPTIONS.has(match[1])) continue;
    if (!found.has(match[1])) found.set(match[1], file);
  }
}

const missing = [...found.keys()].filter((name) => !keys.has(name));
if (missing.length) {
  console.error("Ícones ausentes em icons.ts (rode scripts/generate-icons.mjs):");
  for (const name of missing) console.error(` - ${name}  (${found.get(name)})`);
  process.exit(1);
}
console.log(`OK: todos os ${found.size} nomes de ícone do código existem (${keys.size} gerados).`);
