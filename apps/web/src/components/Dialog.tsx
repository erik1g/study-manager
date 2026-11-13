// Dialogs as the app uses them, made of the building blocks.
import { useState, type ReactNode } from "react";
import { ConfirmDialog as UiConfirmDialog, Dialog as UiDialog, IconButton, TextField } from "@study/ui";
import { t, errorMessage } from "../i18n";

/** A modal dialog; closing it (Escape, Cancel) calls `onClose`. */
export function Dialog({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  return (
    <UiDialog title={title} onClose={onClose} size={wide ? "lg" : "md"} footer={footer}>
      {children}
    </UiDialog>
  );
}

/** Asks before something that cannot be undone easily. */
export function ConfirmDialog(props: { title: string; text: ReactNode; confirm: string; danger?: boolean; onConfirm: () => Promise<unknown>; onClose: () => void }) {
  return (
    <UiConfirmDialog
      title={props.title}
      confirm={props.confirm}
      cancel={t.common.cancel}
      danger={props.danger}
      onConfirm={props.onConfirm}
      onClose={props.onClose}
      describeError={errorMessage}
    >
      {props.text}
    </UiConfirmDialog>
  );
}

/** A value with a copy button, for links and keys. */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <TextField
      label={label ?? t.common.copy}
      hideLabel={!label}
      readOnly
      value={value}
      className="mono-field"
      onFocus={(e) => e.target.select()}
      trailing={
        <IconButton
          icon={copied ? "check" : "copy"}
          label={copied ? t.common.copied : t.common.copy}
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        />
      }
    />
  );
}
