import type { ReactNode } from "react";

/** Shows the same thing in light and dark side by side. */
export function Preview({ children, column = false }: { children: ReactNode; column?: boolean }) {
  return (
    <div className="doc-preview">
      {(["light", "dark"] as const).map((theme) => (
        <div key={theme} className={`doc-preview-pane ui-theme-${theme}${column ? " column" : ""}`}>
          <p className="doc-preview-label">{theme === "light" ? "Hell" : "Dunkel"}</p>
          {children}
        </div>
      ))}
    </div>
  );
}
