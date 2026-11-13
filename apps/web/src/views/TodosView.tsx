import { useCallback, useEffect, useState } from "react";
import { Button, Card, Chip, EmptyState, List, Notice, SectionHeader, SegmentedControl } from "@study/ui";
import { DeadlineForm, DeadlineRow, TaskForm, TaskRow, deadlineDay, deadlineOpen, settledDeadlines } from "../components/Agenda";
import { t, errorMessage, daysUntil } from "../i18n";
import { api, type Deadline, type Task } from "../lib/api";
import { useChanged } from "../lib/events";

type Bucket = keyof typeof t.todos.buckets;
const BUCKETS: Bucket[] = ["overdue", "today", "week", "later", "undated"];
const BUCKET_TONE = { overdue: "rot", today: "gelb", week: "blau", later: "grau", undated: "grau" } as const;

function bucketOf(day: string | null): Bucket {
  if (!day) return "undated";
  const days = daysUntil(day);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

type Row = { kind: "task"; task: Task; day: string | null } | { kind: "deadline"; deadline: Deadline; day: string };

export function TodosView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState<"task" | "deadline" | null>(null);
  const [filter, setFilter] = useState<"all" | "tasks" | "deadlines">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // All deadlines: the done and past ones stay visible below.
      const [open, d] = await Promise.all([api.tasks({ open: true }), api.deadlines()]);
      setTasks(open);
      setDeadlines(d);
      setLoaded(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useChanged(load);

  const rows: Row[] = [
    ...(filter !== "deadlines" ? tasks.map((task) => ({ kind: "task" as const, task, day: task.plannedDate })) : []),
    ...(filter !== "tasks" ? deadlines.filter(deadlineOpen).map((deadline) => ({ kind: "deadline" as const, deadline, day: deadlineDay(deadline) })) : []),
  ].sort((a, b) => (a.day ?? "9999").localeCompare(b.day ?? "9999"));

  return (
    <div className="page">
      <SectionHeader
        level={1}
        size="xl"
        title={t.todos.title}
        description={t.todos.subtitle}
        action={
          <>
            <Button icon="plus" variant={adding === "task" ? "primary" : "secondary"} onClick={() => setAdding(adding === "task" ? null : "task")}>
              {t.tasks.add}
            </Button>
            <Button icon="flag" variant={adding === "deadline" ? "primary" : "secondary"} onClick={() => setAdding(adding === "deadline" ? null : "deadline")}>
              {t.deadlines.add}
            </Button>
          </>
        }
      />
      <SegmentedControl
        label={t.todos.show}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t.todos.all },
          { value: "tasks", label: t.tasks.title, icon: "checklist" },
          { value: "deadlines", label: t.deadlines.title, icon: "flag" },
        ]}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      {adding && (
        <Card>
          {adding === "task" ? (
            <TaskForm
              deadlines={deadlines}
              submitLabel={t.common.add}
              onCancel={() => setAdding(null)}
              onSubmit={async (draft) => {
                await api.createTask(draft);
                await load();
              }}
            />
          ) : (
            <DeadlineForm
              submitLabel={t.common.add}
              onCancel={() => setAdding(null)}
              onSubmit={async (draft) => {
                await api.createDeadline(draft);
                setAdding(null);
                await load();
              }}
            />
          )}
        </Card>
      )}
      {loaded && rows.length === 0 && <EmptyState illustration="fertig" title={t.todos.allDone} />}
      {BUCKETS.map((bucket) => {
        const inBucket = rows.filter((r) => bucketOf(r.day) === bucket);
        if (inBucket.length === 0) return null;
        return (
          <Card as="section" key={bucket} aria-labelledby={`b-${bucket}`}>
            <SectionHeader id={`b-${bucket}`} title={t.todos.buckets[bucket]} action={<Chip tone={BUCKET_TONE[bucket]}>{inBucket.length}</Chip>} />
            <List className="card-list">
              {inBucket.map((row) =>
                row.kind === "task" ? (
                  <TaskRow key={`t${row.task.id}`} task={row.task} onChanged={load} />
                ) : (
                  <DeadlineRow key={`d${row.deadline.id}`} deadline={row.deadline} onChanged={load} />
                ),
              )}
            </List>
          </Card>
        );
      })}
      {filter !== "tasks" && settledDeadlines(deadlines).length > 0 && (
        <Card as="section" variant="sunken" aria-labelledby="erledigt-titel" id="erledigt">
          <SectionHeader id="erledigt-titel" title={t.deadlines.settled} description={t.deadlines.settledHint} action={<Chip>{settledDeadlines(deadlines).length}</Chip>} />
          <List variant="raised" className="card-list">
            {settledDeadlines(deadlines).map((deadline) => (
              <DeadlineRow key={`s${deadline.id}`} deadline={deadline} onChanged={load} />
            ))}
          </List>
        </Card>
      )}
    </div>
  );
}
