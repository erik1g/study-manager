import { useEffect, useState } from "react";
import { cx } from "../cx";
import { STATUS } from "../tokens";
import { Icon } from "./Icon";

/** The event that carries a toast; its detail is the text, or the text and a tone. */
export const TOAST_EVENT = "study:toast";

type ToastTone = "info" | "success" | "danger";
interface ToastMessage {
  text: string;
  tone?: ToastTone;
}

/** Shows a short message at the bottom that goes away by itself, e.g. "Gespeichert". Needs a `Toaster` on the page. */
export function toast(text: string, tone?: ToastTone) {
  window.dispatchEvent(new CustomEvent<ToastMessage | string>(TOAST_EVENT, { detail: tone ? { text, tone } : text }));
}

/** Where toasts appear; once per app. */
export function Toaster({ duration = 2800 }: { duration?: number }) {
  const [message, setMessage] = useState<(ToastMessage & { key: number }) | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => {
      const detail = (event as CustomEvent<ToastMessage | string>).detail;
      setMessage({ ...(typeof detail === "string" ? { text: detail } : detail), key: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), duration);
    };
    window.addEventListener(TOAST_EVENT, show);
    return () => {
      window.removeEventListener(TOAST_EVENT, show);
      clearTimeout(timer);
    };
  }, [duration]);
  return (
    <div className="ui-toaster" role="status" aria-live="polite">
      {message && (
        <div key={message.key} className={cx("ui-toast", message.tone && message.tone !== "info" && `ui-tone-${STATUS[message.tone]}`)}>
          {message.tone === "success" && <Icon name="check-circle" size={18} />}
          {message.tone === "danger" && <Icon name="warning" size={18} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
