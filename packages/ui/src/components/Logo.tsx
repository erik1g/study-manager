import { cx } from "../cx";

export interface LogoProps {
  /** Width and height of the mark in px. */
  size?: number;
  /** Shows "Study Manager" next to the mark. */
  withName?: boolean;
  className?: string;
}

/** The Study Manager's mark: an open book on a blue tile. */
export function Logo({ size = 40, withName = true, className }: LogoProps) {
  return (
    <span className={cx("ui-logo", className)}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="ui-logo-mark">
        <rect x="2" y="2" width="36" height="36" rx="13" className="tile" />
        <path d="M11 13.5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0z" className="left" />
        <path d="M20 13.5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0z" className="right" />
        <circle cx="30.5" cy="10" r="2.6" className="dot" />
      </svg>
      {withName ? <span className="ui-logo-name">Study Manager</span> : <span className="ui-visually-hidden">Study Manager</span>}
    </span>
  );
}
