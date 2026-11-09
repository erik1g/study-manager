import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../cx";
import { Icon, type IconName } from "./Icon";

export interface MenuPosition {
  x: number;
  y: number;
  /** "end": the menu's right edge is at `x`, for a button at the right. */
  align?: "start" | "end";
}

/** Where a menu opened by `button` goes: below it, aligned to its start or end. */
export function menuPositionFrom(button: HTMLElement, align: "start" | "end" = "end"): MenuPosition {
  const box = button.getBoundingClientRect();
  return { x: align === "end" ? box.right : box.left, y: box.bottom + 6, align };
}

export interface MenuProps {
  at: MenuPosition;
  /** The menu's accessible name, e.g. "Aktionen für Skript.pdf". */
  label: string;
  onClose: () => void;
  /** `MenuItem`s and `MenuSeparator`s. */
  children: ReactNode;
}

/**
 * A short list of actions at a button or the pointer. Closes on a click
 * elsewhere, Escape, scrolling or when the window loses focus; the arrow keys
 * move between the items.
 */
export function Menu({ at, label, onClose, children }: MenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number; origin: string; fromRight: boolean } | null>(null);

  // Keep the menu inside the window, growing from the corner nearest to what opened it.
  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (!box) return;
    const end = at.align === "end";
    const wanted = end ? at.x - box.width : at.x;
    const x = Math.max(4, Math.min(wanted, window.innerWidth - box.width - 4));
    const y = Math.max(4, Math.min(at.y, window.innerHeight - box.height - 4));
    const fromRight = end || x < wanted;
    const offset = end ? Math.max(4, window.innerWidth - at.x) : x;
    setPosition({ x: offset, y, origin: `${y < at.y ? "bottom" : "top"} ${fromRight ? "right" : "left"}`, fromRight: end });
  }, [at]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const outside = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        opener?.focus();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? []);
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? index + 1 : index - 1;
        items[(next + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("contextmenu", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("contextmenu", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // On the page itself: inside a card that lifts on hover, "fixed" would be measured from the card.
  return createPortal(
    <div
      ref={menu}
      className="ui-menu"
      role="menu"
      aria-label={label}
      style={
        position
          ? { ...(position.fromRight ? { right: position.x } : { left: position.x }), top: position.y, transformOrigin: position.origin }
          : { left: 0, top: 0, visibility: "hidden" }
      }
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  icon?: IconName;
  /** For deleting and leaving: red. */
  danger?: boolean;
  disabled?: boolean;
  /** A shortcut shown at the end. */
  shortcut?: string;
  children: ReactNode;
}

export function MenuItem({ onSelect, icon, danger, disabled, shortcut, children }: MenuItemProps) {
  return (
    <button type="button" role="menuitem" className={cx("ui-menu-item", danger && "ui-danger")} disabled={disabled} onClick={onSelect}>
      {icon && <Icon name={icon} size={18} />}
      <span className="ui-menu-label">{children}</span>
      {shortcut && <kbd className="ui-kbd">{shortcut}</kbd>}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="ui-menu-separator" role="separator" />;
}
