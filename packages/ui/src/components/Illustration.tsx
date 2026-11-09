import type { ReactNode } from "react";

// Small scenes in the Snug Simple manner: round shapes, a dark outline and
// the subject colours as fills. Colours come from the tokens (see
// illustration.css), so a scene follows light and dark by itself.

const SPARKLE = (x: number, y: number, fill: string) => (
  <path d={`M${x} ${y - 10}l3 7 7 3-7 3-3 7-3-7-7-3 7-3z`} className={fill} strokeWidth="2.4" />
);

const SCENES = {
  schreibtisch: (
    <>
      <ellipse cx="120" cy="164" rx="104" ry="10" className="ground" />
      <rect x="18" y="120" width="204" height="12" rx="6" className="orange" />
      <path d="M34 132v28M206 132v28" />
      <rect x="84" y="58" width="78" height="54" rx="8" className="paper" />
      <path d="M96 74h30M96 86h48M96 98h22" className="line-blau" />
      <path d="M72 120l8-8h86l8 8z" className="paper-shade" />
      <path d="M44 120V72l22-14" />
      <path d="M58 50l20 10-8 14-20-10z" className="gelb" />
      <rect x="180" y="98" width="22" height="22" rx="5" className="petrol" />
      <path d="M202 104c8 0 8 10 0 10" />
      <path d="M186 90c-2-4 2-6 0-10M196 90c-2-4 2-6 0-10" className="line-muted" strokeWidth="2.4" />
      {SPARKLE(20, 50, "violett")}
      <circle cx="218" cy="44" r="5" className="orange no-line" />
    </>
  ),
  buecher: (
    <>
      <ellipse cx="120" cy="164" rx="96" ry="10" className="ground" />
      <rect x="44" y="130" width="140" height="28" rx="8" className="blau" />
      <path d="M58 130v28" className="line-paper" />
      <rect x="56" y="102" width="124" height="28" rx="8" className="gelb" />
      <path d="M166 102v28" className="line-paper" />
      <g transform="rotate(-4 108 88)">
        <rect x="48" y="74" width="120" height="28" rx="8" className="petrol" />
        <path d="M80 86h56" className="line-paper" />
      </g>
      <circle cx="160" cy="54" r="16" className="orange" />
      <path d="M160 38c0-6 4-10 10-10" />
      <path d="M163 34c6-6 12-4 14 0-6 4-10 4-14 0z" className="gruen" strokeWidth="2.4" />
      {SPARKLE(36, 54, "violett")}
    </>
  ),
  tasse: (
    <>
      <ellipse cx="120" cy="164" rx="80" ry="10" className="ground" />
      <ellipse cx="116" cy="150" rx="66" ry="10" className="paper" />
      <path d="M72 82h88v34a34 34 0 0 1-34 34h-20a34 34 0 0 1-34-34z" className="orange" />
      <path d="M160 92c22 0 22 34 0 34" />
      <path d="M86 100c6 6 14 6 20 0" className="line-paper" />
      <circle cx="90" cy="92" r="2" className="ink no-line" />
      <circle cx="102" cy="92" r="2" className="ink no-line" />
      <path d="M98 66c-6-8 6-12 0-22M118 66c-6-8 6-12 0-22M138 66c-6-8 6-12 0-22" className="line-muted" />
      {SPARKLE(200, 56, "gelb")}
    </>
  ),
  kalender: (
    <>
      <ellipse cx="120" cy="164" rx="84" ry="10" className="ground" />
      <rect x="58" y="34" width="124" height="120" rx="18" className="paper" />
      <path d="M58 52a18 18 0 0 1 18-18h88a18 18 0 0 1 18 18v18H58z" className="blau" />
      <path d="M90 24v20M150 24v20" />
      <rect x="76" y="84" width="20" height="18" rx="5" className="paper-shade no-line" />
      <rect x="110" y="84" width="20" height="18" rx="5" className="paper-shade no-line" />
      <rect x="144" y="84" width="20" height="18" rx="5" className="gelb no-line" />
      <rect x="76" y="114" width="20" height="18" rx="5" className="paper-shade no-line" />
      <rect x="110" y="114" width="20" height="18" rx="5" className="petrol no-line" />
      <rect x="144" y="114" width="20" height="18" rx="5" className="paper-shade no-line" />
      <path d="M196 120l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" className="orange" strokeWidth="2.4" />
    </>
  ),
  stern: (
    <>
      <ellipse cx="120" cy="164" rx="60" ry="9" className="ground" />
      <path d="M120 26l14 36 38 4-29 25 9 37-32-20-32 20 9-37-29-25 38-4z" className="gelb" />
      <circle cx="110" cy="84" r="2.4" className="ink no-line" />
      <circle cx="130" cy="84" r="2.4" className="ink no-line" />
      <path d="M113 94c4 4 10 4 14 0" />
      {SPARKLE(44, 60, "violett")}
      {SPARKLE(196, 50, "blau")}
      <circle cx="56" cy="128" r="5" className="orange no-line" />
      <circle cx="188" cy="124" r="5" className="petrol no-line" />
    </>
  ),
  karten: (
    <>
      <ellipse cx="120" cy="164" rx="88" ry="10" className="ground" />
      <rect x="54" y="52" width="92" height="104" rx="14" className="petrol" transform="rotate(-12 100 104)" />
      <rect x="94" y="48" width="92" height="104" rx="14" className="orange" transform="rotate(10 140 100)" />
      <rect x="74" y="40" width="92" height="110" rx="14" className="paper" />
      <path d="M92 64h56M92 78h40" />
      <path d="M120 100c0-10 16-10 16 0 0 8-8 8-8 16" className="line-violett" strokeWidth="3.4" />
      <circle cx="128" cy="130" r="2.6" className="violett no-line" />
      {SPARKLE(202, 44, "gelb")}
    </>
  ),
  fertig: (
    <>
      <ellipse cx="120" cy="164" rx="64" ry="9" className="ground" />
      <path d="M120 30c30 0 52 18 52 52s-22 64-52 64-52-30-52-64 22-52 52-52z" className="gruen" />
      <path d="M96 90l16 16 32-34" className="line-paper" strokeWidth="7" />
      <path d="M40 46l6 4M200 46l-6 4M34 96h8M198 96h8" className="line-muted" />
      <rect x="52" y="122" width="10" height="10" rx="2" className="gelb no-line" transform="rotate(20 57 127)" />
      <rect x="182" y="120" width="10" height="10" rx="2" className="blau no-line" transform="rotate(-20 187 125)" />
      <circle cx="190" cy="24" r="5" className="orange no-line" />
      <circle cx="52" cy="22" r="5" className="violett no-line" />
    </>
  ),
  pflanze: (
    <>
      <ellipse cx="120" cy="164" rx="70" ry="10" className="ground" />
      <path d="M120 118V64" />
      <path d="M120 96c-30 4-46-14-44-38 26-2 44 14 44 38z" className="gruen" />
      <path d="M120 84c28 2 42-16 40-38-24 0-40 14-40 38z" className="petrol" />
      <path d="M120 64c-6-14 0-28 12-34 6 14 0 28-12 34z" className="gruen" />
      <path d="M86 118h68l-8 40h-52z" className="orange" />
      <path d="M82 112h76v10H82z" className="orange" />
      {SPARKLE(190, 70, "gelb")}
    </>
  ),
  suche: (
    <>
      <ellipse cx="120" cy="164" rx="80" ry="10" className="ground" />
      <rect x="44" y="40" width="96" height="116" rx="14" className="paper" />
      <path d="M62 66h52M62 82h60M62 98h36" />
      <circle cx="146" cy="104" r="30" className="blau" />
      <circle cx="146" cy="104" r="18" className="paper" />
      <path d="M168 126l26 26" strokeWidth="9" />
      {SPARKLE(196, 52, "gelb")}
    </>
  ),
  fehler: (
    <>
      <ellipse cx="120" cy="164" rx="76" ry="10" className="ground" />
      <path d="M58 150c-6-40 20-104 62-104s68 64 62 104z" className="rot" />
      <circle cx="102" cy="100" r="3" className="ink no-line" />
      <circle cx="138" cy="100" r="3" className="ink no-line" />
      <path d="M108 124c8-6 16-6 24 0" />
      <path d="M72 46l10 10M82 46 72 56M170 34l10 10M180 34l-10 10" className="line-muted" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IllustrationKind = keyof typeof SCENES;
export const ILLUSTRATION_KINDS = Object.keys(SCENES) as IllustrationKind[];

export interface IllustrationProps {
  kind: IllustrationKind;
  /** Width in px or any CSS length; the height follows (4 : 3). Default: the width of its place. */
  width?: number | string;
  /** What it shows, when it says something the text next to it does not. Usually it is decoration. */
  label?: string;
  className?: string;
}

/** A small scene: for empty states, the sign-in page and the cards on Today. */
export function Illustration({ kind, width, label, className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 180"
      className={className ? `ui-illustration ${className}` : "ui-illustration"}
      style={width !== undefined ? { width } : undefined}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      focusable="false"
    >
      {label && <title>{label}</title>}
      {SCENES[kind]}
    </svg>
  );
}
