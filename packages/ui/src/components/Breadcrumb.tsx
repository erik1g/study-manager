import { Fragment, type ElementType } from "react";
import { cx } from "../cx";
import { uiText } from "../text";

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  /** From the top down; the last one is the current page and is not a link. */
  items: Crumb[];
  linkAs?: ElementType;
  className?: string;
}

/** Where a page sits, above its title: "Courses › Winter semester 2026/27". */
export function Breadcrumb({ items, linkAs, className }: BreadcrumbProps) {
  const Link: ElementType = linkAs ?? "a";
  return (
    <nav aria-label={uiText().breadcrumb} className={cx("ui-breadcrumb", className)}>
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 && (
            <span className="ui-breadcrumb-sep" aria-hidden="true">
              ›
            </span>
          )}
          {item.href !== undefined && index < items.length - 1 ? (
            <Link {...(linkAs ? { to: item.href } : { href: item.href })}>{item.label}</Link>
          ) : (
            <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
