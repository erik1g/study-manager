import type { Ref, SelectHTMLAttributes } from "react";
import { cx } from "../cx";
import { FieldFrame, useField, type FieldLook } from "./Field";
import { Icon } from "./Icon";

export interface SelectProps extends FieldLook, Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "sm" | "md" | "lg";
  ref?: Ref<HTMLSelectElement>;
}

/** A choice from a list, with the system's own picker. Options are `<option>` children. For two to four choices use `SegmentedControl`. */
export function Select({ label, hideLabel, hint, error, size = "md", id, className, children, ...rest }: SelectProps) {
  const field = useField(id, { hint, error });
  return (
    <FieldFrame label={label} hideLabel={hideLabel} hint={hint} error={error} {...field} className={className}>
      <div className={cx("ui-control", "ui-control-select", `ui-size-${size}`)}>
        <select id={field.controlId} className="ui-input" aria-invalid={error ? true : undefined} aria-describedby={field.describedBy} {...rest}>
          {children}
        </select>
        <Icon name="chevron-down" size={18} className="ui-select-chevron" />
      </div>
    </FieldFrame>
  );
}
