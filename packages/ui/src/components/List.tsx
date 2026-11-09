import type { ElementType, HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { cx } from "../cx";

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  /** divided – rows on a white card with lines between; raised – each row a white pill, for tinted cards. */
  variant?: "divided" | "raised";
  /** An ordered list, e.g. today's events in time order. */
  ordered?: boolean;
  children: ReactNode;
}

/** Rows of things of one kind: files, events, deadlines, members. Its children are `ListRow`s. */
export function List({ variant = "divided", ordered, className, children, ...rest }: ListProps) {
  const Element = ordered ? "ol" : "ul";
  return (
    <Element className={cx("ui-list", `ui-list-${variant}`, className)} {...rest}>
      {children}
    </Element>
  );
}

export interface ListRowProps {
  /** At the start: a `FileTile`, `CountdownTile`, `Avatar`, a time … */
  leading?: ReactNode;
  title: ReactNode;
  /** The quieter second line. */
  meta?: ReactNode;
  /** At the end: a `Chip`, a size, an `IconButton` … Interactive elements here only when the row itself is not a link or button. */
  trailing?: ReactNode;
  /** Makes the whole row a link. */
  href?: string;
  /** The link element, e.g. react-router's `Link` (then `href` is given as `to`). */
  linkAs?: ElementType;
  /** Makes the whole row a button. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Highlights the row, e.g. the chosen result in a search moved through with the arrow keys. */
  selected?: boolean;
  /** For a row button: hover moves the highlight here. */
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  /** A class for the row itself, e.g. to animate it away. */
  rowClassName?: string;
  /**
   * Controls beside a row that is itself a link or button, e.g. an `IconButton` ⋯ with a `Menu`.
   * They sit next to the row, not inside it, so that nothing interactive is nested.
   */
  actions?: ReactNode;
  /** A right click on the row, e.g. to open the same menu as its ⋯. */
  onContextMenu?: MouseEventHandler<HTMLElement>;
  className?: string;
}

/** One row of a `List`. A link or button when it leads somewhere; its parts stay plain text then. */
export function ListRow({ leading, title, meta, trailing, href, linkAs, onClick, selected, onMouseEnter, rowClassName, actions, onContextMenu, className }: ListRowProps) {
  const inside = (
    <>
      {leading && <span className="ui-row-leading">{leading}</span>}
      <span className="ui-row-text">
        <span className="ui-row-title">{title}</span>
        {meta && <span className="ui-row-meta">{meta}</span>}
      </span>
      {trailing && <span className="ui-row-trailing">{trailing}</span>}
    </>
  );
  let row: ReactNode;
  if (href !== undefined) {
    const Link: ElementType = linkAs ?? "a";
    row = (
      <Link className={cx("ui-row ui-row-action", selected && "ui-selected", rowClassName)} onMouseEnter={onMouseEnter} onContextMenu={onContextMenu} {...(linkAs ? { to: href } : { href })}>
        {inside}
      </Link>
    );
  } else if (onClick) {
    row = (
      <button type="button" className={cx("ui-row ui-row-action", selected && "ui-selected", rowClassName)} onClick={onClick} onMouseEnter={onMouseEnter} onContextMenu={onContextMenu} aria-current={selected || undefined}>
        {inside}
      </button>
    );
  } else
    row = (
      <div className={cx("ui-row", rowClassName)} onContextMenu={onContextMenu}>
        {inside}
      </div>
    );
  return (
    <li className={cx("ui-list-item", actions !== undefined && "ui-has-actions", className)}>
      {row}
      {actions !== undefined && <span className="ui-row-actions">{actions}</span>}
    </li>
  );
}
