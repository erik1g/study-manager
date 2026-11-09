import type { ReactNode } from "react";
import { cx } from "../cx";

export interface SectionHeaderProps {
  title: ReactNode;
  /** The heading level in the page's outline; the look stays the same. */
  level?: 1 | 2 | 3;
  /** A sentence below the title. */
  description?: ReactNode;
  /** At the right: a link such as "Alle anzeigen" or a small button. */
  action?: ReactNode;
  size?: "md" | "lg" | "xl";
  id?: string;
  className?: string;
}

/** The title of a page or a section, with what belongs next to it. */
export function SectionHeader({ title, level = 2, description, action, size = "md", id, className }: SectionHeaderProps) {
  const Heading = `h${level}` as const;
  return (
    <div className={cx("ui-section-header", `ui-size-${size}`, className)}>
      <div className="ui-section-text">
        <Heading id={id} className="ui-section-title">
          {title}
        </Heading>
        {description && <p className="ui-section-description">{description}</p>}
      </div>
      {action && <div className="ui-section-action">{action}</div>}
    </div>
  );
}
