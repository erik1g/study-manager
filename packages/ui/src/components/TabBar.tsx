import type { ElementType } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "./Icon";

export interface TabBarItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
}

export interface TabBarProps {
  items: TabBarItem[];
  /** The id of the current place. */
  active?: string;
  /** The link element, e.g. react-router's `Link` (it gets `to`). */
  linkAs?: ElementType;
  /** A round button in the middle, e.g. "Neu anlegen". */
  action?: { label: string; icon: IconName; onClick: () => void };
  /** Sticks to the bottom of the window. */
  fixed?: boolean;
  label?: string;
  className?: string;
}

/** The places of the app at the bottom of a phone screen. On wide screens use `Sidebar`. */
export function TabBar({ items, active, linkAs, action, fixed = true, label = "Hauptnavigation", className }: TabBarProps) {
  const Link: ElementType = linkAs ?? "a";
  const half = Math.ceil(items.length / 2);
  const link = (item: TabBarItem) => (
    <Link key={item.id} className="ui-tabbar-item" aria-current={item.id === active ? "page" : undefined} {...(linkAs ? { to: item.href } : { href: item.href })}>
      <Icon name={item.icon} size={22} />
      <span>{item.label}</span>
    </Link>
  );
  return (
    <nav aria-label={label} className={cx("ui-tabbar", fixed && "ui-fixed", className)} style={{ ["--ui-tabbar-columns" as string]: items.length + (action ? 1 : 0) }}>
      {items.slice(0, action ? half : items.length).map(link)}
      {action && (
        <button type="button" className="ui-tabbar-action" aria-label={action.label} onClick={action.onClick}>
          <Icon name={action.icon} size={24} />
        </button>
      )}
      {action && items.slice(half).map(link)}
    </nav>
  );
}
