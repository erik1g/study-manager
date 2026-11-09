// The week as a calendar: lectures, deadlines and the tasks planned as time
// blocks, which are moved and stretched by dragging. Unplanned tasks wait in
// the inbox beside it and are dragged into free time.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import FullCalendar from "@fullcalendar/react";
import type { DatesSetArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import deLocale from "@fullcalendar/core/locales/de";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { Draggable, type DropArg, type EventResizeDoneArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DateSelectArg } from "@fullcalendar/core";
import { DEFAULT_SLOT_MINUTES } from "@study/shared";
import { DeadlineForm, slotLabel } from "../components/Agenda";
import { Button, Card, Chip, LinkButton, Notice, SectionHeader, Select, TextField } from "@study/ui";
import { Dialog } from "../components/Dialog";
import { toneOf } from "../lib/tone";
import { de, errorMessage, formatDuration, formatDate, formatTime } from "../i18n/de";
import { api, type CalendarItem, type Deadline, type Task } from "../lib/api";
import { emitChanged, useChanged } from "../lib/events";
import { useSession } from "../lib/session";

const localDay = (date: Date) => date.toLocaleDateString("sv-SE");
/** What kind of session a timetable entry is, from the abbreviation in its name. */
const sessionKind = (title: string) => ({ VO: "Vorlesung", UE: "Übung", VU: "Vorlesung mit Übung", SE: "Seminar", PR: "Praktikum" })[title.match(/\b(VO|UE|VU|SE|PR)\b/)?.[1] ?? ""];

const localTime = (date: Date) => date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

function useNarrow() {
  const query = "(max-width: 760px)";
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setNarrow(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, []);
  return narrow;
}

export function PlanningView() {
  const { courses } = useSession();
  // Seven columns are too narrow to read on a phone: there the day is the start view.
  const narrow = useNarrow();
  const navigate = useNavigate();
  // Fresh objects on every render can make FullCalendar reset the view, so these only change with the width.
  const toolbar = useMemo(
    () => (narrow ? { left: "prev,today,next", right: "timeGridDay,timeGridWeek,dayGridMonth" } : { left: "prev,today,next", center: "title", right: "timeGridWeek,dayGridMonth" }),
    [narrow],
  );
  const buttonText = useMemo(() => ({ day: de.planning.day, prev: narrow ? "‹" : de.planning.previous, next: narrow ? "›" : de.planning.next, today: de.planning.today, week: de.planning.week, month: de.planning.month }), [narrow]);
  const calendar = useRef<FullCalendar>(null);
  const inbox = useRef<HTMLUListElement>(null);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [unplanned, setUnplanned] = useState<Task[]>([]);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [creating, setCreating] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  const [snapped, setSnapped] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classOf = useCallback((courseId: string | null) => `ui-tone-${toneOf(courses.find((c) => c.id === courseId)?.color)}`, [courses]);
  const titleOf = useCallback((courseId: string | null) => courses.find((c) => c.id === courseId)?.title ?? null, [courses]);

  const load = useCallback(async () => {
    if (!range) return;
    try {
      const [calendarItems, open] = await Promise.all([api.calendar(range.start, range.end), api.tasks({ open: true })]);
      setItems(calendarItems);
      setUnplanned(open.filter((t) => !t.plannedDate));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [range]);
  useEffect(() => {
    void load();
  }, [load]);
  useChanged(load);
  // FullCalendar falls back to its initial view whenever it resets, so that one always is the current view.
  const [viewType, setViewType] = useState(narrow ? "timeGridDay" : "timeGridWeek");
  useEffect(() => {
    const target = narrow ? "timeGridDay" : "timeGridWeek";
    setViewType(target);
    calendar.current?.getApi().changeView(target);
  }, [narrow]);

  // Unplanned tasks can be dragged into the calendar.
  useEffect(() => {
    if (!inbox.current) return;
    const draggable = new Draggable(inbox.current, {
      itemSelector: ".inbox-task",
      eventData: (element) => ({
        title: element.dataset.title,
        duration: { minutes: Number(element.dataset.minutes) || DEFAULT_SLOT_MINUTES },
        create: false,
      }),
    });
    return () => draggable.destroy();
  }, []);

  const events: EventInput[] = useMemo(
    () =>
      items.map((item) => ({
        id: `${item.kind}:${item.id}`,
        title: item.kind === "task" ? `${item.done ? "✓ " : ""}${item.title}` : item.title,
        start: item.start,
        end: item.end,
        allDay: item.allDay,
        editable: item.kind === "task" || (item.kind === "deadline" && !!item.editable),
        durationEditable: item.kind === "task",
        classNames: [`cal-${item.kind}`, classOf(item.courseId), item.cancelled ? "cal-cancelled" : "", item.done ? "cal-done" : "", snapped === `${item.kind}:${item.id}` ? "cal-snap" : ""],
        extendedProps: { item, subject: titleOf(item.courseId) },
      })),
    [items, classOf, titleOf, snapped],
  );

  // How much is planned in the visible range.
  const plannedMinutes = items
    .filter((i) => i.kind === "task" && !i.allDay && !i.done)
    .reduce((sum, i) => sum + (new Date(i.end).getTime() - new Date(i.start).getTime()) / 60_000, 0);

  async function moveTask(taskId: string, start: Date, end: Date | null, allDay: boolean) {
    await api.updateTask(taskId, {
      plannedDate: localDay(start),
      startTime: allDay ? null : localTime(start),
      ...(end && !allDay && { estimateMinutes: Math.round((end.getTime() - start.getTime()) / 60_000) }),
    });
  }

  async function onEventChange(info: EventDropArg | EventResizeDoneArg) {
    const item = info.event.extendedProps.item as CalendarItem | undefined;
    if (!item) return;
    try {
      if (item.kind === "task") {
        await moveTask(item.id, info.event.start!, info.event.end, info.event.allDay);
      } else if (item.kind === "deadline") {
        const start = info.event.start!;
        const length = new Date(item.end).getTime() - new Date(item.start).getTime();
        const deadline = (await api.deadlines({ courseId: item.courseId ?? undefined })).find((d) => d.id === item.id);
        if (!deadline) throw new Error(de.errors.unknown_deadline);
        await api.updateDeadline(item.id, {
          courseId: deadline.courseId,
          title: deadline.title,
          notes: deadline.notes,
          allDay: info.event.allDay,
          date: info.event.allDay ? localDay(start) : null,
          startsAt: info.event.allDay ? null : start.toISOString(),
          endsAt: info.event.allDay ? null : new Date(start.getTime() + length).toISOString(),
        });
      }
      await load();
      setSnapped(info.event.id);
      setTimeout(() => setSnapped(null), 320);
      emitChanged();
    } catch (e) {
      info.revert();
      setError(errorMessage(e));
    }
  }

  async function onDrop(info: DropArg) {
    const taskId = info.draggedEl.dataset.task;
    if (!taskId) return;
    const minutes = Number(info.draggedEl.dataset.minutes) || DEFAULT_SLOT_MINUTES;
    try {
      await moveTask(taskId, info.date, info.allDay ? null : new Date(info.date.getTime() + minutes * 60_000), info.allDay);
      await load();
      setSnapped(`task:${taskId}`);
      setTimeout(() => setSnapped(null), 320);
      emitChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="page planning-page">
      <SectionHeader level={1} size="xl" title={de.planning.title} description={plannedMinutes > 0 ? de.planning.load(plannedMinutes) : undefined} />
      <div className="planning">
        <Card as="aside" className="planning-inbox" aria-labelledby="eingang">
          <SectionHeader id="eingang" title={de.planning.inbox} description={de.planning.inboxHint} />
          <ul ref={inbox} className="inbox-list">
            {unplanned.length === 0 && <li className="quiet small">{de.planning.inboxEmpty}</li>}
            {unplanned.map((task) => (
              <li
                key={task.id}
                className={`inbox-task ${classOf(task.courseId)}`}
                data-task={task.id}
                data-title={task.title}
                data-minutes={task.estimateMinutes ?? DEFAULT_SLOT_MINUTES}
              >
                <span className="inbox-task-title">{task.title}</span>
                <span className="inbox-task-meta">
                  {titleOf(task.courseId) ?? de.tasks.general} · {formatDuration(task.estimateMinutes ?? DEFAULT_SLOT_MINUTES)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <section className="planning-calendar">
          {error && <Notice tone="danger" action={<Button size="sm" variant="ghost" onClick={() => setError(null)}>{de.common.close}</Button>}>{error}</Notice>}
          <FullCalendar
            ref={calendar}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            locale={deLocale}
            initialView={viewType}
            headerToolbar={toolbar}
            buttonIcons={false}
            buttonText={buttonText}
            firstDay={1}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            scrollTime="08:00:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            nowIndicator
            height="100%"
            allDaySlot
            allDayText="ganztägig"
            events={events}
            editable
            droppable
            selectable
            selectMirror
            dayMaxEvents={4}
            eventDrop={onEventChange}
            eventResize={onEventChange}
            drop={onDrop}
            select={(info: DateSelectArg) => {
              setCreating({ start: info.start, end: info.end, allDay: info.allDay });
              calendar.current?.getApi().unselect();
            }}
            eventClick={(info: EventClickArg) => {
              const item = info.event.extendedProps.item as CalendarItem | undefined;
              if (item) setSelected(item);
            }}
            datesSet={(info: DatesSetArg) => {
              setViewType(info.view.type);
              setRange({ start: info.start, end: info.end });
            }}
            eventContent={(arg) => {
              // While a task is dragged in from the inbox, its preview has no item yet.
              const item = arg.event.extendedProps.item as CalendarItem | undefined;
              const subject = (arg.event.extendedProps.subject as string | null | undefined) ?? null;
              if (!item) {
                return (
                  <div className="fc-item">
                    <span className="mono fc-item-time">{arg.timeText}</span>
                    <span className="fc-item-title">{arg.event.title}</span>
                  </div>
                );
              }
              return (
                <div className="fc-item">
                  <span className="fc-item-title">{item.kind === "session" ? (subject ?? arg.event.title) : arg.event.title}</span>
                  {item.kind === "session" && sessionKind(item.title) && <span className="fc-item-subject">{sessionKind(item.title)}</span>}
                  {subject && (item.kind === "task" || item.kind === "deadline") && <span className="fc-item-subject">{subject}</span>}
                  {!arg.event.allDay && <span className="fc-item-time">{arg.timeText}</span>}
                  {item.location && <span className="fc-item-place">{item.location}</span>}
                </div>
              );
            }}
          />
        </section>
      </div>
      {selected && (
        <ItemDialog
          item={selected}
          subject={titleOf(selected.courseId)}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            setSelected(null);
            await load();
          }}
          onOpenCourse={(id) => navigate(`/fach/${id}`)}
        />
      )}
      {creating && (
        <QuickTaskDialog
          slot={creating}
          onClose={() => setCreating(null)}
          onCreated={async () => {
            setCreating(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ItemDialog(props: { item: CalendarItem; subject: string | null; onClose: () => void; onChanged: () => void; onOpenCourse: (id: string) => void }) {
  const { item } = props;
  const [error, setError] = useState<string | null>(null);
  // A deadline is changed here, in the form of the lists; it is read from the server first.
  const [editing, setEditing] = useState<Deadline | null>(null);
  const run = (operation: Promise<unknown>) => operation.then(props.onChanged, (e) => setError(errorMessage(e)));
  const edit = async () => {
    try {
      const all = await api.deadlines({ courseId: item.courseId ?? undefined });
      const found = all.find((d) => d.id === item.id);
      if (!found) throw new Error(de.errors.unknown_deadline);
      setEditing(found);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const when = item.allDay
    ? formatDate(item.start)
    : `${formatDate(item.start)}, ${formatTime(item.start)}–${formatTime(item.end)}`;
  return (
    <Dialog
      title={item.title}
      onClose={props.onClose}
      footer={
        <>
          {item.kind === "task" && (
            <>
              <Button variant="danger" icon="trash" onClick={() => run(api.deleteTask(item.id))}>
                {de.common.delete}
              </Button>
              <Button onClick={() => run(api.updateTask(item.id, { plannedDate: null, startTime: null }))}>{de.planning.unplan}</Button>
              <Button variant="primary" icon={item.done ? "restore" : "check"} onClick={() => run(api.updateTask(item.id, { done: !item.done }))}>
                {item.done ? de.planning.reopen : de.planning.markDone}
              </Button>
            </>
          )}
          {item.kind === "deadline" && !editing && (
            <>
              {item.editable && (
                <>
                  <Button variant="danger" icon="trash" onClick={() => run(api.deleteDeadline(item.id))}>
                    {de.common.delete}
                  </Button>
                  <Button icon="edit" onClick={() => void edit()}>
                    {de.common.edit}
                  </Button>
                </>
              )}
              <Button icon={item.done ? "restore" : "check"} onClick={() => run(api.setDeadlineDone(item.id, !item.done))}>
                {item.done ? de.planning.reopen : de.planning.markDone}
              </Button>
            </>
          )}
          {item.url && (
            <LinkButton href={item.url} target="_blank" rel="noreferrer" iconEnd="external">
              {de.common.open}
            </LinkButton>
          )}
          {item.courseId && props.subject && (
            <Button iconEnd="arrow-right" variant={item.kind === "task" ? "secondary" : "primary"} onClick={() => props.onOpenCourse(item.courseId!)}>
              {de.planning.openSubject}
            </Button>
          )}
        </>
      }
    >
      <div className="ui-stack">
        <div className="item-chips">
          <Chip tone={item.kind === "deadline" ? "orange" : item.kind === "task" ? "gruen" : "blau"}>{de.planning.kinds[item.kind]}</Chip>
          {item.cancelled && <Chip tone="rot">{de.planning.cancelled}</Chip>}
        </div>
        <p className="item-when">{when}</p>
        {props.subject && <p>{props.subject}</p>}
        {item.location && <p className="quiet">{item.location}</p>}
        {item.notes && <p className="quiet small">{item.notes}</p>}
        {editing && (
          <DeadlineForm
            initial={editing}
            submitLabel={de.common.save}
            onCancel={() => setEditing(null)}
            onSubmit={async (draft) => {
              await api.updateDeadline(editing.id, draft);
              props.onChanged();
            }}
          />
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}

/** A task right in the slot that was marked in the calendar. */
function QuickTaskDialog(props: { slot: { start: Date; end: Date; allDay: boolean }; onClose: () => void; onCreated: () => void }) {
  const { courses } = useSession();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const minutes = Math.round((props.slot.end.getTime() - props.slot.start.getTime()) / 60_000);
  const label = props.slot.allDay
    ? formatDate(props.slot.start)
    : `${formatDate(props.slot.start)}, ${slotLabel({ startTime: localTime(props.slot.start), estimateMinutes: minutes })}`;
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      await api.createTask({
        title,
        courseId: courseId || null,
        plannedDate: localDay(props.slot.start),
        startTime: props.slot.allDay ? null : localTime(props.slot.start),
        estimateMinutes: props.slot.allDay ? null : minutes,
      });
      props.onCreated();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={de.tasks.add}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>{de.common.cancel}</Button>
          <Button variant="primary" loading={busy} disabled={!title.trim()} onClick={() => void create()}>
            {de.common.add}
          </Button>
        </>
      }
    >
      <form
        className="ui-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <p className="item-when">{label}</p>
        <TextField label={de.tasks.name} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        <Select label={de.tasks.subject} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">{de.tasks.general}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Dialog>
  );
}
