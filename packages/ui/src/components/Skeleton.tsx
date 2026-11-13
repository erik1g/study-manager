import type { CSSProperties } from "react";
import { cx } from "../cx";
import { uiText } from "../text";

export interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  /** text – a line of text; block – a card; circle – an avatar or ring. */
  shape?: "text" | "block" | "circle";
  className?: string;
}

/** Stands in for something that is loading, in its shape. */
export function Skeleton({ width, height, shape = "text", className }: SkeletonProps) {
  return <span className={cx("ui-skeleton", `ui-skeleton-${shape}`, className)} style={{ width, height }} aria-hidden="true" />;
}

/** Stands in for a whole page while it loads: a heading and a few cards. */
export function PageSkeleton({ label = uiText().loading }: { label?: string }) {
  return (
    <div className="ui-page-skeleton" aria-busy="true" role="status" aria-label={label}>
      <Skeleton width="40%" height={40} />
      <div className="ui-page-skeleton-grid">
        <Skeleton shape="block" height={220} />
        <Skeleton shape="block" height={220} />
      </div>
      <Skeleton shape="block" height={140} />
    </div>
  );
}
