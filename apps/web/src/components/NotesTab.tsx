// The notes of a subject beside its scripts: the shared notes, which follow
// the page of the script in view, and the member's private notes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { atLeast } from "@study/shared";
import { Button, EmptyState, Notice, SegmentedControl, Select, Switch, TextArea } from "@study/ui";
import { t, errorMessage, formatDateTime } from "../i18n";
import { usePinchZoom } from "../lib/pinch";
import { api, NotesConflictError, type Course, type CourseFile, type Notes } from "../lib/api";
import { Avatar } from "./Avatar";
import { DocumentViewer } from "./DocumentViewer";
import { Rich } from "./Rich";

/** A part of the notes from one heading to the next. */
interface Section {
  key: string;
  level: number;
  title: string;
  /** The script and page its marker names, if any. */
  script: string | null;
  page: number | null;
  text: string;
}

/** Cuts the notes at their headings and reads the markers below them. */
export function sections(text: string): Section[] {
  const result: Section[] = [];
  let current: Section = { key: "start", level: 0, title: "", script: null, page: null, text: "" };
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (heading) {
      result.push(current);
      const marker = lines[index + 1]?.match(/^<!--(.*)-->$/)?.[1] ?? "";
      const script = marker.match(/skript:\s*([^#·\s]+)(?:#(\d+))?/);
      current = {
        key: `${index}`,
        level: heading[1]!.length,
        title: heading[2]!,
        script: script?.[1] ?? null,
        page: script?.[2] ? Number(script[2]) : null,
        text: `${line}\n`,
      };
    } else {
      current.text += `${line}\n`;
    }
  });
  result.push(current);
  return result.filter((s) => s.text.trim());
}

/** The section the given script page belongs to: the last one starting on or before it. */
export function sectionFor(all: Section[], script: string, page: number): Section | null {
  let found: Section | null = null;
  for (const section of all) if (section.script === script && section.page !== null && section.page <= page) found = section;
  return found;
}

type SaveState = "saved" | "saving" | "dirty" | "conflict" | "error";


export interface NotesPaneProps {
  course: Course;
  /** The script and page in view beside the notes, for "Mitlaufen". */
  followScript: string | null;
  followPage: number | null;
  /** A heading that names a script page was clicked. */
  onOpenSection: (section: { script: string; page: number | null }) => void;
  /** Text size as a factor (1 = usual). */
  zoom?: number;
  onZoom?: (zoom: number) => void;
  /** More controls at the end of the bar, e.g. zoom buttons. */
  tools?: React.ReactNode;
}

/** The notes of a subject: shared and private, read or written. */
export function NotesPane({ course, followScript, followPage, onOpenSection, zoom, onZoom, tools }: NotesPaneProps) {
  const [which, setWhich] = useState<"shared" | "private">("shared");
  const [writing, setWriting] = useState(false);
  const [follow, setFollow] = useState(true);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [text, setText] = useState("");
  const [privateText, setPrivateText] = useState("");
  const [state, setState] = useState<SaveState>("saved");
  const [conflict, setConflict] = useState<Notes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = atLeast(course.role, "editor");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pane = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  usePinchZoom(root, zoom ?? 1, onZoom);
  // What a closing pane still has to save.
  const unsaved = useRef<{ which: "shared" | "private"; text: string; notes: Notes | null } | null>(null);

  useEffect(() => {
    api.notes(course.id).then((n) => {
      setNotes(n);
      setText(n.content);
    }, (e) => setError(errorMessage(e)));
    api.privateNotes(course.id).then((n) => setPrivateText(n.content));
  }, [course.id]);

  const save = useCallback(
    async (content: string, base: Notes) => {
      setState("saving");
      try {
        const saved = await api.saveNotes(course.id, content, base.version);
        setNotes(saved);
        setState("saved");
        unsaved.current = null;
      } catch (e) {
        if (e instanceof NotesConflictError) {
          setConflict(e.current);
          setState("conflict");
        } else {
          setError(errorMessage(e));
          setState("error");
        }
      }
    },
    [course.id],
  );

  const edit = (value: string) => {
    if (which === "private") {
      setPrivateText(value);
      setState("dirty");
      unsaved.current = { which: "private", text: value, notes: null };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () =>
          api.savePrivateNotes(course.id, value).then(
            () => {
              setState("saved");
              unsaved.current = null;
            },
            (e) => setError(errorMessage(e)),
          ),
        1200,
      );
      return;
    }
    setText(value);
    if (state === "conflict") return;
    setState("dirty");
    unsaved.current = { which: "shared", text: value, notes };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => notes && void save(value, notes), 1500);
  };

  // Closing the pane (leaving the lecture mode, another tab) must not lose what was typed a moment ago.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      const pending = unsaved.current;
      if (!pending) return;
      if (pending.which === "private") void api.savePrivateNotes(course.id, pending.text).catch(() => {});
      else if (pending.notes) void api.saveNotes(course.id, pending.text, pending.notes.version).catch(() => {});
    },
    [course.id],
  );

  // Leaving with unsaved changes would lose them.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (state === "dirty" || state === "saving") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  // Readers see the shared notes but cannot write them.
  const editing = writing && (which === "private" || canEdit);

  const parts = useMemo(() => sections(which === "shared" ? text : privateText), [text, privateText, which]);
  const current = follow && followScript && followPage ? sectionFor(parts, followScript, followPage) : null;

  useEffect(() => {
    if (!current || editing) return;
    pane.current?.querySelector(`[data-key="${current.key}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current?.key, editing]);

  return (
    <section className="notes-pane" ref={root} style={zoom === undefined ? undefined : ({ "--notes-zoom": zoom } as React.CSSProperties)}>
      <div className="notes-bar">
        <SegmentedControl
          label={t.notes.which}
          size="sm"
          value={which}
          onChange={setWhich}
          options={[
            { value: "shared", label: t.notes.shared, icon: "people" },
            { value: "private", label: t.notes.private, icon: "lock" },
          ]}
        />
        {(which === "private" || canEdit) && (
          <SegmentedControl
            label={t.notes.mode}
            size="sm"
            value={editing ? "write" : "read"}
            onChange={(value) => setWriting(value === "write")}
            options={[
              { value: "read", label: t.notes.read, icon: "eye" },
              { value: "write", label: t.notes.write, icon: "edit" },
            ]}
          />
        )}
        <Switch label={t.notes.follow} checked={follow} onChange={(e) => setFollow(e.target.checked)} className="notes-follow" />
        <span className="spacer" />
        <span className="quiet small notes-state">
          {state === "saved" && which === "shared" && notes?.updatedBy && <Avatar userId={notes.updatedById} name={notes.updatedBy} size={16} />}
          {state === "saving" ? t.notes.saving : state === "dirty" ? "…" : state === "saved" && which === "shared" && notes?.updatedBy ? t.notes.lastBy(notes.updatedBy, formatDateTime(notes.updatedAt!)) : ""}
        </span>
        {tools}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {conflict && which === "shared" && (
        <Notice
          tone="warning"
          action={
            <div className="notice-actions">
            <Button
              size="sm"
              onClick={() => {
                setText(conflict.content);
                setNotes(conflict);
                setConflict(null);
                setState("saved");
              }}
            >
              {t.notes.takeTheirs}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                const base = conflict;
                setConflict(null);
                await save(text, base);
              }}
            >
              {t.notes.keepMine}
            </Button>
            </div>
          }
        >
          {t.notes.conflict(conflict.updatedBy ?? "?")}
        </Notice>
      )}
      <div className="notes-body" ref={pane}>
        {editing ? (
          <TextArea
            label={which === "shared" ? t.notes.shared : t.notes.private}
            hideLabel
            className="notes-editor"
            value={which === "shared" ? text : privateText}
            onChange={(e) => edit(e.target.value)}
            spellCheck
            placeholder={which === "private" ? t.notes.privatePlaceholder : undefined}
          />
        ) : parts.length === 0 ? (
          <EmptyState variant="plain" size="sm" illustration="pflanze" title={which === "private" ? t.notes.private : t.notes.empty}>
            {which === "private" ? t.notes.privateEmpty : null}
          </EmptyState>
        ) : (
          parts.map((section) => (
            <div
              key={section.key}
              data-key={section.key}
              className={`notes-section ${current?.key === section.key ? "current" : ""} ${section.script ? "linked" : ""}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("h2, h3") && section.script) onOpenSection({ script: section.script, page: section.page });
              }}
            >
              <Rich>{section.text}</Rich>
            </div>
          ))
        )}
      </div>
      {which === "shared" && !editing && <p className="quiet small notes-hint">{t.notes.claudeHint}</p>}
    </section>
  );
}

export function NotesTab({ course, onLecture }: { course: Course; onLecture?: (file: CourseFile | null) => void }) {
  const [scripts, setScripts] = useState<CourseFile[]>([]);
  const [script, setScript] = useState<CourseFile | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const [visiblePage, setVisiblePage] = useState<number | null>(null);

  useEffect(() => {
    api.files(course.id).then((all) => {
      const list = all.filter((f) => f.folder === "skripte" && /\.pdf$/i.test(f.name));
      setScripts(list);
      setScript((current) => current ?? list[0] ?? null);
    });
  }, [course.id]);

  const openSection = ({ script: id, page: target }: { script: string; page: number | null }) => {
    const file = scripts.find((s) => s.id === id);
    if (!file) return;
    setScript(file);
    setPage(target);
  };

  return (
    <div className="work-split notes-split">
      <section className="work-pane">
        {scripts.length > 0 ? (
          <>
            {script && (
              <DocumentViewer
                key={script.id}
                file={script}
                page={page}
                onPageChange={setVisiblePage}
                actions={
                  <>
                    {scripts.length > 1 && (
                      <Select label={t.notes.script} hideLabel size="sm" value={script.id} onChange={(e) => setScript(scripts.find((s) => s.id === e.target.value) ?? null)}>
                        {scripts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    )}
                    {onLecture && (
                      <Button size="sm" icon="expand" onClick={() => onLecture(script)}>
                        {t.lecture.enter}
                      </Button>
                    )}
                  </>
                }
              />
            )}
          </>
        ) : (
          <EmptyState variant="plain" size="sm" illustration="buecher" title={t.notes.noScriptsTitle}>
            {t.notes.noScripts}
          </EmptyState>
        )}
      </section>
      <NotesPane course={course} followScript={script?.id ?? null} followPage={visiblePage} onOpenSection={openSection} />
    </div>
  );
}
