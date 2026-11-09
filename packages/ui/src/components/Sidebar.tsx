import type { ElementType, MouseEventHandler, ReactNode } from "react";
import { cx } from "../cx";
import type { Tone } from "../tokens";
import { Icon, type IconName } from "./Icon";

export interface SidebarProps {
  /** At the top: usually the `Logo`. */
  brand?: ReactNode;
  /** `NavSection`s and `NavItem`s. */
  children: ReactNode;
  /** At the bottom: the account and settings. */
  footer?: ReactNode;
  label?: string;
  /** Only the icons: labels hide (they stay for screen readers and as tooltips), counts shrink to a dot. */
  collapsed?: boolean;
  className?: string;
}

/** The column at the left on wide screens with the places of the app. On phones use `TabBar`. */
export function Sidebar({ brand, children, footer, label = "Hauptnavigation", collapsed, className }: SidebarProps) {
  return (
    <nav aria-label={label} className={cx("ui-sidebar", collapsed && "ui-collapsed", className)}>
      {brand && <div className="ui-sidebar-brand">{brand}</div>}
      <div className="ui-sidebar-body">{children}</div>
      {footer && <div className="ui-sidebar-footer">{footer}</div>}
    </nav>
  );
}

export interface NavSectionProps {
  /** A small heading, e.g. "Deine Fächer"; leave it out for the main places. */
  title?: ReactNode;
  /** At the right of the heading, e.g. an `IconButton` "Fach anlegen". */
  action?: ReactNode;
  children: ReactNode;
}

export function NavSection({ title, action, children }: NavSectionProps) {
  return (
    <div className="ui-nav-section">
      {(title || action) && (
        <div className="ui-nav-section-head">
          {title && <span className="ui-nav-section-title">{title}</span>}
          {action}
        </div>
      )}
      <ul className="ui-nav-list">{children}</ul>
    </div>
  );
}

export interface NavItemProps {
  label: ReactNode;
  icon?: IconName;
  /** A subject's colour as a small square in place of an icon. */
  dot?: Tone;
  /** Something else in place of an icon, e.g. an `Avatar`. */
  leading?: ReactNode;
  /** An icon at the end, e.g. "settings" on the account. */
  endIcon?: IconName;
  href?: string;
  /** The link element, e.g. react-router's `Link` (it gets `to`). */
  linkAs?: ElementType;
  onClick?: MouseEventHandler<HTMLElement>;
  /** For a button that opens a menu. */
  "aria-haspopup"?: "menu";
  "aria-expanded"?: boolean;
  /** Whether this is the current place. */
  active?: boolean;
  /** A keyboard shortcut shown at the end, e.g. "⌘K". */
  shortcut?: string;
  /** A small count at the end. */
  badge?: number;
  /** smaller rows for long lists such as the subjects */
  size?: "sm" | "md";
}

/** One place in the `Sidebar`. */
export function NavItem({ label, icon, dot, leading, endIcon, href, linkAs, onClick, active, shortcut, badge, size = "md", ...aria }: NavItemProps) {
  const inside = (
    <>
      {icon && <Icon name={icon} size={size === "sm" ? 18 : 22} />}
      {dot && <span className={cx("ui-nav-dot", `ui-tone-${dot}`)} aria-hidden="true" />}
      {leading}
      <span className="ui-nav-label">{label}</span>
      {badge !== undefined && badge > 0 && <span className="ui-nav-badge">{badge}</span>}
      {shortcut && <kbd className="ui-kbd">{shortcut}</kbd>}
      {endIcon && <Icon name={endIcon} size={18} className="ui-nav-end" />}
    </>
  );
  const className = cx("ui-nav-item", `ui-size-${size}`);
  const title = typeof label === "string" ? label : undefined;
  const Link: ElementType = linkAs ?? "a";
  return (
    <li>
      {href !== undefined ? (
        <Link className={className} title={title} aria-current={active ? "page" : undefined} onClick={onClick} {...(linkAs ? { to: href } : { href })}>
          {inside}
        </Link>
      ) : (
        <button type="button" className={className} title={title} aria-current={active ? "page" : undefined} onClick={onClick} {...aria}>
          {inside}
        </button>
      )}
    </li>
  );
}
