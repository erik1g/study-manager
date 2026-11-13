// Tasks and deadlines as rows and as forms, wherever they are listed.
import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_SLOT_MINUTES, type DeadlineDraft, type TaskDraft } from "@study/shared";
import { Button, Checkbox, CountdownTile, IconButton, ListRow, Notice, Select, TextField, type Tone } from "@study/ui";
import { daysUntil, t, errorMessage, formatDate, formatDuration, formatShortDate, formatTime, relativeDay, today } from "../i18n";
import { api, type Course, type Deadline, type Task } from "../lib/api";
import { prefersLessMotion } from "../lib/motion";
import { useSession } from "../lib/session";
import { toneOf } from "../lib/tone";
import { Avatar } from "./Avatar";
import { ContextMenu, MenuItem, MenuSeparator, menuPositionFrom, type MenuPosition } from "./ContextMenu";

export const ESTIMATES = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480];

/** `14:00–15:30` for a task planned at a time. */
export function slotLabel(task: Pick<Task, "startTime" | "estimateMinutes">): string {
  if (!task.startTime) return "";
  const [h, m] = task.startTime.split(":").map(Number);
  const end = h! * 60 + m! + (task.estimateMinutes ?? DEFAULT_SLOT_MINUTES);
  const clock = (total: number) => `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return `${task.startTime}–${clock(end)}`;
}

/** The local day a deadline falls on. */
export function deadlineDay(deadline: Deadline): string {
  return deadline.allDay ? deadline.date! : new Date(deadline.startsAt!).toLocaleDateString("sv-SE");
}

/** Whether its time has come: an all-day one the day after, one with a time from that time on. */
export function deadlinePast(deadline: Deadline, now = new Date()): boolean {
  return deadline.allDay ? deadline.date! < now.toLocaleDateString("sv-SE") : new Date(deadline.startsAt!) <= now;
}

/** Still to do: not ticked off and not past. */
export const deadlineOpen = (deadline: Deadline) => !deadline.done && !deadlinePast(deadline);

/** Done or past, the newest first – shown apart, never hidden. */
export function settledDeadlines(all: Deadline[]): Deadline[] {
  return all.filter((d) => !deadlineOpen(d)).sort((a, b) => (b.startsAt ?? b.date!).localeCompare(a.startsAt ?? a.date!));
}

function courseOf(courses: Course[], id: string | null) {
  return id ? courses.find((c) => c.id === id) : undefined;
}

/** How long until a day, as a tile: "2 Tage", "Heute 23:59"; ticked off or past it says so. */
export function Countdown({ day, time, tone, done, past }: { day: string; time?: string | null; tone: Tone; done?: boolean; past?: boolean }) {
  const days = daysUntil(day);
  if (done) return <CountdownTile value="✓" unit={t.deadlines.done} tone="gruen" />;
  if (past || days < 0) return <CountdownTile value="–" unit={t.deadlines.past} tone="grau" />;
  if (days === 0) return <CountdownTile value={t.deadlines.today} unit={time ?? ""} tone={tone} />;
  return <CountdownTile value={days} unit={days === 1 ? t.deadlines.day : t.deadlines.days} tone={tone} />;
}

/** The ⋯ of a row with Edit and Delete. */
function RowMenu({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  const [at, setAt] = useState<MenuPosition | null>(null);
  const choose = (action: () => void) => () => {
    setAt(null);
    action();
  };
  return (
    <>
      <IconButton icon="more" size="sm" label={t.common.actionsFor(label)} aria-haspopup="menu" aria-expanded={at !== null} onClick={(e) => setAt(menuPositionFrom(e.currentTarget))} />
      {at && (
        <ContextMenu at={at} label={t.common.actionsFor(label)} onClose={() => setAt(null)}>
          <MenuItem icon="edit" onSelect={choose(onEdit)}>
            {t.common.edit}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon="trash" danger onSelect={choose(onDelete)}>
            {t.common.delete}
          </MenuItem>
        </ContextMenu>
      )}
    </>
  );
}

export function TaskRow({ task, onChanged, showCourse = true }: { task: Task; onChanged: () => void; showCourse?: boolean }) {
  const { courses } = useSession();
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const course = courseOf(courses, task.courseId);
  const overdue = !task.done && !!task.plannedDate && task.plannedDate < today();
  const run = (operation: Promise<unknown>) => operation.then(onChanged, (e) => setError(errorMessage(e)));

  if (editing) {
    return (
      <li className="row-editing">
        <TaskForm
          initial={task}
          submitLabel={t.common.save}
          onCancel={() => setEditing(false)}
          onSubmit={async (draft) => {
            await api.updateTask(task.id, draft);
            setEditing(false);
            onChanged();
          }}
        />
      </li>
    );
  }

  const meta = [
    showCourse ? (course?.title ?? t.tasks.general) : null,
    task.plannedDate ? (overdue ? `${t.tasks.overdue} (${formatShortDate(task.plannedDate)})` : relativeDay(task.plannedDate)) + (task.startTime ? `, ${slotLabel(task)}` : "") : null,
    task.estimateMinutes !== null && !task.startTime ? `≈ ${formatDuration(task.estimateMinutes)}` : null,
  ].filter(Boolean);

  return (
    <ListRow
      rowClassName={leaving ? "task-leaving" : undefined}
      leading={
        <Checkbox
          label={task.title}
          hideLabel
          tone="gruen"
          checked={task.done || leaving}
          onChange={() => {
            if (task.done) return void run(api.updateTask(task.id, { done: false }));
            setLeaving(true);
            // The row shows its tick and fades before the list changes.
            api.updateTask(task.id, { done: true }).then(
              () => setTimeout(onChanged, prefersLessMotion() ? 0 : 320),
              (e) => {
                setLeaving(false);
                setError(errorMessage(e));
              },
            );
          }}
        />
      }
      title={<span className={task.done || leaving ? "task-done" : undefined}>{task.title}</span>}
      meta={
        <>
          {meta.join(" · ")}
          {error && <Notice tone="danger">{error}</Notice>}
        </>
      }
      trailing={
        <>
          <RowMenu label={task.title} onEdit={() => setEditing(true)} onDelete={() => void run(api.deleteTask(task.id))} />
        </>
      }
    />
  );
}

export function DeadlineRow({ deadline, onChanged, showCourse = true }: { deadline: Deadline; onChanged: () => void; showCourse?: boolean }) {
  const { courses } = useSession();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const course = courseOf(courses, deadline.courseId);
  const day = deadlineDay(deadline);
  // Every hook comes before the early return below: the order must not change when the row is edited.
  const past = deadlinePast(deadline);
  // The tick shows at once; the list moves the row once the server has it.
  const [done, setDone] = useState(deadline.done);
  useEffect(() => setDone(deadline.done), [deadline.done]);

  if (editing) {
    return (
      <li className="row-editing">
        <DeadlineForm
          initial={deadline}
          submitLabel={t.common.save}
          onCancel={() => setEditing(false)}
          onSubmit={async (draft) => {
            await api.updateDeadline(deadline.id, draft);
            setEditing(false);
            onChanged();
          }}
        />
      </li>
    );
  }

  const toggle = async () => {
    const next = !done;
    setDone(next);
    setError(null);
    try {
      await api.setDeadlineDone(deadline.id, next);
      onChanged();
    } catch (e) {
      setDone(!next);
      setError(errorMessage(e));
    }
  };
  const when = `${formatShortDate(day)}${deadline.allDay ? "" : `, ${formatTime(deadline.startsAt!)}`}`;
  const meta = [showCourse ? (course?.title ?? t.tasks.general) : null, when, deadline.notes].filter(Boolean).join(" · ");
  return (
    <ListRow
      rowClassName={done || past ? "deadline-settled" : undefined}
      leading={
        <span className="deadline-lead">
          <Checkbox label={t.deadlines.markDone(deadline.title)} hideLabel tone="gruen" checked={done} onChange={() => void toggle()} />
          <Countdown day={day} time={deadline.allDay ? null : formatTime(deadline.startsAt!)} tone={toneOf(course?.color)} done={done} past={past} />
        </span>
      }
      title={<span className={done ? "task-done" : undefined}>{deadline.title}</span>}
      meta={
        <>
          {meta}
          {error && <Notice tone="danger">{error}</Notice>}
        </>
      }
      trailing={
        <>
          {deadline.courseId && (
            <span title={t.deadlines.createdBy(deadline.createdBy)}>
              <Avatar userId={deadline.createdById} name={deadline.createdBy} size={24} />
            </span>
          )}
          {deadline.editable && (
            <RowMenu
              label={deadline.title}
              onEdit={() => setEditing(true)}
              onDelete={() => void api.deleteDeadline(deadline.id).then(onChanged, (e) => setError(errorMessage(e)))}
            />
          )}
        </>
      }
    />
  );
}

export function TaskForm(props: {
  initial?: Partial<Task>;
  /** Preselected subject for a new task. */
  courseId?: string | null;
  deadlines?: Deadline[];
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  const { courses } = useSession();
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [courseId, setCourseId] = useState(props.initial?.courseId ?? props.courseId ?? "");
  const [deadlineId, setDeadlineId] = useState(props.initial?.deadlineId ?? "");
  const [planned, setPlanned] = useState(props.initial?.plannedDate ?? "");
  const [start, setStart] = useState(props.initial?.startTime ?? "");
  const [estimate, setEstimate] = useState(props.initial?.estimateMinutes?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deadlines = (props.deadlines ?? []).filter((d) => !courseId || d.courseId === courseId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await props.onSubmit({
        title,
        courseId: courseId || null,
        deadlineId: deadlineId || null,
        plannedDate: planned || null,
        startTime: (planned && start) || null,
        estimateMinutes: estimate ? Number(estimate) : null,
      });
      if (!props.initial) {
        setTitle("");
        setPlanned("");
        setStart("");
        setEstimate("");
      }
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="entry-form" onSubmit={submit}>
      <TextField className="wide" label={t.tasks.name} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      {props.courseId === undefined && (
        <Select label={t.tasks.subject} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">{t.tasks.general}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      )}
      {deadlines.length > 0 && (
        <Select label={t.tasks.deadline} value={deadlineId} onChange={(e) => setDeadlineId(e.target.value)}>
          <option value="">{t.tasks.noDeadline}</option>
          {deadlines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} · {formatDate(deadlineDay(d))}
            </option>
          ))}
        </Select>
      )}
      <TextField label={t.tasks.plannedOn} type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} />
      <TextField label={t.tasks.startAt} type="time" step={900} value={start} disabled={!planned} onChange={(e) => setStart(e.target.value)} />
      <Select label={t.tasks.estimate} value={estimate} onChange={(e) => setEstimate(e.target.value)}>
        <option value="">{t.tasks.noEstimate}</option>
        {ESTIMATES.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatDuration(minutes)}
          </option>
        ))}
      </Select>
      {error && (
        <Notice tone="danger" className="wide">
          {error}
        </Notice>
      )}
      <div className="form-actions wide">
        {props.onCancel && <Button onClick={props.onCancel}>{t.common.cancel}</Button>}
        <Button type="submit" variant="primary" loading={busy} disabled={!title.trim()}>
          {props.submitLabel}
        </Button>
      </div>
    </form>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function DeadlineForm(props: {
  initial?: Deadline;
  courseId?: string | null;
  submitLabel: string;
  onSubmit: (draft: DeadlineDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  const { courses } = useSession();
  const initial = props.initial;
  const editable = courses.filter((c) => c.role !== "viewer");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [courseId, setCourseId] = useState(initial?.courseId ?? props.courseId ?? "");
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [date, setDate] = useState(initial?.date ?? "");
  const [start, setStart] = useState(initial?.startsAt ? localInput(initial.startsAt) : "");
  const [end, setEnd] = useState(initial?.endsAt ? localInput(initial.endsAt) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await props.onSubmit({
        title,
        courseId: courseId || null,
        allDay,
        date: allDay ? date : null,
        startsAt: allDay ? null : new Date(start).toISOString(),
        endsAt: allDay || !end ? null : new Date(end).toISOString(),
        notes: notes || null,
      });
      if (!initial) {
        setTitle("");
        setNotes("");
      }
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="entry-form" onSubmit={submit}>
      <TextField className="wide" label={t.deadlines.name} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      {props.courseId === undefined && (
        <Select label={t.deadlines.subject} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">{t.deadlines.general}</option>
          {editable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      )}
      <Checkbox className="wide" label={t.deadlines.allDay} checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
      {allDay ? (
        <TextField label={t.deadlines.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      ) : (
        <>
          <TextField label={t.deadlines.start} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          <TextField label={t.deadlines.end} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </>
      )}
      <TextField className="wide" label={t.deadlines.notes} value={notes} onChange={(e) => setNotes(e.target.value)} hint={courseId ? t.deadlines.sharedHint : undefined} />
      {error && (
        <Notice tone="danger" className="wide">
          {error}
        </Notice>
      )}
      <div className="form-actions wide">
        {props.onCancel && <Button onClick={props.onCancel}>{t.common.cancel}</Button>}
        <Button type="submit" variant="primary" loading={busy} disabled={!title.trim()}>
          {props.submitLabel}
        </Button>
      </div>
    </form>
  );
}
