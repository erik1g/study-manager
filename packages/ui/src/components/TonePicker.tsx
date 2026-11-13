import { useId } from "react";
import { cx } from "../cx";
import { uiText } from "../text";
import { TONES, type Tone } from "../tokens";

export interface TonePickerProps {
  /** What the colour is for, e.g. "Course colour". */
  label: string;
  /** The chosen tone; null for none. */
  value: Tone | null;
  onChange: (tone: Tone | null) => void;
  /** Offers "no colour" as a last choice. */
  allowNone?: boolean;
  className?: string;
}

/** One of the eight subject colours, as round swatches. Arrow keys move between them. */
export function TonePicker({ label, value, onChange, allowNone, className }: TonePickerProps) {
  const name = useId();
  const choices: (Tone | null)[] = allowNone ? [...TONES, null] : [...TONES];
  return (
    <div role="radiogroup" aria-label={label} className={cx("ui-tonepicker", className)}>
      {choices.map((tone) => (
        <label key={tone ?? "none"} className="ui-tone-choice" title={tone ? uiText().tones[tone] : uiText().noColour}>
          <input type="radio" name={name} checked={value === tone} onChange={() => onChange(tone)} />
          <span className={cx("ui-tone-swatch", tone ? `ui-tone-${tone}` : "ui-tone-none")} aria-hidden="true" />
          <span className="ui-visually-hidden">{tone ? uiText().tones[tone] : uiText().noColour}</span>
        </label>
      ))}
    </div>
  );
}
