import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dark, light, TONES, tokensCss } from "../src/tokens.ts";

/** Relative luminance and contrast as WCAG defines them. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe("the tokens", () => {
  it("are written into tokens.css as they are", () => {
    expect(readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8")).toBe(tokensCss());
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)("keep text readable in %s (4.5:1)", (_, theme) => {
    const n = theme.neutrals;
    for (const ground of [n.bg, n.surface, n.sunken]) {
      expect(contrast(n.ink, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(n.muted, ground)).toBeGreaterThanOrEqual(4.5);
    }
    for (const tone of TONES) {
      const t = theme.tones[tone];
      expect(contrast(t.ink, t.tint), `${tone} ink on tint`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.ink, t.glow), `${tone} ink on glow`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
