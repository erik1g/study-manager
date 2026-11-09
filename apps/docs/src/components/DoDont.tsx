import type { ReactNode } from "react";

/** A good and a bad use next to each other. */
export function DoDont({ children }: { children: ReactNode }) {
  return <div className="doc-dodont">{children}</div>;
}

export function Do({ children, caption }: { children: ReactNode; caption: ReactNode }) {
  return (
    <div className="doc-do">
      <div className="doc-do-stage">{children}</div>
      <div className="doc-do-caption">
        <strong>✓ So</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}

export function Dont({ children, caption }: { children: ReactNode; caption: ReactNode }) {
  return (
    <div className="doc-dont">
      <div className="doc-do-stage">{children}</div>
      <div className="doc-do-caption">
        <strong>✗ Nicht so</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}
