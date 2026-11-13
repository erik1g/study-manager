// A subject as a card: how far it is, what comes next, and what can be done
// with it in a menu, on a right click or behind the dots.
import { useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { Card, Icon, IconButton, ProgressRing, TonePicker, type Tone } from "@study/ui";
import { t, formatWeekTime, relativeDay } from "../i18n";
import type { Course, CourseProgress, Deadline } from "../lib/api";
import { useGo } from "../lib/motion";
import { courseIcon, toneOf } from "../lib/tone";
import { deadlineDay } from "./Agenda";
import { ContextMenu, MenuItem, MenuSeparator, menuPositionFrom, type MenuPosition } from "./ContextMenu";

interface Props {
  course: Course;
  progress?: CourseProgress;
  deadline?: Deadline;
  /** Flashcards due for the user. */
  due?: number;
  onColor: (color: Tone | null) => void;
  /** Deleting for owners, leaving for everyone else. */
  onRemove: () => void;
}

export function CourseCard({ course, progress, deadline, due = 0, onColor, onRemove }: Props) {
  const go = useGo(true);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const open = () => go(`/fach/${course.id}`);
  const close = () => setMenu(null);
  const tone = toneOf(course.color);
  const planned = !!progress && progress.total > 0;
  const next = progress?.next ? formatWeekTime(progress.next.start) : t.overview.noSession;
  const second = deadline ? `${deadline.title} ${relativeDay(deadlineDay(deadline)).toLowerCase()}` : due > 0 ? t.overview.cardsDue(due) : t.overview.noDeadline;

  return (
    <div
      className="course-card"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <Card
        as={Link}
        to={`/fach/${course.id}`}
        tone={tone}
        interactive
        className="course-card-face"
        style={{ viewTransitionName: `fach-${course.id}` }}
        onClick={(event: MouseEvent) => {
          // Opening a subject from its card morphs the card into the page.
          if (event.metaKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          open();
        }}
      >
        <span className="course-card-top">
          <span className="course-icon">
            <Icon name={courseIcon(course.title)} size={26} />
          </span>
        </span>
        <span className="course-card-title ui-display">{course.title}</span>
        <span className="course-card-bottom">
          <span className="course-card-meta">
            <strong>{next}</strong>
            <span>{second}</span>
          </span>
          {planned && (
            <ProgressRing value={progress.done / progress.total} label={t.overview.sessionOf(progress.done, progress.total)} tone={tone} onTint size={46} animateKey={`card-${course.id}`}>
              <span className="course-ring-text">{progress.done}</span>
            </ProgressRing>
          )}
        </span>
      </Card>
      <IconButton
        icon="more"
        label={t.overview.menuFor(course.title)}
        className="course-card-more"
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        onClick={(event) => setMenu(menuPositionFrom(event.currentTarget))}
      />
      {menu && (
        <ContextMenu at={menu} label={course.title} onClose={close}>
          <MenuItem
            icon="arrow-right"
            onSelect={() => {
              close();
              open();
            }}
          >
            {t.common.open}
          </MenuItem>
          <MenuSeparator />
          <div className="menu-block">
            <span className="menu-block-label">{t.overview.color}</span>
            <TonePicker
              label={t.overview.color}
              value={course.color ? toneOf(course.color) : null}
              allowNone
              onChange={(next) => {
                close();
                onColor(next);
              }}
            />
          </div>
          <MenuSeparator />
          <MenuItem
            icon={course.role === "owner" ? "trash" : "logout"}
            danger
            onSelect={() => {
              close();
              onRemove();
            }}
          >
            {course.role === "owner" ? t.overview.deleteSubject : t.overview.leave}
          </MenuItem>
        </ContextMenu>
      )}
    </div>
  );
}
