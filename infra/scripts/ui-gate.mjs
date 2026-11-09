// Keeps the web app on its building blocks: fails when apps/web uses a bare
// <button>, <input>, <select> or <textarea>, an old style class, or writes a
// colour as hex, rgb() or hsl() instead of a --ui- token. An exception needs
// "ui-allow: <reason>" on the line before.  node infra/scripts/ui-gate.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const source = join(root, "apps/web/src");

const RULES = [
  { files: /\.tsx$/, pattern: /<(button|input|select|textarea)[\s>/]/, say: (m) => `nacktes <${m[1]}> – nimm einen Baustein aus @study/ui` },
  { files: /\.tsx$/, pattern: /className="(?:[^"]*\s)?(button|icon-button|popover|notice|segmented|tag)(?:\s[^"]*)?"/, say: (m) => `alte Klasse „${m[1]}“ – nimm den Baustein` },
  { files: /\.(tsx|css)$/, pattern: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(/, say: () => "Farbe als Wert – nimm ein Token (--ui-…)" },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const problems = [];
for (const file of walk(source)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/ui-allow:/.test(lines[index - 1] ?? "") || /ui-allow:/.test(line)) return;
    // Comments and imports may name things freely.
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (/^\s*(import|\*|\/\*)/.test(line)) return;
    for (const rule of RULES) {
      if (!rule.files.test(file)) continue;
      const match = code.match(rule.pattern);
      if (match) problems.push(`${relative(root, file)}:${index + 1}  ${rule.say(match)}`);
    }
  });
}

if (problems.length) {
  console.error(`UI-Prüfung: ${problems.length} Stelle(n) außerhalb der Bausteine\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nSiehe die Entwickler-Doku (Bausteine): https://erik1g.github.io/study-manager/");
  process.exit(1);
}
console.log("UI-Prüfung: alles aus Bausteinen");
