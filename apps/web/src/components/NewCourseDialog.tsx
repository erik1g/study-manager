import { useEffect, useState, type FormEvent } from "react";
import { Button, List, ListRow, Notice, SearchField, SegmentedControl, Select, TextField } from "@study/ui";
import { de, errorMessage, nextSemesters, semesterName, semesterOf } from "../i18n/de";
import { api, type Course, type Module, type Program } from "../lib/api";
import { Dialog } from "./Dialog";

/** Makes a subject from a module of the catalogue, or by hand. */
export function NewCourseDialog({ onClose, onCreated, module: preset }: { onClose: () => void; onCreated: (course: Course) => void; module?: Module }) {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [mode, setMode] = useState<"module" | "hand">("module");
  const [programId, setProgramId] = useState(preset?.programId ?? "");
  const [search, setSearch] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [moduleId, setModuleId] = useState(preset?.id ?? "");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState("");
  const [semester, setSemester] = useState(semesterOf());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.programs().then((all) => {
      const mine = all.filter((p) => p.enrolled);
      setPrograms(mine);
      if (!preset && mine.length === 0) setMode("hand");
      if (!programId && mine[0]) setProgramId(mine[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!programId || mode !== "module") return;
    const timer = setTimeout(() => api.modules(programId, search || undefined).then(setModules), 200);
    return () => clearTimeout(timer);
  }, [programId, search, mode]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const course =
        mode === "module"
          ? await api.createCourse({ semester, moduleId })
          : await api.createCourse({ semester, title, credits: credits ? Number(credits.replace(",", ".")) : null });
      onCreated(course);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={de.newCourse.title}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>{de.common.cancel}</Button>
          <Button variant="primary" loading={busy} disabled={mode === "module" ? !moduleId : !title.trim()} onClick={() => void submit()}>
            {de.newCourse.create}
          </Button>
        </>
      }
    >
      <form className="ui-stack" onSubmit={submit}>
        {!preset && (
          <SegmentedControl
            label={de.newCourse.title}
            value={mode}
            onChange={setMode}
            options={[
              { value: "module", label: de.newCourse.fromModule, icon: "book" },
              { value: "hand", label: de.newCourse.byHand, icon: "edit" },
            ]}
          />
        )}
        {mode === "module" ? (
          programs && programs.length === 0 && !preset ? (
            <Notice>{de.newCourse.noPrograms}</Notice>
          ) : preset ? (
            <p>
              <span className="mono">{preset.number}</span> {preset.title}
            </p>
          ) : (
            <>
              {programs && programs.length > 1 && (
                <Select label={de.newCourse.program} value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.university}
                    </option>
                  ))}
                </Select>
              )}
              <SearchField label={de.newCourse.search} value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} autoFocus />
              <div className="pick-list">
                <List>
                  {modules.map((m) => (
                    <ListRow
                      key={m.id}
                      selected={moduleId === m.id}
                      onClick={() => setModuleId(m.id)}
                      leading={<span className="mono quiet">{m.number}</span>}
                      title={m.title}
                      trailing={de.programs.credits(m.credits ?? null)}
                    />
                  ))}
                </List>
              </div>
            </>
          )
        ) : (
          <div className="form-grid">
            <TextField className="wide" label={de.newCourse.name} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            <TextField label={de.newCourse.credits} value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="decimal" />
          </div>
        )}
        <Select label={de.newCourse.semester} value={semester} onChange={(e) => setSemester(e.target.value)}>
          {nextSemesters().map((id) => (
            <option key={id} value={id}>
              {semesterName(id)}
            </option>
          ))}
        </Select>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Dialog>
  );
}
