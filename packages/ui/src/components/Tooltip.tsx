import { cloneElement, useId, type ReactElement } from "react";
import { cx } from "../cx";

export interface TooltipProps {
  /** A few words; never anything one needs to read to use the app. */
  content: string;
  /** One element that can take focus, e.g. a button. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
}

/** A hint that appears on hover and keyboard focus. Icon buttons already show their label; use this for extra hints only. */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const id = useId();
  return (
    <span className={cx("ui-tooltip-anchor", `ui-side-${side}`)}>
      {cloneElement(children, { "aria-describedby": id })}
      <span role="tooltip" id={id} className="ui-tooltip">
        {content}
      </span>
    </span>
  );
}
