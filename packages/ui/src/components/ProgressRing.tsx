import { useEffect, useState, type ReactNode } from "react";
import { cx } from "../cx";
import type { Tone } from "../tokens";

/** Rings that have run up once in this visit; seen again, they simply stand. */
const shown = new Set<string>();

export interface ProgressRingProps {
  /** How far, from 0 to 1. */
  value: number;
  /** Said to screen readers, e.g. "8 of 13 chapters". */
  label: string;
  /** Width and height in px. */
  size?: number;
  thickness?: number;
  tone?: Tone;
  /** Inside the ring, e.g. the percentage. */
  children?: ReactNode;
  /** Runs up from zero the first time a ring with this key appears in a visit. */
  animateKey?: string;
  /** On a tinted card the track is white; elsewhere it is the sunken grey. */
  onTint?: boolean;
  className?: string;
}

/** How far something has come, as a ring. */
export function ProgressRing({ value, label, size = 48, thickness = 6, tone = "blau", children, animateKey, onTint, className }: ProgressRingProps) {
  const [runs] = useState(() => !!animateKey && !shown.has(animateKey));
  useEffect(() => {
    if (animateKey) shown.add(animateKey);
  }, [animateKey]);
  const radius = (size - thickness) / 2;
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - Math.min(Math.max(value, 0), 1));
  return (
    <span className={cx("ui-ring", `ui-tone-${tone}`, onTint && "ui-on-tint", runs && "ui-runs", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ui-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={thickness} />
        <circle
          className="ui-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          strokeDasharray={length}
          strokeDashoffset={offset}
          style={{ ["--ui-ring-length" as string]: length }}
        />
      </svg>
      {children && <span className="ui-ring-inside">{children}</span>}
    </span>
  );
}
