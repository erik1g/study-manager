import { cx } from "../cx";
import type { Tone } from "../tokens";

export interface ProgressBarProps {
  /** How far, from 0 to 1. */
  value: number;
  /** What is in progress, e.g. "Transcription". Read with the percentage. */
  label: string;
  tone?: Tone;
  /** Shows the percentage next to the label. */
  showValue?: boolean;
  className?: string;
}

/** How far a longer job has come, as a bar: uploading, transcribing. For a subject's progress use `ProgressRing`. */
export function ProgressBar({ value, label, tone = "blau", showValue = true, className }: ProgressBarProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className={cx("ui-progress", `ui-tone-${tone}`, className)}>
      <div className="ui-progress-text">
        <span>{label}</span>
        {showValue && <span className="ui-progress-value">{percent} %</span>}
      </div>
      <div className="ui-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="ui-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
