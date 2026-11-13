import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentPropsWithoutRef, ElementType, ReactNode, Ref } from "react";
import { cx } from "../cx";
import type { Tone } from "../tokens";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "soft" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonLook {
  /**
   * primary – the one main action of a view (dark).
   * secondary – everything else (outlined); the default.
   * soft – a friendly side action on a tint, e.g. "With Claude".
   * danger – deleting and leaving.
   * ghost – quiet actions in toolbars and lists.
   */
  variant?: ButtonVariant;
  /** sm 36 px, md 44 px (default), lg 52 px high. */
  size?: ButtonSize;
  /** The colour of a `soft` button; default the neutral tint. */
  tone?: Tone;
  /** An icon before the text. */
  icon?: IconName;
  /** An icon after the text, e.g. an arrow for "Next". */
  iconEnd?: IconName;
  /** As wide as its place. */
  wide?: boolean;
  /** Shows a spinner instead of the icon and blocks further presses. */
  loading?: boolean;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

/** The class names of a button's look, for elements that cannot be a `Button`. */
export function buttonClass({ variant = "secondary", size = "md", tone, wide, loading }: ButtonLook = {}): string {
  return cx("ui-button", `ui-button-${variant}`, `ui-size-${size}`, tone && variant === "soft" && `ui-tone-${tone}`, wide && "ui-wide", loading && "ui-loading");
}

function Inside({ icon, iconEnd, loading, size = "md", children }: ButtonLook & { children: ReactNode }) {
  const px = ICON_SIZE[size];
  return (
    <>
      {loading ? <Spinner size={px} label="" /> : icon && <Icon name={icon} size={px} />}
      <span className="ui-button-label">{children}</span>
      {iconEnd && <Icon name={iconEnd} size={px} />}
    </>
  );
}

export interface ButtonProps extends ButtonLook, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** A button: something happens here. Its text says what, as a verb ("Save", not "OK"). */
export function Button({ variant, size, tone, icon, iconEnd, wide, loading, type = "button", disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClass({ variant, size, tone, wide, loading }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inside icon={icon} iconEnd={iconEnd} loading={loading} size={size}>
        {children}
      </Inside>
    </button>
  );
}

export type LinkButtonProps<C extends ElementType = "a"> = ButtonLook & {
  /** The element or component that navigates, e.g. react-router's `Link`. Default `a`. */
  as?: C;
  children: ReactNode;
} & Omit<C extends "a" ? AnchorHTMLAttributes<HTMLAnchorElement> : ComponentPropsWithoutRef<C>, keyof ButtonLook | "as" | "children">;

/** Looks like a button, goes somewhere: for navigation, never for actions. */
export function LinkButton<C extends ElementType = "a">({ as, variant, size, tone, icon, iconEnd, wide, className, children, ...rest }: LinkButtonProps<C>) {
  const Element: ElementType = as ?? "a";
  return (
    <Element className={cx(buttonClass({ variant, size, tone, wide }), className)} {...rest}>
      <Inside icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </Inside>
    </Element>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** What it does, for screen readers and as a tooltip. Required: the icon alone says nothing to them. */
  label: string;
  variant?: Exclude<ButtonVariant, "danger">;
  size?: ButtonSize;
  tone?: Tone;
  /** For toggles: whether it is on. */
  pressed?: boolean;
  /** A small count on the button, e.g. unread notifications; hidden at 0. It is added to the label for screen readers. */
  badge?: number;
  ref?: Ref<HTMLButtonElement>;
}

/** A square button with only an icon, for toolbars and the ⋯ of a card. */
export function IconButton({ icon, label, variant = "ghost", size = "md", tone, pressed, badge, type = "button", className, ...rest }: IconButtonProps) {
  const counted = badge !== undefined && badge > 0;
  return (
    <button
      type={type}
      className={cx(buttonClass({ variant, size, tone }), "ui-icon-button", className)}
      aria-label={counted ? `${label} (${badge})` : label}
      title={label}
      aria-pressed={pressed}
      {...rest}
    >
      <Icon name={icon} size={ICON_SIZE[size] + 2} />
      {counted && (
        <span className="ui-icon-badge" aria-hidden="true">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
