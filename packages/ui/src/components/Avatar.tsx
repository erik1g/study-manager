import { Children, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { TONES, type Tone } from "../tokens";

/** Up to two initials of a name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "")).toUpperCase();
}

/** The same colour for the same key everywhere (grey is kept for deleted accounts). */
export function toneFor(key: string): Tone {
  const tones = TONES.filter((t) => t !== "grau");
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return tones[Math.abs(hash) % tones.length]!;
}

export interface AvatarProps {
  /** The person's name, for the initials and the picture's description. */
  name: string;
  /** The picture; without it, or when it fails, the initials. */
  src?: string | null;
  /** Width and height in px. */
  size?: number;
  /** Decides the colour of the initials; usually the person's id. Default the name. */
  colorKey?: string;
  /** A deleted account: grey, with a dash. */
  gone?: boolean;
  /** Hides it from screen readers when the name stands next to it. */
  decorative?: boolean;
  className?: string;
}

/** A person: their picture, or their initials on their colour. */
export function Avatar({ name, src, size = 32, colorKey, gone, decorative, className }: AvatarProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)), borderRadius: Math.round(size * 0.36) };
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": name };
  if (src && broken !== src && !gone) {
    return <img className={cx("ui-avatar", className)} src={src} alt={decorative ? "" : name} style={style} onError={() => setBroken(src)} />;
  }
  return (
    <span className={cx("ui-avatar", `ui-tone-${gone ? "grau" : toneFor(colorKey ?? name)}`, className)} style={style} {...a11y}>
      {gone ? "–" : initials(name)}
    </span>
  );
}

export interface AvatarGroupProps {
  /** Who they are together, e.g. "3 members". */
  label: string;
  /** How many to show before "+n". */
  max?: number;
  children: ReactNode;
}

/** Several people, overlapping, e.g. the members of a subject. */
export function AvatarGroup({ label, max = 4, children }: AvatarGroupProps) {
  const all = Children.toArray(children);
  const rest = all.length - max;
  return (
    <span className="ui-avatar-group" role="group" aria-label={label}>
      {all.slice(0, max)}
      {rest > 0 && <span className="ui-avatar ui-avatar-more ui-tone-grau">+{rest}</span>}
    </span>
  );
}
