import type { ReactNode } from "react";
import { cx } from "../cx";
import { Illustration, type IllustrationKind } from "./Illustration";

export interface EmptyStateProps {
  /** A scene that fits what is missing. */
  illustration?: IllustrationKind;
  title: ReactNode;
  /** One or two sentences: why it is empty and what fills it. */
  children?: ReactNode;
  /** The ways to fill it, as `Button`s; the first is the main one. */
  actions?: ReactNode;
  /** dashed – a place to fill, inside a page; plain – a whole page with nothing yet. */
  variant?: "dashed" | "plain";
  size?: "sm" | "md";
  className?: string;
}

/** Nothing here yet – said kindly, with the way forward. */
export function EmptyState({ illustration, title, children, actions, variant = "dashed", size = "md", className }: EmptyStateProps) {
  return (
    <div className={cx("ui-empty", `ui-empty-${variant}`, `ui-size-${size}`, className)}>
      {illustration && <Illustration kind={illustration} className="ui-empty-illustration" />}
      <h2 className="ui-empty-title">{title}</h2>
      {children && <div className="ui-empty-text">{children}</div>}
      {actions && <div className="ui-empty-actions">{actions}</div>}
    </div>
  );
}
