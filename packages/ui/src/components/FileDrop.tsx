import { useId, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface FileDropProps {
  /** What to do here, e.g. "Upload files". */
  label: ReactNode;
  /** Which files and how large, e.g. "PDF, Word, images · up to 95 MB". */
  hint?: ReactNode;
  /** As for `<input type=file>`, e.g. ".pdf,.docx,image/*". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
}

/** A place to drop files onto, or to press to choose them. */
export function FileDrop({ label, hint, accept, multiple = true, disabled, onFiles, className }: FileDropProps) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      className={cx("ui-filedrop", over && "ui-over", disabled && "ui-disabled", className)}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (disabled) return;
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <input
        id={id}
        type="file"
        className="ui-visually-hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <span className="ui-filedrop-icon" aria-hidden="true">
        <Icon name="upload" size={24} />
      </span>
      <span className="ui-filedrop-label">{label}</span>
      {hint && <span className="ui-filedrop-hint">{hint}</span>}
    </label>
  );
}
