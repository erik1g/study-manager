import { useId } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "./Icon";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  /** What is chosen, for screen readers. */
  label: string;
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Shows only the icons; the labels stay for screen readers. */
  iconsOnly?: boolean;
  className?: string;
}

/** Two to four choices side by side, one of them chosen, e.g. Hell · Dunkel · System. Arrow keys move between them. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, size = "md", iconsOnly, className }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cx("ui-segmented", `ui-size-${size}`, className)}>
      {options.map((option) => (
        <label key={option.value} className="ui-segment" title={iconsOnly ? option.label : undefined}>
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
          <span className="ui-segment-face">
            {option.icon && <Icon name={option.icon} size={18} />}
            <span className={iconsOnly ? "ui-visually-hidden" : undefined}>{option.label}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
