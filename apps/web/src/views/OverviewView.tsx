// The start of the day: what happens today, what is due, and where each
// subject stands.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, Card, Chip, EmptyState, Illustration, LinkButton, List, ListRow, Notice, PageSkeleton, SearchButton, SectionHeader, type Tone } from "@study/ui";
import { DeadlineRow, TaskRow, deadlineOpen } from "../components/Agenda";
import { CourseCard } from "../components/CourseCard";
import { ConfirmDialog } from "../components/Dialog";
import { NewCourseDialog } from "../components/NewCourseDialog";
import { de, errorMessage, formatTime, semesterName, semesterOf, today } from "../i18n/de";
import { api, type CalendarItem, type Course, type CourseProgress, type Deadline, type Task, type WorkItem } from "../lib/api";
import { emitChanged, openPalette, useChanged } from "../lib/events";
import { useGo } from "../lib/motion";
import { useSession } from "../lib/session";
import { toneOf } from "../lib/tone";

/** The start of today and of tomorrow. */
const dayBounds = () => {
  const start = new Date(`${today()}T00:00:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
};

function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function DayCard({ items }: { items: CalendarItem[] }) {
  const { courses } = useSession();
  const now = useMinute();
  const day = today();
  // Only what takes place today, whatever the range brought along.
  const timed = items.filter((i) => !i.allDay && i.kind !== "deadline" && !i.cancelled && new Date(i.start).toLocaleDateString("sv-SE") === day);
  const courseOf = (item: CalendarItem) => courses.find((c) => c.id === item.courseId);
  const title = (item: CalendarItem) => (item.kind === "session" ? (courseOf(item)?.title ?? item.title) : item.title);
  const meta = (item: CalendarItem) => [item.kind === "task" ? (courseOf(item)?.title ?? de.tasks.general) : item.kind === "session" ? item.title : null, item.location].filter(Boolean).join(" · ");
  const target = (item: CalendarItem) => (item.kind === "session" && item.courseId ? `/fach/${item.courseId}` : "/planung");

  const running = timed.find((i) => new Date(i.start) <= now && new Date(i.end) > now);
  const coming = timed.find((i) => new Date(i.start) > now);
  const status = running
    ? de.overview.running(title(running), Math.ceil((new Date(running.end).getTime() - now.getTime()) / 60_000))
    : coming
      ? de.overview.coming(title(coming), formatTime(coming.start))
      : timed.length > 0
        ? de.overview.dayOver
        : de.overview.nothingToday;

  return (
    <Card as="section" tone="blau" glow grain className="day-card" aria-labelledby="day">
      <div className="day-card-head">
        <SectionHeader id="day" title={de.overview.today} description={status} size="lg" />
        <Illustration kind={timed.length > 0 ? "schreibtisch" : "tasse"} className="day-card-picture" />
      </div>
      {timed.length > 0 && (
        <List variant="raised" ordered>
          {timed.map((item) => (
            <ListRow
              key={item.id}
              href={target(item)}
              linkAs={Link}
              leading={
                <span className="time-cell">
                  <strong>{formatTime(item.start)}</strong>
                  <span className={`time-dot ui-tone-${toneOf(courseOf(item)?.color)}`} aria-hidden="true" />
                </span>
              }
              title={title(item)}
              meta={meta(item) || undefined}
              trailing={running?.id === item.id ? <Chip tone="gruen" size="sm">{de.overview.now}</Chip> : `bis ${formatTime(item.end)}`}
            />
          ))}
        </List>
      )}
    </Card>
  );
}

function DeadlinesCard({ all, onChanged }: { all: Deadline[]; onChanged: () => void }) {
  const deadlines = all.filter(deadlineOpen);
  const settled = all.length - deadlines.length;
  return (
    <Card as="section" tone="gelb" aria-labelledby="due">
      <SectionHeader id="due" title={de.overview.nextDue} action={<LinkButton as={Link} to="/todos" variant="ghost" size="sm">{de.overview.allTasks}</LinkButton>} />
      {deadlines.length === 0 ? (
        <p className="card-quiet">{de.overview.deadlinesEmpty}</p>
      ) : (
        <List variant="raised" className="card-list">
          {deadlines.slice(0, 4).map((deadline) => (
            <DeadlineRow key={deadline.id} deadline={deadline} onChanged={onChanged} />
          ))}
        </List>
      )}
      {settled > 0 && (
        <LinkButton as={Link} to="/todos#erledigt" variant="ghost" size="sm" icon="check-circle" className="settled-link">
          {de.deadlines.settledCount(settled)}
        </LinkButton>
      )}
    </Card>
  );
}

function CardsCard({ due, courses }: { due: Record<string, number>; courses: Course[] }) {
  const withCards = courses.filter((c) => (due[c.id] ?? 0) > 0).sort((a, b) => (due[b.id] ?? 0) - (due[a.id] ?? 0));
  const total = withCards.reduce((sum, c) => sum + (due[c.id] ?? 0), 0);
  if (total === 0) return null;
  return (
    <Card as="section" tone="violett" glow className="cards-card" aria-labelledby="cards">
      <div className="cards-card-text">
        <SectionHeader id="cards" title={de.overview.cards} />
        <p className="big-number ui-display">{total}</p>
        <p className="cards-card-sub">{de.overview.cardsToday(withCards.length)}</p>
        <LinkButton as={Link} to={`/fach/${withCards[0]!.id}?tab=lernkarten`} variant="primary" iconEnd="arrow-right">
          {de.overview.learnNow}
        </LinkButton>
      </div>
      <Illustration kind="karten" className="cards-card-picture" />
    </Card>
  );
}

export function CourseGrid({ list, progress, deadlines, due, onChanged, onRemove, onCreate }: {
  list: Course[];
  progress: CourseProgress[];
  deadlines: Deadline[];
  due: Record<string, number>;
  onChanged: () => void;
  onRemove: (course: Course) => void;
  onCreate?: () => void;
}) {
  return (
    <div className="course-grid">
      {list.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          progress={progress.find((p) => p.courseId === course.id)}
          deadline={deadlines.find((d) => d.courseId === course.id)}
          due={due[course.id]}
          onColor={(color: Tone | null) => api.setCourseColor(course.id, color).then(onChanged)}
          onRemove={() => onRemove(course)}
        />
      ))}
      {onCreate && (
        <Card as="button" type="button" variant="outline" interactive className="course-add" onClick={onCreate}>
          <span className="course-add-icon" aria-hidden="true">
            +
          </span>
          {de.overview.newSubject}
        </Card>
      )}
    </div>
  );
}

/** Greets by the time of day. */
const greeting = (name: string, now = new Date()) => {
  const hour = now.getHours();
  const first = name.split(/\s+/)[0];
  return `${hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend"}, ${first}`;
};

export function OverviewView() {
  const { courses, reloadCourses, me } = useSession();
  const go = useGo();
  const [loaded, setLoaded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [due, setDue] = useState<Record<string, number>>({});
  const [inbox, setInbox] = useState<WorkItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = dayBounds();
    // All deadlines: the open ones are shown, the done and past ones counted.
    const [allTasks, upcoming, calendar] = await Promise.all([api.tasks({}), api.deadlines(), api.calendar(start, end)]);
    setTasks(allTasks);
    setDeadlines(upcoming);
    setItems(calendar);
    setLoaded(true);
  }, []);
  const reload = useCallback(() => void load().catch((e) => setError(errorMessage(e))), [load]);
  useChanged(reload);

  useEffect(() => {
    reload();
    void api.progress().then(setProgress, () => {});
    void api.dueCards().then(setDue, () => {});
    void api.inbox().then(setInbox, () => {});
  }, [reload]);

  const changed = useCallback(() => {
    reload();
    emitChanged();
  }, [reload]);

  const current = semesterOf();
  const now = courses.filter((c) => c.semester === current);
  const other = courses.filter((c) => c.semester !== current);
  const otherSemesters = [...new Set(other.map((c) => c.semester))];
  const day = today();
  const open = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const toDo = open.filter((t) => t.plannedDate && t.plannedDate <= day).sort((a, b) => (a.plannedDate! + (a.startTime ?? "")).localeCompare(b.plannedDate! + (b.startTime ?? "")));
  const plannedToday = tasks.filter((t) => t.plannedDate === day);
  const doneToday = plannedToday.filter((t) => t.done).length;

  if (!loaded && !error) return <PageSkeleton />;

  const grid = (list: Course[], withAdd: boolean) => (
    <CourseGrid list={list} progress={progress} deadlines={deadlines.filter(deadlineOpen)} due={due} onChanged={reloadCourses} onRemove={setRemoving} onCreate={withAdd ? () => setCreating(true) : undefined} />
  );

  return (
    <div className="page today">
      <SectionHeader
        level={1}
        size="xl"
        title={greeting(me?.displayName ?? "")}
        description={`${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })} · ${semesterName(current)}`}
        action={
          <>
            <SearchButton label={de.nav.search} shortcut="⌘K" onOpen={openPalette} className="today-search" />
            <Button variant="primary" icon="plus" onClick={openPalette}>
              {de.overview.add}
            </Button>
          </>
        }
      />
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="today-grid">
        <DayCard items={items} />

        <Card as="section" aria-labelledby="todo" className="todo-card">
          <SectionHeader id="todo" title={de.overview.toDo} action={plannedToday.length > 0 && <Chip tone="gruen">{de.overview.open(doneToday, plannedToday.length)}</Chip>} />
          {toDo.length === 0 ? (
            <EmptyState variant="plain" size="sm" illustration="fertig" title={plannedToday.length > 0 ? de.overview.allDone : de.overview.nothingToday}>
              {plannedToday.length > 0 ? de.overview.allDoneText : null}
            </EmptyState>
          ) : (
            <List className="card-list">
              {toDo.slice(0, 5).map((task) => (
                <TaskRow key={task.id} task={task} onChanged={changed} />
              ))}
            </List>
          )}
          {toDo.length > 5 && (
            <LinkButton as={Link} to="/todos" variant="ghost" size="sm" iconEnd="arrow-right">
              {de.overview.moreTasks(toDo.length - 5)}
            </LinkButton>
          )}
        </Card>

        <DeadlinesCard all={deadlines} onChanged={changed} />
        <CardsCard due={due} courses={courses} />

        {inbox.length > 0 && (
          <Card as="section" tone="gelb" aria-labelledby="claude">
            <SectionHeader id="claude" title={de.inbox.title} description={de.inbox.text(inbox.length)} />
            <List variant="raised" className="card-list">
              {inbox.slice(0, 3).map((item) => (
                <ListRow key={item.id} title={item.title} meta={item.course} />
              ))}
            </List>
            <p className="card-quiet">{de.inbox.how}</p>
          </Card>
        )}
      </div>

      <section aria-labelledby="subjects" className="page-section">
        <SectionHeader id="subjects" title={de.overview.yourSubjects} size="lg" action={<LinkButton as={Link} to="/faecher" variant="ghost" size="sm">{de.nav.subjects}</LinkButton>} />
        {courses.length === 0 && <p className="quiet">{de.overview.noSubjects}</p>}
        {grid(now, true)}
      </section>

      {otherSemesters.map((semester) => (
        <section key={semester} className="page-section">
          <SectionHeader title={semesterName(semester)} />
          {grid(
            other.filter((c) => c.semester === semester),
            false,
          )}
        </section>
      ))}

      {creating && (
        <NewCourseDialog
          onClose={() => setCreating(false)}
          onCreated={async (course) => {
            setCreating(false);
            await reloadCourses();
            go(`/fach/${course.id}`);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={removing.role === "owner" ? de.overview.deleteSubject.replace(" …", "") : de.overview.leave}
          text={removing.role === "owner" ? de.course.deleteConfirm(removing.title) : de.course.leaveConfirm(removing.title)}
          confirm={removing.role === "owner" ? de.common.delete : de.members.leave}
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            if (removing.role === "owner") await api.deleteCourse(removing.id);
            else await api.removeMember(removing.id, me!.id);
            await reloadCourses();
          }}
        />
      )}
    </div>
  );
}
