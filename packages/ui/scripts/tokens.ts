// Writes src/styles/tokens.css from src/tokens.ts: node scripts/tokens.ts
import { writeFileSync } from "node:fs";
import { tokensCss } from "../src/tokens.ts";

writeFileSync(new URL("../src/styles/tokens.css", import.meta.url), tokensCss());
console.log("tokens.css written");
