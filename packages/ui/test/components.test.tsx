import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Avatar,
  Breadcrumb,
  Button,
  Checkbox,
  fileKind,
  ICON_NAMES,
  Icon,
  IconButton,
  ILLUSTRATION_KINDS,
  Illustration,
  initials,
  LinkButton,
  ListRow,
  ProgressRing,
  setUiText,
  Tabs,
  TextField,
  TonePicker,
  toneFor,
  uiText,
} from "../src/index";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("the buttons", () => {
  it("are plain buttons unless they submit, and say when they are busy", () => {
    expect(html(<Button>Speichern</Button>)).toContain('type="button"');
    const busy = html(
      <Button variant="primary" loading>
        Speichern
      </Button>,
    );
    expect(busy).toContain("disabled");
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain("ui-button-primary");
  });

  it("name an icon-only button for screen readers", () => {
    const out = html(<IconButton icon="more" label="Weitere Aktionen" />);
    expect(out).toContain('aria-label="Weitere Aktionen"');
    expect(out).toContain('aria-hidden="true"');
  });

  it("take a router link as the element of a link button", () => {
    const Fake = ({ to, ...rest }: { to: string; className?: string; children?: React.ReactNode }) => <a data-to={to} {...rest} />;
    expect(html(<LinkButton as={Fake} to="/faecher">Fächer</LinkButton>)).toContain('data-to="/faecher"');
  });
});

describe("the fields", () => {
  it("join label, help and error to the input", () => {
    const out = html(<TextField id="t" label="Titel" hint="Kurz und klar" error="Fehlt noch" />);
    expect(out).toContain('<label for="t"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('aria-describedby="t-error t-hint"');
  });

  it("keep a checkbox a real checkbox", () => {
    expect(html(<Checkbox label="Erledigt" defaultChecked />)).toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
  });
});

describe("navigation", () => {
  it("marks the current tab and the current page of a path", () => {
    const tabs = html(
      <Tabs
        label="Bereiche"
        active="b"
        items={[
          { id: "a", label: "A", href: "/a" },
          { id: "b", label: "B", href: "/b" },
        ]}
      />,
    );
    expect(tabs).toContain('aria-current="page" href="/b"');
    expect(tabs.match(/aria-current/g)).toHaveLength(1);
    const path = html(<Breadcrumb items={[{ label: "Fächer", href: "/faecher" }, { label: "Regelungstechnik" }]} />);
    expect(path).toContain('aria-current="page">Regelungstechnik');
  });

  it("makes a whole row a link without nesting interactive parts", () => {
    const out = html(<ListRow title="Skript" href="/datei" />);
    expect(out).toMatch(/^<li[^>]*><a [^>]*href="\/datei"/);
  });
});

describe("pictures", () => {
  it("draws every icon and every scene", () => {
    for (const name of ICON_NAMES) expect(html(<Icon name={name} />)).toContain("<svg");
    for (const kind of ILLUSTRATION_KINDS) expect(html(<Illustration kind={kind} />)).toContain("<svg");
  });

  it("gives a person initials and the same colour every time", () => {
    expect(initials("Mira Hansen")).toBe("MH");
    expect(initials("  ")).toBe("?");
    expect(toneFor("abc")).toBe(toneFor("abc"));
    expect(html(<Avatar name="Mira Hansen" />)).toContain('aria-label="Mira Hansen"');
  });

  it("tells files apart by name and type", () => {
    expect(fileKind("Skript.PDF")).toBe("pdf");
    expect(fileKind("notes.docx")).toBe("word");
    expect(fileKind("aufnahme", "audio/webm")).toBe("audio");
    expect(fileKind("x.zip")).toBe("other");
  });

  it("says how far a ring has come", () => {
    expect(html(<ProgressRing value={0.62} label="62 Prozent" />)).toContain('aria-label="62 Prozent"');
  });
});

describe("the building blocks' own words", () => {
  it("are English, and an app can hand over its own", () => {
    expect(html(<TonePicker label="Colour" value={null} onChange={() => {}} allowNone />)).toContain("No colour");
    setUiText({ noColour: "Keine Farbe", tones: { ...uiText().tones, blau: "Blau" } });
    try {
      const picker = html(<TonePicker label="Farbe" value={null} onChange={() => {}} allowNone />);
      expect(picker).toContain("Keine Farbe");
      expect(picker).toContain("Blau");
    } finally {
      setUiText({ noColour: "No colour", tones: { ...uiText().tones, blau: "Blue" } });
    }
  });
});
