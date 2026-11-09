import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cx } from "../cx";
import type { Tone } from "../tokens";

export type CardProps<C extends ElementType = "div"> = {
  /** The element, e.g. `section`, `article`, `li` or a router `Link` for a card that leads somewhere. Default `div`. */
  as?: C;
  /** A tinted card in a subject colour; without it the card is white with a soft shadow. */
  tone?: Tone;
  /** sunken – a quiet grey ground for things inside other cards; outline – only a dashed line, for places to fill. */
  variant?: "surface" | "sunken" | "outline";
  /** A soft light from one corner, for the large cards at the top of a page. Only with `tone`. */
  glow?: boolean;
  /** A faint paper grain. Only on the one or two cards that lead a page. */
  grain?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  /** Lifts slightly on hover; for cards that are links. */
  interactive?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<C>, "as" | "children">;

/** The ground everything sits on: a rounded surface, white or in a subject colour. */
export function Card<C extends ElementType = "div">({ as, tone, variant = "surface", glow, grain, padding = "md", interactive, className, children, ...rest }: CardProps<C>) {
  const Element: ElementType = as ?? "div";
  return (
    <Element
      className={cx(
        "ui-card",
        tone ? `ui-card-tone ui-tone-${tone}` : `ui-card-${variant}`,
        `ui-pad-${padding}`,
        tone && glow && "ui-glow",
        grain && "ui-grain",
        interactive && "ui-interactive",
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}
