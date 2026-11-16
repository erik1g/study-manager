import { dark, FILLED_ICON_NAMES, Icon, ICON_NAMES, Illustration, ILLUSTRATION_KINDS, kebab, light, scale, SearchField, TONE_NAMES, TONES, toast, Toaster } from "@study/ui";
import { useState } from "react";

/** The neutral colours of one theme. */
export function Neutrals({ theme }: { theme: "light" | "dark" }) {
  const values = (theme === "light" ? light : dark).neutrals;
  const shown = ["bg", "surface", "sunken", "ink", "muted", "line", "lineSoft", "focus"] as const;
  return (
    <div className="doc-swatches">
      {shown.map((name) => (
        <div key={name} className="doc-swatch">
          <div className="doc-swatch-color" style={{ background: values[name] }} />
          <div className="doc-swatch-text">
            <code>--ui-{kebab(name)}</code>
            <br />
            <code>{values[name]}</code>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The eight subject colours with their four steps, in one theme. */
export function Tones({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className={`doc-swatches ui-theme-${theme}`} style={{ background: "var(--ui-bg)", padding: 12, borderRadius: 24 }}>
      {TONES.map((tone) => {
        const steps = (theme === "light" ? light : dark).tones[tone];
        return (
          <div key={tone} className="doc-tone" style={{ background: steps.tint, color: steps.ink }}>
            <div className="doc-tone-top" style={{ background: `radial-gradient(120% 100% at 100% 0%, ${steps.glow}, ${steps.tint} 70%)` }}>
              <strong style={{ fontFamily: "var(--ui-font-display)", fontSize: 18 }}>{TONE_NAMES[tone]}</strong>
              <span className="doc-tone-dot" style={{ background: steps.strong }} />
            </div>
            <div className="doc-tone-body">
              <code style={{ background: "none", padding: 0, border: 0, color: "inherit" }}>{tone}</code>
              <br />
              tint {steps.tint}
              <br />
              ink {steps.ink}
              <br />
              strong {steps.strong}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TypeScale() {
  return (
    <div className="doc-scale">
      {Object.entries(scale.display)
        .reverse()
        .map(([name, px]) => (
          <div key={name} className="doc-scale-row">
            <span className="doc-scale-name">--ui-display-{name} · {px}px</span>
            <span style={{ fontFamily: "var(--ui-font-display)", fontWeight: 800, fontSize: px, lineHeight: 1.1, letterSpacing: "-0.01em" }}>Your courses</span>
          </div>
        ))}
      {Object.entries(scale.text)
        .reverse()
        .map(([name, px]) => (
          <div key={name} className="doc-scale-row">
            <span className="doc-scale-name">--ui-text-{name} · {px}px</span>
            <span style={{ fontSize: px }}>Exercise sheet 4 · Engineering Mechanics</span>
          </div>
        ))}
    </div>
  );
}

export function SpaceScale() {
  return (
    <div className="doc-scale">
      {Object.entries(scale.space).map(([name, px]) => (
        <div key={name} className="doc-scale-row">
          <span className="doc-scale-name">--ui-space-{name} · {px}px</span>
          <span className="doc-bar" style={{ width: px }} />
        </div>
      ))}
    </div>
  );
}

export function RadiusScale() {
  return (
    <div className="doc-scale" style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
      {Object.entries(scale.radius).map(([name, px]) => (
        <div key={name} style={{ textAlign: "center" }}>
          <div className="doc-radius" style={{ borderRadius: Math.min(px, 32) }} />
          <span className="doc-scale-name" style={{ width: "auto" }}>
            {name} · {px === 999 ? "rund" : `${px}px`}
          </span>
        </div>
      ))}
    </div>
  );
}

/** All icons, searchable; a click copies the code. */
export function IconGallery() {
  const [query, setQuery] = useState("");
  const shown = ICON_NAMES.filter((name) => name.includes(query.trim().toLowerCase()));
  return (
    <>
      <Toaster />
      <SearchField label="Search icons" className="doc-icons-search" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
      <div className="doc-icons">
        {shown.map((name) => (
          <button
            key={name}
            type="button"
            className="doc-icon"
            title={`Copy <Icon name="${name}" />`}
            onClick={async () => {
              await navigator.clipboard.writeText(`<Icon name="${name}" />`);
              toast(`<Icon name="${name}" /> copied`, "success");
            }}
          >
            <span style={{ display: "flex", gap: 8 }}>
              <Icon name={name} size={24} />
              {FILLED_ICON_NAMES.includes(name) && <Icon name={name} size={24} filled />}
            </span>
            {name}
          </button>
        ))}
      </div>
    </>
  );
}

export function IllustrationGallery({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className={`doc-illustrations ui-theme-${theme}`} style={{ background: "var(--ui-bg)", padding: 12, borderRadius: 26 }}>
      {ILLUSTRATION_KINDS.map((kind) => (
        <figure key={kind} className="doc-illustration">
          <Illustration kind={kind} />
          <figcaption>{kind}</figcaption>
        </figure>
      ))}
    </div>
  );
}
