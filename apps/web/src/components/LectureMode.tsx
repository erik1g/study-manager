// The lecture mode: a subject's scripts and notes over the whole browser window,
// as tabs, one pane or two side by side. What is open is kept per subject on this device.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, FileTile, fileKind, IconButton, List, ListRow, SearchField } from "@study/ui";
import { t } from "../i18n";
import { api, type Course, type CourseFile } from "../lib/api";
import { useMedia } from "../lib/media";
import { clampZoom } from "../lib/pinch";
import { readStored, useStored, writeStored } from "../lib/stored";
import { ContextMenu, MenuItem, type MenuPosition } from "./ContextMenu";
import { Dialog } from "./Dialog";
import { DocumentViewer } from "./DocumentViewer";
import { NotesPane } from "./NotesTab";

/** A tab is "notes" or "file:<id>". */
type TabId = string;
const NOTES: TabId = "notes";
const fileTab = (id: string): TabId => `file:${id}`;
const fileOf = (tab: TabId) => (tab.startsWith("file:") ? tab.slice(5) : null);

type Side = "left" | "right";

/** What is open: the tabs of the left and of the right half, and which one is in front of each. */
interface Workspace {
  split: boolean;
  left: TabId[];
  right: TabId[];
  activeLeft: TabId | null;
  activeRight: TabId | null;
  /** The tab used last; it is the one shown when there is only a single pane. */
  focus: TabId | null;
}

const EMPTY: Workspace = { split: false, left: [], right: [], activeLeft: null, activeRight: null, focus: null };

const sideOf = (ws: Workspace, tab: TabId): Side | null => (ws.left.includes(tab) ? "left" : ws.right.includes(tab) ? "right" : null);
const tabsOf = (ws: Workspace, side: Side) => (side === "left" ? ws.left : ws.right);
const withTabs = (ws: Workspace, side: Side, tabs: TabId[], active: TabId | null): Workspace =>
  side === "left" ? { ...ws, left: tabs, activeLeft: active } : { ...ws, right: tabs, activeRight: active };

/** Brings a tab to the front of its half, opening it in `side` first if it is not open. */
function show(ws: Workspace, tab: TabId, side: Side = "left"): Workspace {
  const where = sideOf(ws, tab) ?? side;
  const tabs = tabsOf(ws, where);
  const next = tabs.includes(tab) ? tabs : [...tabs, tab];
  return { ...withTabs(ws, where, next, tab), focus: tab };
}

function close(ws: Workspace, tab: TabId): Workspace {
  const where = sideOf(ws, tab);
  if (!where) return ws;
  const tabs = tabsOf(ws, where);
  const index = tabs.indexOf(tab);
  const rest = tabs.filter((t) => t !== tab);
  const active = where === "left" ? ws.activeLeft : ws.activeRight;
  const nextActive = active === tab ? (rest[Math.min(index, rest.length - 1)] ?? null) : active;
  const result = withTabs(ws, where, rest, nextActive);
  return { ...result, focus: ws.focus === tab ? (nextActive ?? result.activeLeft ?? result.activeRight) : ws.focus };
}

function move(ws: Workspace, tab: TabId): Workspace {
  const from = sideOf(ws, tab);
  if (!from) return ws;
  const to: Side = from === "left" ? "right" : "left";
  return show(close(ws, tab), tab, to);
}

function toggleSplit(ws: Workspace): Workspace {
  if (ws.split) return { ...ws, split: false };
  const opened = { ...ws, split: true };
  // Splitting with everything on one side: the notes (or else the last tab) go to the other.
  if (ws.right.length > 0 || ws.left.length < 2) return opened;
  const mover = ws.left.includes(NOTES) ? NOTES : ws.left[ws.left.length - 1]!;
  const moved = move(opened, mover);
  return { ...moved, focus: ws.focus };
}

/** Drops tabs of files that are gone. */
function prune(ws: Workspace, files: CourseFile[]): Workspace {
  let result = ws;
  for (const tab of [...ws.left, ...ws.right]) {
    const id = fileOf(tab);
    if (id && !files.some((f) => f.id === id)) result = close(result, tab);
  }
  return result;
}

/** Zoom buttons: smaller, back to the page width, larger. */
function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  return (
    <span className="zoom-controls">
      <IconButton icon="minus" size="sm" label={t.lecture.zoomOut} disabled={zoom <= 0.5} onClick={() => onZoom(clampZoom(zoom / 1.2))} />
      <Button size="sm" variant="ghost" title={t.lecture.zoomFit} aria-label={t.lecture.zoomFit} onClick={() => onZoom(1)}>
        {t.lecture.zoom(Math.round(zoom * 100))}
      </Button>
      <IconButton icon="plus" size="sm" label={t.lecture.zoomIn} disabled={zoom >= 3} onClick={() => onZoom(clampZoom(zoom * 1.2))} />
    </span>
  );
}

function FileBody({ file, page, report }: { file: CourseFile; page: number | null; report: (file: string, page: number) => void }) {
  const [zoom, setZoom] = useStored(`zoom.file.${file.id}`, 1);
  const onPage = useCallback((value: number) => report(file.id, value), [report, file.id]);
  return (
    <section className="work-pane">
      <DocumentViewer file={file} page={page} onPageChange={onPage} zoom={zoom} onZoom={setZoom} actions={<ZoomControls zoom={zoom} onZoom={setZoom} />} />
    </section>
  );
}

function NotesBody({ course, followScript, followPage, onOpenSection }: { course: Course; followScript: string | null; followPage: number | null; onOpenSection: (section: { script: string; page: number | null }) => void }) {
  const [zoom, setZoom] = useStored(`zoom.notes.${course.id}`, 1);
  return <NotesPane course={course} followScript={followScript} followPage={followPage} onOpenSection={onOpenSection} zoom={zoom} onZoom={setZoom} tools={<ZoomControls zoom={zoom} onZoom={setZoom} />} />;
}

export interface LectureModeProps {
  course: Course;
  /** A file to bring to the front on entry. */
  initialFile?: string | null;
  /** With the notes opened in the other half, beside that file. */
  withNotes?: boolean;
  /** Called once the entry request has been taken up. */
  onEntered?: () => void;
  onExit: () => void;
}

export function LectureMode({ course, initialFile, withNotes, onEntered, onExit }: LectureModeProps) {
  const storeKey = `lecture.${course.id}`;
  const [ws, setWs] = useState<Workspace>(() => ({ ...EMPTY, ...readStored<Workspace>(storeKey, EMPTY) }));
  const [files, setFiles] = useState<CourseFile[] | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<string, number | null>>({});
  const [mounted, setMounted] = useState<Set<TabId>>(() => new Set());
  const [picker, setPicker] = useState<Side | null>(null);
  const [menu, setMenu] = useState<{ tab: TabId; at: MenuPosition } | null>(null);
  const narrow = useMedia("(max-width: 899px)");
  const split = ws.split && !narrow;

  useEffect(() => {
    writeStored(storeKey, ws);
  }, [ws, storeKey]);

  useEffect(() => {
    void api.files(course.id).then(setFiles, () => setFiles([]));
  }, [course.id]);

  // Once the files are known: forget the tabs of deleted ones and take up the entry request.
  const entered = useRef(false);
  useEffect(() => {
    if (!files) return;
    // The updater below runs later, so the answer has to be taken now.
    const first = !entered.current;
    setWs((current) => {
      let next = prune(current, files);
      if (first && initialFile && files.some((f) => f.id === initialFile)) {
        next = show(next, fileTab(initialFile), "left");
        if (withNotes) next = { ...show(next, NOTES, "right"), split: true, focus: fileTab(initialFile) };
      }
      return next;
    });
    if (first) {
      entered.current = true;
      onEntered?.();
    }
  }, [files, initialFile, withNotes, onEntered]);

  // Esc leaves, unless a dialog or a menu is open: those take it first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (picker || menu || document.querySelector("dialog[open]")) return;
      onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, picker, menu]);

  const panes: { side: Side; tabs: TabId[]; active: TabId | null }[] = useMemo(() => {
    const frontOf = (tabs: TabId[], wanted: TabId | null) => (wanted && tabs.includes(wanted) ? wanted : (tabs[0] ?? null));
    if (split) return [
      { side: "left", tabs: ws.left, active: frontOf(ws.left, ws.activeLeft) },
      { side: "right", tabs: ws.right, active: frontOf(ws.right, ws.activeRight) },
    ];
    const all = [...ws.left, ...ws.right];
    return [{ side: "left", tabs: all, active: frontOf(all, ws.focus) }];
  }, [ws, split]);

  const visible = panes.map((p) => p.active).filter((t): t is TabId => t !== null);
  useEffect(() => {
    setMounted((current) => {
      if (visible.every((t) => current.has(t))) return current;
      return new Set([...current, ...visible]);
    });
  }, [visible.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useCallback((file: string, page: number) => setPages((current) => (current[file] === page ? current : { ...current, [file]: page })), []);

  // The notes follow the script in the other half; with one pane, the script looked at last.
  const [lastFile, setLastFile] = useState<string | null>(null);
  useEffect(() => {
    const id = ws.focus ? fileOf(ws.focus) : null;
    if (id) setLastFile(id);
  }, [ws.focus]);
  const followFor = (side: Side): string | null => {
    if (split) {
      const other = panes.find((p) => p.side !== side)?.active;
      return (other && fileOf(other)) || null;
    }
    return lastFile;
  };

  const openSection = (section: { script: string; page: number | null }) => {
    if (!files?.some((f) => f.id === section.script)) return;
    const tab = fileTab(section.script);
    setWs((current) => show(current, tab, "left"));
    setTargets((current) => ({ ...current, [section.script]: section.page }));
    setTimeout(() => setTargets((current) => ({ ...current, [section.script]: null })), 500);
  };

  const fileById = (id: string) => files?.find((f) => f.id === id) ?? null;
  const labelOf = (tab: TabId) => (tab === NOTES ? t.lecture.notes : (fileById(fileOf(tab)!)?.name ?? "…"));

  const choose = (tab: TabId) => {
    setWs((current) => show(current, tab, picker ?? "left"));
    setPicker(null);
  };

  return (
    <div className="lecture" role="region" aria-label={t.lecture.region}>
      <header className="lecture-bar">
        <IconButton icon="close" label={t.lecture.exit} onClick={onExit} />
        <span className="lecture-title">{course.title}</span>
        <span className="spacer" />
        {!narrow && (
          <Button size="sm" variant={ws.split ? "secondary" : "ghost"} icon="columns" aria-pressed={ws.split} onClick={() => setWs(toggleSplit)}>
            {t.lecture.split}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setWs(EMPTY)} disabled={ws.left.length + ws.right.length === 0}>
          {t.lecture.reset}
        </Button>
      </header>

      <div className={split ? "lecture-panes split" : "lecture-panes"}>
        {panes.map((pane) => (
          <section key={pane.side} className="lecture-pane" aria-label={pane.side === "left" ? t.lecture.tabs : undefined}>
            <div className="lecture-tabs" role="tablist" aria-label={t.lecture.tabs}>
              {pane.tabs.map((tab) => (
                <span key={tab} className={`lecture-tab ${tab === pane.active ? "active" : ""}`}>
                  <Button
                    size="sm"
                    variant={tab === pane.active ? "secondary" : "ghost"}
                    role="tab"
                    aria-selected={tab === pane.active}
                    title={labelOf(tab)}
                    onClick={() => setWs((current) => show(current, tab))}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({ tab, at: { x: event.clientX, y: event.clientY } });
                    }}
                    icon={tab === NOTES ? "note" : "file"}
                  >
                    <span className="lecture-tab-name">{labelOf(tab)}</span>
                  </Button>
                  <IconButton icon="close" size="sm" label={t.lecture.close(labelOf(tab))} onClick={() => setWs((current) => close(current, tab))} />
                </span>
              ))}
              <IconButton icon="plus" size="sm" label={t.lecture.open} onClick={() => setPicker(pane.side)} />
              <span className="spacer" />
              {split && pane.active && (
                <IconButton
                  icon={pane.side === "left" ? "arrow-right" : "arrow-left"}
                  size="sm"
                  label={pane.side === "left" ? t.lecture.moveToRight : t.lecture.moveToLeft}
                  onClick={() => setWs((current) => move(current, pane.active!))}
                />
              )}
            </div>
            <div className="lecture-content">
              {pane.tabs.length === 0 && files && (
                <EmptyState
                  variant="plain"
                  size="sm"
                  illustration="buecher"
                  title={t.lecture.emptyTitle}
                  actions={
                    <>
                      <Button variant="primary" icon="file" onClick={() => setPicker(pane.side)}>
                        {t.lecture.open}
                      </Button>
                      {!sideOf(ws, NOTES) && (
                        <Button icon="note" onClick={() => setWs((current) => show(current, NOTES, pane.side))}>
                          {t.lecture.openNotes}
                        </Button>
                      )}
                    </>
                  }
                >
                  {t.lecture.emptyText}
                </EmptyState>
              )}
              {pane.tabs
                .filter((tab) => tab === pane.active || mounted.has(tab))
                .map((tab) => {
                  const id = fileOf(tab);
                  const file = id ? fileById(id) : null;
                  return (
                    <div key={tab} className={tab === pane.active ? "lecture-body" : "lecture-body hidden"} role="tabpanel" aria-hidden={tab !== pane.active}>
                      {tab === NOTES ? (
                        <NotesBody course={course} followScript={followFor(pane.side)} followPage={followFor(pane.side) ? (pages[followFor(pane.side)!] ?? null) : null} onOpenSection={openSection} />
                      ) : file ? (
                        <FileBody file={file} page={targets[file.id] ?? null} report={report} />
                      ) : files ? (
                        <EmptyState variant="plain" size="sm" title={t.lecture.missing} />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {menu && (
        <ContextMenu at={menu.at} label={t.lecture.tabActions(labelOf(menu.tab))} onClose={() => setMenu(null)}>
          {split && (
            <MenuItem
              icon={sideOf(ws, menu.tab) === "left" ? "arrow-right" : "arrow-left"}
              onSelect={() => {
                const tab = menu.tab;
                setMenu(null);
                setWs((current) => move(current, tab));
              }}
            >
              {sideOf(ws, menu.tab) === "left" ? t.lecture.moveToRight : t.lecture.moveToLeft}
            </MenuItem>
          )}
          <MenuItem
            icon="close"
            onSelect={() => {
              const tab = menu.tab;
              setMenu(null);
              setWs((current) => close(current, tab));
            }}
          >
            {t.lecture.close(labelOf(menu.tab))}
          </MenuItem>
        </ContextMenu>
      )}

      {picker && <Picker files={files ?? []} notesOpen={sideOf(ws, NOTES) !== null} onChoose={choose} onClose={() => setPicker(null)} />}
    </div>
  );
}

function Picker({ files, notesOpen, onChoose, onClose }: { files: CourseFile[]; notesOpen: boolean; onChoose: (tab: TabId) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const shown = files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Dialog title={t.lecture.openTitle} onClose={onClose}>
      <div className="ui-stack">
        <SearchField label={t.lecture.openSearch} value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} autoFocus />
        <List>
          {!notesOpen && <ListRow leading={<FileTile kind="text" size={34} />} title={t.lecture.notes} onClick={() => onChoose(NOTES)} />}
          {shown.map((file) => (
            <ListRow key={file.id} leading={<FileTile kind={fileKind(file.name, file.mime)} size={34} />} title={file.name} meta={t.folders[file.folder]} onClick={() => onChoose(fileTab(file.id))} />
          ))}
        </List>
        {shown.length === 0 && <p className="quiet">{t.lecture.openNone}</p>}
      </div>
    </Dialog>
  );
}
