import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { Button, IconButton } from "./Button";
import { Notice } from "./Notice";
import { uiText } from "../text";

export interface DialogProps {
  title: ReactNode;
  /** A sentence below the title. */
  description?: ReactNode;
  /** Escape, the close button and the Cancel of a footer call it; remove the dialog then. */
  onClose: () => void;
  children?: ReactNode;
  /** The buttons at the bottom: Cancel first, the main action last. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hides the close button at the top, e.g. while something is being saved. */
  hideClose?: boolean;
  /** Keeps the title for screen readers only, for dialogs whose content says enough (the search). */
  hideTitle?: boolean;
  /** top – near the top of the window, for the search, so the results have room below. */
  placement?: "center" | "top";
  /** Whether a click beside the dialog closes it. Default yes. */
  closeOnBackdrop?: boolean;
  className?: string;
}

/** A question or a small form above the page. Shown while it is rendered. */
export function Dialog({ title, description, onClose, children, footer, size = "md", hideClose, hideTitle, placement = "center", closeOnBackdrop = true, className }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => opener?.focus?.();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={cx("ui-dialog", `ui-size-${size}`, placement === "top" && "ui-dialog-top", hideTitle && hideClose && "ui-dialog-bare", className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget && closeOnBackdrop) onClose();
      }}
    >
      <div className={cx("ui-dialog-head", hideTitle && hideClose && "ui-visually-hidden")}>
        <div>
          <h2 id={titleId} className={cx("ui-dialog-title", hideTitle && "ui-visually-hidden")}>
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="ui-dialog-description">
              {description}
            </p>
          )}
        </div>
        {!hideClose && <IconButton icon="close" label={uiText().close} size="sm" onClick={onClose} />}
      </div>
      {children && <div className="ui-dialog-body">{children}</div>}
      {footer && <div className="ui-dialog-footer">{footer}</div>}
    </dialog>
  );
}

export interface ConfirmDialogProps {
  title: ReactNode;
  /** What happens, and whether it can be undone. */
  children: ReactNode;
  /** The button's verb, e.g. "Delete". */
  confirm: string;
  cancel?: string;
  /** Red, for deleting and leaving. */
  danger?: boolean;
  /** Runs when confirmed; the dialog stays open with the error when it fails. */
  onConfirm: () => Promise<unknown> | unknown;
  onClose: () => void;
  /** Turns an error into a sentence. Default its message. */
  describeError?: (error: unknown) => string;
}

/** Asks before something that cannot be undone easily. Cancel has the focus, so Enter does no harm. */
export function ConfirmDialog({ title, children, confirm, cancel = uiText().cancel, danger, onConfirm, onClose, describeError }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onClose}
      hideClose={busy}
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button onClick={onClose} autoFocus disabled={busy}>
            {cancel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError(describeError ? describeError(e) : e instanceof Error ? e.message : String(e));
                setBusy(false);
              }
            }}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <div className="ui-stack">
        <div>{children}</div>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}
