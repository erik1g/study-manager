// The quick search: reach anything from anywhere, and add something in a sentence.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { Dialog, List, ListRow, Notice, SearchField } from "@study/ui";
import { de, errorMessage, formatDate, today } from "../i18n/de";
import { api, type EverywhereResult } from "../lib/api";
import { emitChanged, toast } from "../lib/events";
import { useGo } from "../lib/motion";
import { parseQuickAdd, type QuickAdd } from "../lib/quickAdd";
import { useSession } from "../lib/session";
import { toneOf } from "../lib/tone";

interface Hit {
  group: string;
  title: string;
  meta?: string;
  /** The subject whose colour it shows. */
  courseId?: string | null;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const { courses } = useSession();
  const { pathname } = useLocation();
  const go = useGo();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<EverywhereResult | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isOpen = useRef(false);
  isOpen.current = open;

  const currentCourse = pathname.match(/^\/fach\/([^/]+)/)?.[1] ?? null;
  const titleOf = useCallback((id: string | null | undefined) => courses.find((c) => c.id === id)?.title ?? de.tasks.general, [courses]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const show = () => {
      setQuery("");
      setFound(null);
      setSelected(0);
      setError(null);
      setOpen(true);
    };
    const keys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen.current) setOpen(false);
        else show();
      }
    };
    window.addEventListener("study:palette", show);
    document.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("study:palette", show);
      document.removeEventListener("keydown", keys);
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setFound(null);
      return;
    }
    const timer = setTimeout(() => api.search(term).then(setFound, () => {}), 180);
    return () => clearTimeout(timer);
  }, [query]);

  const leave = useCallback(
    (to: string) => {
      setOpen(false);
      go(to);
    },
    [go],
  );

  const add = useCallback(async (item: QuickAdd) => {
    if (item.kind === "deadline") {
      await api.createDeadline({
        courseId: item.courseId,
        title: item.title,
        allDay: !item.time,
        date: item.time ? null : item.date,
        startsAt: item.time ? new Date(`${item.date}T${item.time}:00`).toISOString() : null,
        endsAt: null,
        notes: null,
      });
    } else {
      await api.createTask({ title: item.title, courseId: item.courseId, plannedDate: item.date, startTime: item.date ? item.time : null, estimateMinutes: null });
    }
    setOpen(false);
    toast(item.kind === "deadline" ? de.palette.deadlineAdded : de.palette.taskAdded);
    emitChanged();
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const term = query.trim().toLowerCase();
    const list: Hit[] = [];
    const quick = parseQuickAdd(query, courses, currentCourse);
    if (quick) {
      const when = quick.date ? `${formatDate(quick.date)}${quick.time ? `, ${quick.time} Uhr` : ""} · ` : "";
      list.push({
        group: de.palette.add,
        title: `${quick.kind === "deadline" ? de.deadlines.one : de.tasks.one} „${quick.title}“`,
        meta: `${when}${quick.courseId ? titleOf(quick.courseId) : quick.kind === "deadline" ? de.palette.private : de.tasks.general}`,
        courseId: quick.courseId,
        run: () => add(quick),
      });
    }
    if (!term) {
      list.push(
        { group: de.palette.goTo, title: de.nav.today, run: () => leave("/") },
        { group: de.palette.goTo, title: de.nav.planning, run: () => leave("/planung") },
        { group: de.palette.goTo, title: de.nav.todos, run: () => leave("/todos") },
        { group: de.palette.goTo, title: de.settings.appearance, meta: de.nav.settings, run: () => leave("/einstellungen/darstellung") },
      );
      return list;
    }
    for (const c of courses.filter((c) => c.title.toLowerCase().includes(term))) {
      list.push({ group: de.palette.subjects, title: c.title, courseId: c.id, run: () => leave(`/fach/${c.id}`) });
    }
    if (found) {
      for (const d of found.deadlines) {
        list.push({ group: de.deadlines.title, title: d.title, meta: `${titleOf(d.courseId)} · ${formatDate(d.date ?? d.startsAt!)}`, courseId: d.courseId, run: () => leave(d.courseId ? `/fach/${d.courseId}` : "/todos") });
      }
      for (const t of found.tasks) {
        list.push({ group: de.nav.todos, title: t.title, meta: titleOf(t.courseId), courseId: t.courseId, run: () => leave("/todos") });
      }
      for (const f of found.files) {
        list.push({ group: de.palette.documents, title: f.name, meta: `${titleOf(f.courseId)} · ${de.folders[f.folder as keyof typeof de.folders]}`, courseId: f.courseId, run: () => leave(`/fach/${f.courseId}?tab=dokumente&datei=${f.id}`) });
      }
      for (const n of found.notes) {
        list.push({ group: de.palette.notes, title: n.title, meta: titleOf(n.courseId), courseId: n.courseId, run: () => leave(`/fach/${n.courseId}?tab=notizen`) });
      }
      for (const r of found.recordings) {
        list.push({ group: de.palette.lectures, title: r.title, meta: `${titleOf(r.courseId)} · ${formatDate(r.date)}`, courseId: r.courseId, run: () => leave(`/fach/${r.courseId}?tab=vorlesungen&aufnahme=${r.id}`) });
      }
      for (const p of found.passages) {
        list.push({
          group: de.palette.inDocuments,
          title: p.name,
          meta: `${p.page ? `S. ${p.page} · ` : ""}${p.text.slice(0, 90)} …`,
          courseId: p.courseId,
          run: () => leave(`/fach/${p.courseId}?tab=dokumente&datei=${p.fileId}${p.page ? `&seite=${p.page}` : ""}`),
        });
      }
    }
    return list;
  }, [query, courses, currentCourse, found, titleOf, add, leave]);

  useEffect(() => setSelected(0), [hits.length]);

  // Keep the chosen result in view while moving with the arrow keys.
  useEffect(() => {
    document.querySelector(".palette .ui-selected")?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  const run = async (hit: Hit | undefined) => {
    if (!hit) return;
    try {
      await hit.run();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const groups: ReactNode[] = [];
  let group = "";
  let rows: ReactNode[] = [];
  const flush = () => {
    if (rows.length) {
      groups.push(
        <section key={group} className="palette-group" aria-label={group}>
          <h3 className="palette-group-title">{group}</h3>
          <List>{rows}</List>
        </section>,
      );
    }
    rows = [];
  };
  hits.forEach((hit, index) => {
    if (hit.group !== group) {
      flush();
      group = hit.group;
    }
    const color = hit.courseId !== undefined ? courses.find((c) => c.id === hit.courseId)?.color : undefined;
    rows.push(
      <ListRow
        key={index}
        selected={index === selected}
        onMouseEnter={() => setSelected(index)}
        onClick={() => void run(hit)}
        leading={hit.courseId !== undefined ? <span className={`time-dot ui-tone-${toneOf(color)}`} aria-hidden="true" /> : undefined}
        title={hit.title}
        meta={hit.meta}
      />,
    );
  });
  flush();

  return (
    <Dialog title={de.nav.search} hideTitle hideClose placement="top" size="lg" className="palette" onClose={close}>
      <SearchField
        label={de.nav.search}
        size="lg"
        autoFocus
        placeholder={de.palette.placeholder}
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected(Math.min(selected + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected(Math.max(selected - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            void run(hits[selected]);
          }
        }}
      />
      <div className="palette-list">
        {error && <Notice tone="danger">{error}</Notice>}
        {groups}
        {hits.length === 0 && <p className="quiet">{de.palette.none}</p>}
        {!query && <p className="quiet small">{de.palette.tip(`Deadline Laborbericht am ${today().slice(8)}.${today().slice(5, 7)}.`)}</p>}
      </div>
    </Dialog>
  );
}
