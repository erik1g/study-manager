import { useId, type InputHTMLAttributes, type Ref } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

interface Common {
  /** What is searched, e.g. "In allen Fächern suchen". Hidden from the eye; the placeholder shows it. */
  label: string;
  /** A keyboard shortcut shown at the end, e.g. "⌘K". */
  shortcut?: string;
  size?: "md" | "lg";
  className?: string;
}

export interface SearchFieldProps extends Common, Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** Shows a clear button while there is text. */
  onClear?: () => void;
  ref?: Ref<HTMLInputElement>;
}

/** A field to search as you type, pill-shaped with the magnifier in front. */
export function SearchField({ label, shortcut, size = "md", className, onClear, placeholder, id, value, ...rest }: SearchFieldProps) {
  const own = useId();
  const inputId = id ?? own;
  return (
    <div className={cx("ui-search", `ui-size-${size}`, className)} role="search">
      <label htmlFor={inputId} className="ui-visually-hidden">
        {label}
      </label>
      <Icon name="search" size={18} className="ui-control-icon" />
      <input id={inputId} type="search" className="ui-input" placeholder={placeholder ?? `${label} …`} value={value} {...rest} />
      {onClear && value ? (
        <button type="button" className="ui-search-clear" aria-label="Suche leeren" onClick={onClear}>
          <Icon name="close" size={16} />
        </button>
      ) : (
        shortcut && <kbd className="ui-kbd">{shortcut}</kbd>
      )}
    </div>
  );
}

export interface SearchButtonProps extends Common {
  /** Opens the search, e.g. the command palette. */
  onOpen: () => void;
  /** The text shown in the field. Default: the label with "…". */
  placeholder?: string;
}

/** Looks like a search field and opens a search elsewhere when pressed. */
export function SearchButton({ label, shortcut, size = "md", className, onOpen, placeholder }: SearchButtonProps) {
  return (
    <button type="button" className={cx("ui-search", "ui-search-button", `ui-size-${size}`, className)} onClick={onOpen} aria-keyshortcuts={shortcut ? shortcut.replace("⌘", "Meta+") : undefined}>
      <Icon name="search" size={18} className="ui-control-icon" />
      <span className="ui-search-placeholder">{placeholder ?? `${label} …`}</span>
      {shortcut && <kbd className="ui-kbd">{shortcut}</kbd>}
    </button>
  );
}
