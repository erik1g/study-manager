import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "../cx";
import type { Tone } from "../tokens";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  /** A second, quieter line. */
  description?: ReactNode;
  /** Strikes the label through when checked, as for a done task. */
  strike?: boolean;
  /** The colour of the checked box; default the dark ink. */
  tone?: Tone;
  /** Hides the label from the eye, e.g. when the task's title stands next to the box. */
  hideLabel?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Yes or no for one thing, or one of several things to tick off. */
export function Checkbox({ label, description, strike, tone, hideLabel, className, id, ...rest }: CheckboxProps) {
  const own = useId();
  const inputId = id ?? own;
  return (
    <label htmlFor={inputId} className={cx("ui-check", strike && "ui-strike", tone && `ui-tone-${tone}`, hideLabel && "ui-check-bare", className)}>
      <input id={inputId} type="checkbox" className="ui-check-input" aria-describedby={description ? `${inputId}-d` : undefined} {...rest} />
      <span className="ui-check-box" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className={hideLabel ? "ui-visually-hidden" : "ui-check-text"}>
        <span className="ui-check-label">{label}</span>
        {description && (
          <span id={`${inputId}-d`} className="ui-check-description">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
