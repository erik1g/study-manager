// All subjects on a page of their own; on phones the tab bar leads here.
import { useCallback, useEffect, useState } from "react";
import { Button, SectionHeader } from "@study/ui";
import { deadlineOpen } from "../components/Agenda";
import { NewCourseDialog } from "../components/NewCourseDialog";
import { t, semesterName, semesterOf, today } from "../i18n";
import { api, type Course, type CourseProgress, type Deadline } from "../lib/api";
import { useGo } from "../lib/motion";
import { useSession } from "../lib/session";
import { CourseGrid } from "./OverviewView";

export function SubjectsView() {
  const { courses, reloadCourses } = useSession();
  const go = useGo();
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [due, setDue] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([api.progress(), api.deadlines({ from: new Date(`${today()}T00:00:00`).toISOString() })]);
    setProgress(p);
    setDeadlines(d.filter(deadlineOpen));
  }, []);
  useEffect(() => {
    void load();
    void api.dueCards().then(setDue, () => {});
  }, [load]);

  const remove = (course: Course) => go(`/fach/${course.id}?tab=mitglieder`);
  const current = semesterOf();
  const semesters = [current, ...[...new Set(courses.map((c) => c.semester))].filter((s) => s !== current).sort().reverse()];

  return (
    <div className="page">
      <SectionHeader
        level={1}
        size="xl"
        title={t.nav.subjects}
        action={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t.overview.newSubject}
          </Button>
        }
      />
      {semesters.map((semester) => {
        const list = courses.filter((c) => c.semester === semester);
        if (list.length === 0 && semester !== current) return null;
        return (
          <section key={semester} className="page-section">
            <SectionHeader title={semesterName(semester)} />
            <CourseGrid
              list={list}
              progress={progress}
              deadlines={deadlines}
              due={due}
              onChanged={reloadCourses}
              onRemove={remove}
              onCreate={semester === current ? () => setCreating(true) : undefined}
            />
          </section>
        );
      })}
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
    </div>
  );
}
