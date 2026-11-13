import { cx } from "../cx";
import type { Tone } from "../tokens";

export interface CountdownTileProps {
  /** The number, e.g. 2. */
  value: number | string;
  /** What it counts, e.g. "days"; "day" for one. */
  unit: string;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
}

/** How long until a deadline, as a small tile: a big number and its unit. */
export function CountdownTile({ value, unit, tone = "grau", size = "md", className }: CountdownTileProps) {
  return (
    <span className={cx("ui-countdown", `ui-tone-${tone}`, `ui-size-${size}`, className)}>
      <span className="ui-countdown-value">{value}</span>
      <span className="ui-countdown-unit">{unit}</span>
    </span>
  );
}
