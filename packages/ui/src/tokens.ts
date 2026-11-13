// The Snug Simple look as values: the one place where colours, type, sizes and
// motion are decided. `scripts/tokens.ts` writes them into styles/tokens.css
// as custom properties (--ui-…); the docs read them from here to show them.

/** A subject colour as it is stored with a course. */
export const TONES = ["blau", "petrol", "gruen", "gelb", "orange", "rot", "violett", "grau"] as const;
export type Tone = (typeof TONES)[number];

/** How each tone is called where people see it. */
export const TONE_NAMES: Record<Tone, string> = {
  blau: "Blue",
  petrol: "Mint",
  gruen: "Sage",
  gelb: "Butter",
  orange: "Peach",
  rot: "Rose",
  violett: "Lavender",
  grau: "Stone",
};

/**
 * Four steps of one colour:
 * tint – the surface of a card or chip,
 * glow – the lighter centre of a tinted card's gradient,
 * ink – text and icons on the tint,
 * strong – dots, rings and filled icons.
 */
export interface ToneSteps {
  tint: string;
  glow: string;
  ink: string;
  strong: string;
}

export interface Neutrals {
  bg: string;
  surface: string;
  sunken: string;
  ink: string;
  muted: string;
  line: string;
  lineSoft: string;
  hover: string;
  scrim: string;
  focus: string;
  shadowCard: string;
  shadowPop: string;
  grain: string;
  /** Illustrations: outline, paper, shadow under things and ground under them. */
  illLine: string;
  illPaper: string;
  illPaperShade: string;
  illGround: string;
}

export interface Theme {
  neutrals: Neutrals;
  tones: Record<Tone, ToneSteps>;
}

export const light: Theme = {
  neutrals: {
    bg: "#F7F2EA",
    surface: "#FFFDF9",
    sunken: "#EFE7DB",
    ink: "#2A2620",
    muted: "#6E665B",
    line: "#E2D7C6",
    lineSoft: "#EDE5D8",
    hover: "rgba(42, 38, 32, 0.05)",
    scrim: "rgba(42, 38, 32, 0.42)",
    focus: "#3F6DAE",
    shadowCard: "0 1px 0 rgba(42, 38, 32, 0.04), 0 10px 28px -14px rgba(42, 38, 32, 0.22)",
    shadowPop: "0 2px 6px rgba(42, 38, 32, 0.06), 0 24px 56px -12px rgba(42, 38, 32, 0.3)",
    grain: "0.07",
    illLine: "#2A2620",
    illPaper: "#FFFDF9",
    illPaperShade: "#EFE7DB",
    illGround: "rgba(42, 38, 32, 0.08)",
  },
  tones: {
    blau: { tint: "#DCE8F6", glow: "#EEF4FB", ink: "#2E4F7C", strong: "#5B86C4" },
    petrol: { tint: "#D5EEE6", glow: "#EAF7F2", ink: "#1F5F55", strong: "#49A08F" },
    gruen: { tint: "#E3EED7", glow: "#F1F7EA", ink: "#3F5E2A", strong: "#84AE5F" },
    gelb: { tint: "#FBEFC6", glow: "#FDF8E3", ink: "#7A5D10", strong: "#E2B53E" },
    orange: { tint: "#FBE1D3", glow: "#FDF0E8", ink: "#8A3F22", strong: "#E08A5E" },
    rot: { tint: "#F8DEDF", glow: "#FCEEEE", ink: "#8C2F3A", strong: "#D9707B" },
    violett: { tint: "#E7E0F6", glow: "#F4F0FC", ink: "#4E3F86", strong: "#8B74C9" },
    grau: { tint: "#E9E4DC", glow: "#F4F1EC", ink: "#4D4943", strong: "#9A9286" },
  },
};

export const dark: Theme = {
  neutrals: {
    bg: "#1E1B17",
    surface: "#29251F",
    sunken: "#332E27",
    ink: "#F3ECE2",
    muted: "#B3A999",
    line: "#3D372F",
    lineSoft: "#332E27",
    hover: "rgba(243, 236, 226, 0.06)",
    scrim: "rgba(0, 0, 0, 0.55)",
    focus: "#8FB3E6",
    shadowCard: "0 1px 0 rgba(0, 0, 0, 0.2), 0 10px 28px -14px rgba(0, 0, 0, 0.6)",
    shadowPop: "0 2px 6px rgba(0, 0, 0, 0.3), 0 24px 56px -12px rgba(0, 0, 0, 0.7)",
    grain: "0.05",
    illLine: "#14110E",
    illPaper: "#3A342C",
    illPaperShade: "#4A4238",
    illGround: "rgba(0, 0, 0, 0.3)",
  },
  tones: {
    blau: { tint: "#243243", glow: "#2E4058", ink: "#C3D7F1", strong: "#7FA6DB" },
    petrol: { tint: "#1F3631", glow: "#284840", ink: "#B5E3D5", strong: "#5DBBA8" },
    gruen: { tint: "#2A3424", glow: "#36442E", ink: "#CFE3BA", strong: "#9BC478" },
    gelb: { tint: "#3A321A", glow: "#4B4122", ink: "#F3DE9C", strong: "#E9C35A" },
    orange: { tint: "#3E2A21", glow: "#50372B", ink: "#F6CBB3", strong: "#EE9F76" },
    rot: { tint: "#3F2427", glow: "#523035", ink: "#F4C3C8", strong: "#E58A93" },
    violett: { tint: "#2D2840", glow: "#3A3354", ink: "#D6CCF2", strong: "#A28FDB" },
    grau: { tint: "#312D28", glow: "#3D3832", ink: "#DCD5CA", strong: "#A39A8C" },
  },
};

/** What a state means, as a tone: messages, signals and danger take these colours. */
export const STATUS: Record<"info" | "success" | "warning" | "danger", Tone> = {
  info: "blau",
  success: "gruen",
  warning: "gelb",
  danger: "rot",
};

/** Values that are the same in light and dark. */
export const scale = {
  font: {
    display: '"Bricolage Grotesque Variable", "Bricolage Grotesque", "Figtree Variable", system-ui, sans-serif',
    body: '"Figtree Variable", "Figtree", -apple-system, "Segoe UI", system-ui, sans-serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace',
  },
  /** Text sizes in px; display sizes are for headings in the display face. */
  text: { xs: 12, sm: 13, md: 15, lg: 17 },
  display: { sm: 18, md: 22, lg: 28, xl: 36, xxl: 46 },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 56 },
  radius: { xs: 8, sm: 12, md: 18, lg: 24, xl: 28, pill: 999 },
  /** Heights of buttons and fields; md is the smallest comfortable touch target. */
  control: { sm: 36, md: 44, lg: 52 },
  motion: {
    easeOut: "cubic-bezier(0.23, 1, 0.32, 1)",
    easeInOut: "cubic-bezier(0.77, 0, 0.175, 1)",
    fast: "140ms",
    base: "200ms",
    slow: "280ms",
  },
} as const;

/** `lineSoft` → `line-soft`, as custom properties are written. */
export const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function themeVars(theme: Theme): string[] {
  const lines = Object.entries(theme.neutrals).map(([name, value]) => `--ui-${kebab(name)}: ${value};`);
  for (const tone of TONES) {
    for (const [step, value] of Object.entries(theme.tones[tone])) lines.push(`--ui-${tone}-${step}: ${value};`);
  }
  return lines;
}

function scaleVars(): string[] {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(scale.font)) lines.push(`--ui-font-${name}: ${value};`);
  for (const [name, value] of Object.entries(scale.text)) lines.push(`--ui-text-${name}: ${value}px;`);
  for (const [name, value] of Object.entries(scale.display)) lines.push(`--ui-display-${name}: ${value}px;`);
  for (const [name, value] of Object.entries(scale.space)) lines.push(`--ui-space-${name}: ${value}px;`);
  for (const [name, value] of Object.entries(scale.radius)) lines.push(`--ui-radius-${name}: ${value}px;`);
  for (const [name, value] of Object.entries(scale.control)) lines.push(`--ui-control-${name}: ${value}px;`);
  for (const [name, value] of Object.entries(scale.motion)) lines.push(`--ui-${kebab(name)}: ${value};`);
  return lines;
}

const block = (selector: string, lines: string[]) => `${selector} {\n${lines.map((l) => `  ${l}`).join("\n")}\n}\n`;

/**
 * The whole of tokens.css. Dark applies when the system asks for it unless the page says light
 * (data-theme="light" on <html>), or when the page says dark; .ui-theme-light and .ui-theme-dark
 * set a theme for one part of a page.
 */
export function tokensCss(): string {
  const toneClasses = TONES.map((tone) =>
    block(`.ui-tone-${tone}`, ["tint", "glow", "ink", "strong"].map((step) => `--ui-tone-${step}: var(--ui-${tone}-${step});`)),
  ).join("\n");
  return [
    "/* Written by scripts/tokens.ts from src/tokens.ts – change the values there. */\n",
    block(":root", ["color-scheme: light;", ...themeVars(light), ...scaleVars()]),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', ["color-scheme: dark;", ...themeVars(dark)])
      .split("\n")
      .map((l) => (l ? `  ${l}` : l))
      .join("\n")}}\n`,
    block(':root[data-theme="dark"]', ["color-scheme: dark;", ...themeVars(dark)]),
    "/* One part of a page in the other theme, e.g. a preview of both side by side. */",
    block(".ui-theme-light", ["color-scheme: light;", ...themeVars(light)]),
    block(".ui-theme-dark", ["color-scheme: dark;", ...themeVars(dark)]),
    "/* A tone for one part of the page: its parts use --ui-tone-…. */",
    toneClasses,
  ].join("\n");
}
