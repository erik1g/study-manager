import type { ReactNode } from "react";
import { cx } from "../cx";
import { STATUS } from "../tokens";
import { Icon, type IconName } from "./Icon";

export type NoticeTone = keyof typeof STATUS;

const ICON: Record<NoticeTone, IconName> = { info: "info", success: "check-circle", warning: "warning", danger: "warning" };

export interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  /** A button or link at the end, e.g. "Try again". */
  action?: ReactNode;
  className?: string;
}

/** A message that stays on the page: what went wrong, what to know, what worked. For a short "Saved" use `toast`. */
export function Notice({ tone = "info", title, children, action, className }: NoticeProps) {
  return (
    <div className={cx("ui-notice", `ui-tone-${STATUS[tone]}`, className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon name={ICON[tone]} size={20} className="ui-notice-icon" />
      <div className="ui-notice-text">
        {title && <p className="ui-notice-title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="ui-notice-action">{action}</div>}
    </div>
  );
}
