import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";
import type { Tone } from "../tokens";
import { Icon, type IconName } from "./Icon";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** The colour; a subject's colour for things of that subject. Default the neutral grey. */
  tone?: Tone;
  icon?: IconName;
  size?: "sm" | "md";
  /** On a tinted card: a white chip that stands out from the tint. */
  onTint?: boolean;
  children: ReactNode;
}

/** A short label: a subject's short name, a count, a state. Not pressable; for choices use `SegmentedControl` or `Button`. */
export function Chip({ tone = "grau", icon, size = "md", onTint, className, children, ...rest }: ChipProps) {
  return (
    <span className={cx("ui-chip", `ui-tone-${tone}`, `ui-size-${size}`, onTint && "ui-on-tint", className)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </span>
  );
}
