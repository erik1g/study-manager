import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "../cx";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** A setting that takes effect at once, on or off. In forms that are saved later use `Checkbox`. */
export function Switch({ label, description, className, id, ...rest }: SwitchProps) {
  const own = useId();
  const inputId = id ?? own;
  return (
    <label htmlFor={inputId} className={cx("ui-switch", className)}>
      <span className="ui-check-text">
        <span className="ui-check-label">{label}</span>
        {description && (
          <span id={`${inputId}-d`} className="ui-check-description">
            {description}
          </span>
        )}
      </span>
      <input id={inputId} type="checkbox" role="switch" className="ui-switch-input" aria-describedby={description ? `${inputId}-d` : undefined} {...rest} />
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-thumb" />
      </span>
    </label>
  );
}
