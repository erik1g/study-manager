import { cx } from "../cx";
import { uiText } from "../text";

export interface SpinnerProps {
  /** Width and height in px. */
  size?: number;
  /** Said to screen readers. Leave it empty when the surrounding control already says that something is loading. */
  label?: string;
  className?: string;
}

/** Something is on its way. Only for waits that take longer than a moment; for whole pages use `PageSkeleton`. */
export function Spinner({ size = 20, label = uiText().loading, className }: SpinnerProps) {
  return (
    <span className={cx("ui-spinner", className)} style={{ width: size, height: size }} {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })} />
  );
}
