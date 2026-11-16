import type { ElementType, ReactNode } from "react";
import { cx } from "../cx";

export interface TabItem {
  id: string;
  label: string;
  /** A link; without it the tab is a button that calls `onSelect`. */
  href?: string;
  /** A small number after the label, e.g. cards due. */
  count?: number;
}

export interface TabsProps {
  /** What the tabs switch between, e.g. "Areas of the course". */
  label: string;
  items: TabItem[];
  /** The id of the current tab. */
  active: string;
  onSelect?: (id: string) => void;
  /** The link element for `href` tabs, e.g. react-router's `Link` (it gets `to`). */
  linkAs?: ElementType;
  /** At the end of the bar, e.g. an `IconButton` "More areas". */
  trailing?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** The parts of a page as pills in a sunken bar; the current one is white. */
export function Tabs({ label, items, active, onSelect, linkAs, trailing, size = "md", className }: TabsProps) {
  const Link: ElementType = linkAs ?? "a";
  return (
    <nav aria-label={label} className={cx("ui-tabs", `ui-size-${size}`, className)}>
      {items.map((item) => {
        const current = item.id === active;
        const inside = (
          <>
            {item.label}
            {item.count !== undefined && item.count > 0 && <span className="ui-tab-count">{item.count}</span>}
          </>
        );
        return item.href !== undefined ? (
          <Link key={item.id} className="ui-tab" aria-current={current ? "page" : undefined} {...(linkAs ? { to: item.href } : { href: item.href })}>
            {inside}
          </Link>
        ) : (
          <button key={item.id} type="button" className="ui-tab" aria-current={current ? "true" : undefined} onClick={() => onSelect?.(item.id)}>
            {inside}
          </button>
        );
      })}
      {trailing}
    </nav>
  );
}
