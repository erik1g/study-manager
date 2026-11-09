import { useId, type ReactNode } from "react";
import { cx } from "../cx";

export interface FieldLook {
  /** What belongs in the field. Always given; `hideLabel` hides it from the eye only. */
  label: ReactNode;
  hideLabel?: boolean;
  /** A short help below the field. */
  hint?: ReactNode;
  /** What is wrong with the value; marks the field invalid. */
  error?: ReactNode;
}

/** Label, help and error around a control, joined by ids. */
export function useField(id: string | undefined, { hint, error }: Pick<FieldLook, "hint" | "error">) {
  const own = useId();
  const controlId = id ?? own;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return {
    controlId,
    describedBy: [errorId, hintId].filter(Boolean).join(" ") || undefined,
    hintId,
    errorId,
  };
}

export function FieldFrame({
  label,
  hideLabel,
  hint,
  error,
  controlId,
  hintId,
  errorId,
  className,
  children,
}: FieldLook & { controlId: string; hintId?: string; errorId?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx("ui-field", error ? "ui-invalid" : undefined, className)}>
      <label htmlFor={controlId} className={cx("ui-field-label", hideLabel && "ui-visually-hidden")}>
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="ui-field-error">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="ui-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
