import { useId, type InputHTMLAttributes, type Ref } from "react";
import { cx } from "../cx";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** How the value is shown next to the label, e.g. `(v) => `${v} ×``; leave it out to show nothing. */
  format?: (value: number) => string;
  ref?: Ref<HTMLInputElement>;
}

/** A value from a range by dragging, e.g. the zoom of a picture. For exact numbers use `TextField type="number"`. */
export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, format, className, id, ...rest }: SliderProps) {
  const own = useId();
  const inputId = id ?? own;
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className={cx("ui-slider", className)}>
      <div className="ui-slider-text">
        <label htmlFor={inputId} className="ui-field-label">
          {label}
        </label>
        {format && <span className="ui-slider-value">{format(value)}</span>}
      </div>
      <input
        id={inputId}
        type="range"
        className="ui-slider-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--ui-slider-fill" as string]: `${percent}%` }}
        {...rest}
      />
    </div>
  );
}
