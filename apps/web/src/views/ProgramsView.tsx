import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router";
import type { ModuleData, ProgramDraft } from "@study/shared";
import { Breadcrumb, Button, Card, Chip, EmptyState, List, ListRow, Notice, pickFiles, SearchField, SectionHeader, TextField } from "@study/ui";
import { Dialog } from "../components/Dialog";
import { NewCourseDialog } from "../components/NewCourseDialog";
import { t, errorMessage } from "../i18n";
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
        title={t.programs.title}
        size="lg"
        description={t.programs.subtitle}
        action={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t.programs.add}
          </Button>
        }
      />
      {programs && programs.length === 0 && (
        <EmptyState illustration="buecher" title={t.programs.emptyTitle} actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>{t.programs.add}</Button>}>
          {t.programs.emptyText}
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
                meta={`${p.university}${p.regulation ? ` · ${p.regulation}` : ""} · ${t.programs.modules(p.moduleCount)} · ${t.programs.managedBy(p.managerName)}`}
                trailing={p.enrolled && <Chip tone="gruen" icon="check">{t.programs.enrolled}</Chip>}
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
      title={props.program ? t.common.edit : t.programs.add}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={busy} disabled={!draft.university.trim() || !draft.name.trim()} onClick={() => void submit()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form className="ui-stack" onSubmit={submit}>
        {field("university", t.programs.university, true)}
        {field("name", t.programs.name, true)}
        <div className="form-grid">
          {field("degree", t.programs.degree)}
          {field("regulation", t.programs.regulation)}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Dialog>
  );
}

const DETAIL_FIELDS: (keyof typeof t.programs.fields)[] = [
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
      <Breadcrumb linkAs={Link} items={[{ label: t.programs.title, href: PROGRAMS }, { label: program.name }]} />
      <SectionHeader
        size="lg"
        title={`${program.degree ? `${program.degree} ` : ""}${program.name}`}
        description={`${program.university}${program.regulation ? ` · ${program.regulation}` : ""} · ${t.programs.modules(program.moduleCount)} · ${t.programs.managedBy(program.managerName)}`}
        action={
          <>
            {manages && (
              <Button icon="edit" onClick={() => setEditing(true)}>
                {t.common.edit}
              </Button>
            )}
            <Button variant={program.enrolled ? "secondary" : "primary"} icon={program.enrolled ? "close" : "check"} onClick={() => api.setEnrolled(program.id, !program.enrolled).then(load)}>
              {program.enrolled ? t.programs.unenroll : t.programs.enroll}
            </Button>
          </>
        }
      />
      {error && <Notice tone="danger">{error}</Notice>}
      {manages && (
        <Card tone="blau" className="handbook-card">
          <SectionHeader
            title={t.programs.handbook}
            description={t.programs.importHint}
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
                {program.hasHandbook ? t.programs.replaceHandbook : t.programs.uploadHandbook}
              </Button>
            }
          />
          {program.hasHandbook && (
            <Chip tone="gruen" icon="check" onTint>
              {t.programs.handbookThere}
            </Chip>
          )}
        </Card>
      )}
      <SearchField label={t.programs.search} value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} />
      {modules.length === 0 ? (
        <EmptyState variant="plain" size="sm" illustration="suche" title={t.programs.noModules} />
      ) : (
        <Card padding="sm">
          <List>
            {modules.map((m) => (
              <ListRow
                key={m.id}
                onClick={() => setOpen(m.id)}
                leading={<span className="mono quiet module-number">{m.number}</span>}
                title={m.title}
                trailing={t.programs.credits(m.credits ?? null)}
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
                  {t.programs.deleteModule}
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
                {t.programs.createSubject}
              </Button>
            </>
          }
        >
          <p className="quiet">{`${current.number} · ${t.programs.credits(current.credits ?? null)}`}</p>
          <dl className="module-fields">
            {DETAIL_FIELDS.filter((key) => (current as ModuleData)[key]).map((key) => (
              <div key={key}>
                <dt>{t.programs.fields[key]}</dt>
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
