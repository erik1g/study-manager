// Reads the props of every building block from its TypeScript types and
// writes them to src/generated/props.json for the tables in the docs. Props
// that come from React's own element types (onClick, id, …) are left out.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import docgen from "react-docgen-typescript";

const here = dirname(fileURLToPath(import.meta.url));
const ui = join(here, "../../../packages/ui");
const folder = join(ui, "src/components");
const files = readdirSync(folder)
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => join(folder, name));

const parser = docgen.withCustomConfig(join(ui, "tsconfig.json"), {
  savePropValueAsString: true,
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
  propFilter: (prop) => !prop.parent || !prop.parent.fileName.includes("node_modules"),
});

const all = {};
for (const component of parser.parse(files)) {
  all[component.displayName] = {
    description: component.description,
    props: Object.values(component.props)
      .map((p) => ({
        name: p.name,
        type: p.type.raw && p.type.raw.length < 90 ? p.type.raw : p.type.name,
        required: p.required,
        default: p.defaultValue?.value ?? null,
        description: p.description,
      }))
      .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name)),
  };
}

mkdirSync(join(here, "../src/generated"), { recursive: true });
writeFileSync(join(here, "../src/generated/props.json"), JSON.stringify(all, null, 2));
console.log(`props of ${Object.keys(all).length} building blocks written`);
