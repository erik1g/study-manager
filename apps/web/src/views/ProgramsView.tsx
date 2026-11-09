import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router";
import type { ModuleData, ProgramDraft } from "@study/shared";
import { Breadcrumb, Button, Card, Chip, EmptyState, List, ListRow, Notice, pickFiles, SearchField, SectionHeader, TextField } from "@study/ui";
import { Dialog } from "../components/Dialog";
import { NewCourseDialog } from "../components/NewCourseDialog";
import { de, errorMessage } from "../i18n/de";
import { api, type Module, type Program } from "../lib/api";
import { useSession } from "../lib/session";

/** Where the degree programmes live: a page of the settings, as one sets them once. */
export const PROGRAMS = "/einstellungen/studiengang";

export function ProgramsView() {
  return (
    <Routes>
      <Route index element={<ProgramList />} />
      <Route path=":id" element={<ProgramDetail />} />
    </Routes>
  );
}

function ProgramList() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => api.programs().then(setPrograms), []);
  useEffect(() => {
    void load();
  }, [load]);
  const sorted = [...(programs ?? [])].sort((a, b) => Number(b.enrolled) - Number(a.enrolled));

  return (
    <div className="ui-stack programs">
      <SectionHeader
        title={de.programs.title}
        size="lg"
        description={de.programs.subtitle}
        action={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {de.programs.add}
          </Button>
        }
      />
      {programs && programs.length === 0 && (
        <EmptyState illustration="buecher" title={de.programs.emptyTitle} actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>{de.programs.add}</Button>}>
          {de.programs.emptyText}
        </EmptyState>
      )}
      {sorted.length > 0 && (
        <Card>
          <List>
            {sorted.map((p) => (
              <ListRow
                key={p.id}
                href={`${PROGRAMS}/${p.id}`}
                linkAs={Link}
                title={`${p.degree ? `${p.degree} ` : ""}${p.name}`}
                meta={`${p.university}${p.regulation ? ` · ${p.regulation}` : ""} · ${de.programs.modules(p.moduleCount)} · ${de.programs.managedBy(p.managerName)}`}
                trailing={p.enrolled && <Chip tone="gruen" icon="check">{de.programs.enrolled}</Chip>}
              />
            ))}
          </List>
        </Card>
      )}
      {creating && (
        <ProgramDialog
          onClose={() => setCreating(false)}
          onSaved={async (id) => {
            setCreating(false);
            navigate(`${PROGRAMS}/${id}`);
          }}
        />
      )}
    </div>
  );
}

function ProgramDialog(props: { program?: Program; onClose: () => void; onSaved: (id: string) => void }) {
  const [draft, setDraft] = useState<ProgramDraft>({
    university: props.program?.university ?? "",
    name: props.program?.name ?? "",
    degree: props.program?.degree ?? "",
    regulation: props.program?.regulation ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (key: keyof ProgramDraft, label: string, required = false) => (
    <TextField label={label} value={draft[key]} required={required} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
  );
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    try {
      if (props.program) {
        await api.updateProgram(props.program.id, draft);
        props.onSaved(props.program.id);
      } else {
        props.onSaved((await api.createProgram(draft)).id);
      }
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={props.program ? de.common.edit : de.programs.add}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>{de.common.cancel}</Button>
          <Button variant="primary" loading={busy} disabled={!draft.university.trim() || !draft.name.trim()} onClick={() => void submit()}>
            {de.common.save}
          </Button>
        </>
      }
    >
      <form className="ui-stack" onSubmit={submit}>
        {field("university", de.programs.university, true)}
        {field("name", de.programs.name, true)}
        <div className="form-grid">
          {field("degree", de.programs.degree)}
          {field("regulation", de.programs.regulation)}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Dialog>
  );
}

const DETAIL_FIELDS: (keyof typeof de.programs.fields)[] = [
  "language",
  "turnus",
  "duration",
  "responsible",
  "lecturers",
  "courses",
  "workload",
  "prerequisites",
  "exam",
  "learningGoals",
  "contents",
];

function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me, reloadCourses } = useSession();
  const [program, setProgram] = useState<Program | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [making, setMaking] = useState<Module | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await api.programs();
    setProgram(all.find((p) => p.id === id) ?? null);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => api.modules(id!, search || undefined).then(setModules), 200);
    return () => clearTimeout(timer);
  }, [id, search, program?.moduleCount]);

  if (!program) return null;
  const manages = program.managerId === me?.id || me?.isAdmin;
  const current = modules.find((m) => m.id === open);

  return (
    <div className="ui-stack programs">
      <Breadcrumb linkAs={Link} items={[{ label: de.programs.title, href: PROGRAMS }, { label: program.name }]} />
      <SectionHeader
        size="lg"
        title={`${program.degree ? `${program.degree} ` : ""}${program.name}`}
        description={`${program.university}${program.regulation ? ` · ${program.regulation}` : ""} · ${de.programs.modules(program.moduleCount)} · ${de.programs.managedBy(program.managerName)}`}
        action={
          <>
            {manages && (
              <Button icon="edit" onClick={() => setEditing(true)}>
                {de.common.edit}
              </Button>
            )}
            <Button variant={program.enrolled ? "secondary" : "primary"} icon={program.enrolled ? "close" : "check"} onClick={() => api.setEnrolled(program.id, !program.enrolled).then(load)}>
              {program.enrolled ? de.programs.unenroll : de.programs.enroll}
            </Button>
          </>
        }
      />
      {error && <Notice tone="danger">{error}</Notice>}
      {manages && (
        <Card tone="blau" className="handbook-card">
          <SectionHeader
            title={de.programs.handbook}
            description={de.programs.importHint}
            action={
              <Button
                icon="upload"
                loading={uploading}
                onClick={async () => {
                  const [file] = await pickFiles({ accept: "application/pdf", multiple: false });
                  if (!file) return;
                  setUploading(true);
                  await api.uploadHandbook(program.id, file).then(load, (err) => setError(errorMessage(err)));
                  setUploading(false);
                }}
              >
                {program.hasHandbook ? de.programs.replaceHandbook : de.programs.uploadHandbook}
              </Button>
            }
          />
          {program.hasHandbook && (
            <Chip tone="gruen" icon="check" onTint>
              {de.programs.handbookThere}
            </Chip>
          )}
        </Card>
      )}
      <SearchField label={de.programs.search} value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} />
      {modules.length === 0 ? (
        <EmptyState variant="plain" size="sm" illustration="suche" title={de.programs.noModules} />
      ) : (
        <Card padding="sm">
          <List>
            {modules.map((m) => (
              <ListRow
                key={m.id}
                onClick={() => setOpen(m.id)}
                leading={<span className="mono quiet module-number">{m.number}</span>}
                title={m.title}
                trailing={de.programs.credits(m.credits ?? null)}
              />
            ))}
          </List>
        </Card>
      )}
      {current && (
        <Dialog
          title={current.title}
          onClose={() => setOpen(null)}
          wide
          footer={
            <>
              {manages && (
                <Button
                  variant="danger"
                  icon="trash"
                  onClick={() =>
                    api.deleteModule(current.id).then(
                      () => {
                        setOpen(null);
                        return load();
                      },
                      (e) => setError(errorMessage(e)),
                    )
                  }
                >
                  {de.programs.deleteModule}
                </Button>
              )}
              <Button
                variant="primary"
                icon="plus"
                onClick={() => {
                  setOpen(null);
                  setMaking(current);
                }}
              >
                {de.programs.createSubject}
              </Button>
            </>
          }
        >
          <p className="quiet">{`${current.number} · ${de.programs.credits(current.credits ?? null)}`}</p>
          <dl className="module-fields">
            {DETAIL_FIELDS.filter((key) => (current as ModuleData)[key]).map((key) => (
              <div key={key}>
                <dt>{de.programs.fields[key]}</dt>
                <dd>{String((current as ModuleData)[key])}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
      {making && (
        <NewCourseDialog
          module={making}
          onClose={() => setMaking(null)}
          onCreated={async (course) => {
            setMaking(null);
            await reloadCourses();
            navigate(`/fach/${course.id}`);
          }}
        />
      )}
      {editing && (
        <ProgramDialog
          program={program}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
