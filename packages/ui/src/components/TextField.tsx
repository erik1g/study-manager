import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from "react";
import { cx } from "../cx";
import { FieldFrame, useField, type FieldLook } from "./Field";
import { Icon, type IconName } from "./Icon";

export interface TextFieldProps extends FieldLook, Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** An icon at the start of the field. */
  icon?: IconName;
  /** Something at the end inside the field, e.g. a unit or an `IconButton`. */
  trailing?: ReactNode;
  size?: "md" | "lg";
  ref?: Ref<HTMLInputElement>;
}

/** One line of text, with its label above. For searching use `SearchField`. */
export function TextField({ label, hideLabel, hint, error, icon, trailing, size = "md", id, className, ...rest }: TextFieldProps) {
  const field = useField(id, { hint, error });
  return (
    <FieldFrame label={label} hideLabel={hideLabel} hint={hint} error={error} {...field} className={className}>
      <div className={cx("ui-control", `ui-size-${size}`)}>
        {icon && <Icon name={icon} size={18} className="ui-control-icon" />}
        <input id={field.controlId} className="ui-input" aria-invalid={error ? true : undefined} aria-describedby={field.describedBy} {...rest} />
        {trailing && <span className="ui-control-trailing">{trailing}</span>}
      </div>
    </FieldFrame>
  );
}

export interface TextAreaProps extends FieldLook, TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

/** Several lines of text. It grows with its content up to a limit and then scrolls. */
export function TextArea({ label, hideLabel, hint, error, id, className, rows = 4, ...rest }: TextAreaProps) {
  const field = useField(id, { hint, error });
  return (
    <FieldFrame label={label} hideLabel={hideLabel} hint={hint} error={error} {...field} className={className}>
      <div className="ui-control ui-control-area">
        <textarea id={field.controlId} className="ui-input" rows={rows} aria-invalid={error ? true : undefined} aria-describedby={field.describedBy} {...rest} />
      </div>
    </FieldFrame>
  );
}
