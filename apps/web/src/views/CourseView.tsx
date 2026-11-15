import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams, useParams } from "react-router";
import { atLeast, COURSE_ROLES, FILE_FOLDERS, type CourseRole, type FileFolder } from "@study/shared";
import {
  AvatarGroup,
  Breadcrumb,
  Button,
  Card,
  Chip,
  EmptyState,
  FileTile,
  fileKind,
  Icon,
  IconButton,
  Illustration,
  List,
  ListRow,
  Notice,
  PageSkeleton,
  pickFiles,
  ProgressRing,
  SearchField,
  SectionHeader,
  Select,
  Tabs,
  TextField,
  toast,
} from "@study/ui";
import { DeadlineForm, DeadlineRow, TaskForm, TaskRow, deadlineOpen, settledDeadlines } from "../components/Agenda";
import { ActivityFeed, ActivityList } from "../components/ActivityFeed";
import { Avatar } from "../components/Avatar";
import { ContextMenu, MenuItem, MenuSeparator, menuPositionFrom, type MenuPosition } from "../components/ContextMenu";
import { ConfirmDialog, CopyField, Dialog } from "../components/Dialog";
import { DocumentViewer } from "../components/DocumentViewer";
import { FlashcardsTab } from "../components/FlashcardsTab";
import { LectureMode } from "../components/LectureMode";
import { LecturesTab } from "../components/LecturesTab";
import { NotesTab } from "../components/NotesTab";
import { t, errorMessage, formatDateTime, formatShortDate, formatSize, formatTime, formatWeekTime, semesterName } from "../i18n";
import { api, type ActivityEntry, type Course, type CourseFile, type Deadline, type Member, type PendingInvitation, type PersonMatch, type SearchHit, type Session, type Task } from "../lib/api";
import { emitChanged, useChanged } from "../lib/events";
import { useGo } from "../lib/motion";
import { useCourseTitles, useSession } from "../lib/session";
import { courseIcon, toneOf } from "../lib/tone";

/** The parts of a subject one works in, and those one looks at now and then. */
const MAIN_TABS = ["ueberblick", "dokumente", "notizen", "vorlesungen", "lernkarten"] as const;
const MORE_TABS = ["mitglieder", "aktivitaet", "papierkorb"] as const;
const TABS = [...MAIN_TABS, ...MORE_TABS];
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  ueberblick: t.course.tabs.overview,
  dokumente: t.course.tabs.documents,
  notizen: t.course.tabs.notes,
  vorlesungen: t.course.tabs.lectures,
  lernkarten: t.course.tabs.cards,
  mitglieder: t.course.tabs.members,
  aktivitaet: t.course.tabs.activity,
  papierkorb: t.course.tabs.trash,
};

export function CourseView() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "ueberblick";
  const show = (value: Tab) => setParams(value === "ueberblick" ? {} : { tab: value });
  // The lecture mode lives in the address, so that a reload stays in it.
  const lecture = params.get("modus") === "vorlesung";
  const enterLecture = (file: CourseFile | null, withNotes = false) => {
    const next = new URLSearchParams();
    if (tab !== "ueberblick") next.set("tab", tab);
    next.set("modus", "vorlesung");
    if (file) next.set("datei", file.id);
    if (file && withNotes) next.set("mit", "notizen");
    setParams(next);
  };
  const exitLecture = useCallback(() => setParams(tab === "ueberblick" ? {} : { tab }), [setParams, tab]);
  const lectureEntered = useCallback(() => {
    if (!params.has("datei")) return;
    const next = new URLSearchParams(params);
    next.delete("datei");
    next.delete("mit");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const load = useCallback(() => api.course(id!).then(setCourse, (e) => setError(errorMessage(e))), [id]);
  useEffect(() => {
    void load();
    void api.members(id!).then(setMembers, () => {});
  }, [load, id]);

  if (error)
    return (
      <div className="page">
        <EmptyState illustration="fehler" title={error} actions={<Button icon="arrow-left" onClick={() => history.back()}>{t.common.back}</Button>} />
      </div>
    );
  if (!course) return <PageSkeleton />;
  const canEdit = atLeast(course.role, "editor");
  const tone = toneOf(course.color);
  const wide = tab === "dokumente" || tab === "notizen";
  if (lecture) {
    return <LectureMode course={course} initialFile={params.get("datei")} withNotes={params.get("mit") === "notizen"} onEntered={lectureEntered} onExit={exitLecture} />;
  }
  const tabs = [...MAIN_TABS, ...((MORE_TABS as readonly string[]).includes(tab) ? [tab] : [])].map((value) => ({ id: value, label: TAB_LABEL[value as Tab] }));

  return (
    <div className={`page course-page ${wide ? "course-wide" : ""}`}>
      <Card as="header" tone={tone} glow grain className={tab === "ueberblick" ? "course-head" : "course-head compact"} style={{ viewTransitionName: `fach-${course.id}` }}>
        <div className="course-head-text">
          <Breadcrumb linkAs={Link} items={[{ label: t.nav.subjects, href: "/faecher" }, { label: semesterName(course.semester) }]} />
          <div className="course-head-title">
            <span className="course-icon big" aria-hidden="true">
              <Icon name={courseIcon(course.title)} size={32} />
            </span>
            <h1 className="ui-display">{course.title}</h1>
          </div>
          <p className="course-head-meta">
            {[course.number, t.roles[course.role], course.credits != null ? t.programs.credits(course.credits) : null].filter(Boolean).join(" · ")}
          </p>
          {members.length > 0 && (
            <div className="course-head-people">
              <AvatarGroup label={t.members.count(members.length)}>
                {members.map((m) => (
                  <Avatar key={m.userId} userId={m.userId} name={m.displayName} size={34} decorative />
                ))}
              </AvatarGroup>
              <span>{members.length === 1 ? t.members.count(1) : members.map((m) => m.displayName.split(" ")[0]).join(", ")}</span>
            </div>
          )}
        </div>
        <Illustration kind="buecher" className="course-head-picture" />
      </Card>

      <div className="course-tabs-row">
        <Tabs
          label={t.course.areas}
          items={tabs}
          active={tab}
          onSelect={(value) => show(value as Tab)}
          trailing={
            <IconButton
              icon="more"
              label={t.course.more}
              aria-haspopup="menu"
              aria-expanded={menu !== null}
              onClick={(event) => setMenu(menuPositionFrom(event.currentTarget))}
            />
          }
        />
        {menu && (
          <ContextMenu at={menu} label={t.course.more} onClose={() => setMenu(null)}>
            {MORE_TABS.map((value) => (
              <MenuItem
                key={value}
                icon={value === "mitglieder" ? "people" : value === "aktivitaet" ? "clock" : "trash"}
                onSelect={() => {
                  setMenu(null);
                  show(value);
                }}
              >
                {TAB_LABEL[value]}
              </MenuItem>
            ))}
          </ContextMenu>
        )}
      </div>

      <div className={wide ? "course-work" : "course-body"} key={tab}>
        {!canEdit && ["dokumente", "ueberblick", "papierkorb"].includes(tab) && <Notice>{t.course.readOnly}</Notice>}
        {tab === "ueberblick" && <OverviewTab course={course} canEdit={canEdit} />}
        {tab === "dokumente" && <DocumentsTab course={course} onLecture={enterLecture} />}
        {tab === "notizen" && <NotesTab course={course} onLecture={(file) => enterLecture(file, true)} />}
        {tab === "vorlesungen" && <LecturesTab course={course} />}
        {tab === "lernkarten" && <FlashcardsTab course={course} />}
        {tab === "mitglieder" && <MembersTab course={course} onChanged={load} />}
        {tab === "aktivitaet" && <ActivityTab course={course} />}
        {tab === "papierkorb" && <TrashTab course={course} />}
      </div>
    </div>
  );
}

// --- Overview --------------------------------------------------------------

function OverviewTab({ course, canEdit }: { course: Course; canEdit: boolean }) {
  const [allDeadlines, setAllDeadlines] = useState<Deadline[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recent, setRecent] = useState<ActivityEntry[]>([]);
  const [adding, setAdding] = useState<"deadline" | "task" | null>(null);
  const [allSessions, setAllSessions] = useState(false);

  const load = useCallback(async () => {
    const [d, open, s, a] = await Promise.all([api.deadlines({ courseId: course.id }), api.tasks({ courseId: course.id, open: true }), api.sessions(course.id), api.courseActivity(course.id)]);
    setAllDeadlines(d);
    setTasks(open);
    setSessions(s);
    setRecent(a.slice(0, 5));
  }, [course.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const changed = useCallback(() => {
    void load();
    emitChanged();
  }, [load]);
  useChanged(load);

  const deadlines = allDeadlines.filter(deadlineOpen);
  const settled = settledDeadlines(allDeadlines);
  const now = new Date();
  const held = sessions.filter((s) => !s.cancelled);
  const done = held.filter((s) => new Date(s.end) <= now).length;
  const next = held.find((s) => new Date(s.end) > now);
  const tone = toneOf(course.color);

  return (
    <div className="course-grid-2">
      <div className="ui-stack course-col">
        <Card as="section" className="progress-card" aria-labelledby="verlauf">
          {held.length > 0 && (
            <ProgressRing value={done / held.length} label={t.course.progressText(done, held.length)} tone={tone} size={104} thickness={12} animateKey={`subject-${course.id}`}>
              <span className="progress-card-number">
                {done}
                <small>/{held.length}</small>
              </span>
            </ProgressRing>
          )}
          <div className="progress-card-text">
            <SectionHeader id="verlauf" title={t.course.progress} description={held.length > 0 ? t.course.progressText(done, held.length) : t.course.sessionsEmpty} />
            {next && (
              <p>
                <strong>{t.course.nextSession}:</strong> {formatWeekTime(next.start)}
                {next.location && ` · ${next.location}`}
              </p>
            )}
            {held.length > 0 && (
              <Button variant="ghost" size="sm" icon={allSessions ? "chevron-down" : "chevron-right"} onClick={() => setAllSessions(!allSessions)}>
                {allSessions ? t.course.hideSessions : t.course.showSessions}
              </Button>
            )}
          </div>
        </Card>
        {allSessions && (
          <Card as="section" aria-labelledby="sitzungen">
            <SectionHeader id="sitzungen" title={t.course.sessions} />
            <List ordered className="card-list">
              {sessions.map((s) => (
                <ListRow
                  key={s.id}
                  rowClassName={s.cancelled || new Date(s.end) < now ? "row-past" : undefined}
                  leading={<span className="mono quiet session-number">{t.course.session(s.number, s.total)}</span>}
                  title={s.title}
                  meta={s.location ?? undefined}
                  trailing={`${formatShortDate(s.start)} ${formatTime(s.start)}`}
                />
              ))}
            </List>
          </Card>
        )}
        <Card as="section" aria-labelledby="termine">
          <SectionHeader
            id="termine"
            title={t.course.datesAndTasks}
            action={
              <>
                {canEdit && (
                  <Button size="sm" icon="flag" onClick={() => setAdding(adding === "deadline" ? null : "deadline")}>
                    {t.course.addDeadline}
                  </Button>
                )}
                <Button size="sm" icon="plus" onClick={() => setAdding(adding === "task" ? null : "task")}>
                  {t.course.addTask}
                </Button>
              </>
            }
          />
          {adding === "deadline" && (
            <div className="row-editing">
              <DeadlineForm
                courseId={course.id}
                submitLabel={t.common.add}
                onCancel={() => setAdding(null)}
                onSubmit={async (draft) => {
                  await api.createDeadline({ ...draft, courseId: course.id });
                  setAdding(null);
                  changed();
                }}
              />
            </div>
          )}
          {adding === "task" && (
            <div className="row-editing">
              <TaskForm
                courseId={course.id}
                deadlines={deadlines}
                submitLabel={t.common.add}
                onCancel={() => setAdding(null)}
                onSubmit={async (draft) => {
                  await api.createTask({ ...draft, courseId: course.id });
                  setAdding(null);
                  changed();
                }}
              />
            </div>
          )}
          {deadlines.length + tasks.length === 0 ? (
            <p className="card-quiet quiet">{t.course.nothingDue}</p>
          ) : (
            <List className="card-list">
              {deadlines.map((d) => (
                <DeadlineRow key={d.id} deadline={d} onChanged={changed} showCourse={false} />
              ))}
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} onChanged={changed} showCourse={false} />
              ))}
            </List>
          )}
          {tasks.length > 0 && <p className="quiet small">{t.tasks.privateHint}</p>}
        </Card>
        {settled.length > 0 && (
          <Card as="section" variant="sunken" aria-labelledby="erledigt">
            <SectionHeader id="erledigt" title={t.deadlines.settled} description={t.deadlines.settledHint} action={<Chip>{settled.length}</Chip>} />
            <List variant="raised" className="card-list">
              {settled.map((d) => (
                <DeadlineRow key={d.id} deadline={d} onChanged={changed} showCourse={false} />
              ))}
            </List>
          </Card>
        )}
      </div>
      <Card as="section" aria-labelledby="neu" className="course-col">
        <SectionHeader id="neu" title={t.course.recent} />
        {recent.length === 0 ? <p className="card-quiet quiet">{t.activity.empty}</p> : <ActivityList entries={recent} compact />}
      </Card>
    </div>
  );
}

// --- Documents -------------------------------------------------------------

function DocumentsTab({ course, onLecture }: { course: Course; onLecture: (file: CourseFile | null) => void }) {
  const [params] = useSearchParams();
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [selected, setSelected] = useState<CourseFile | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ skripte: true, uebungen: true, altklausuren: true, sonstiges: true });
  const [uploading, setUploading] = useState(0);
  const [dropTarget, setDropTarget] = useState<FileFolder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ file: CourseFile; at: MenuPosition } | null>(null);
  const [renaming, setRenaming] = useState<CourseFile | null>(null);
  const canEdit = atLeast(course.role, "editor");

  const load = useCallback(() => api.files(course.id).then(setFiles, (e) => setError(errorMessage(e))), [course.id]);
  useEffect(() => {
    void load();
  }, [load]);

  // A link from the quick search opens a document at its page.
  useEffect(() => {
    const wanted = files.find((f) => f.id === params.get("datei"));
    if (wanted) {
      setSelected(wanted);
      setPage(params.get("seite") ? Number(params.get("seite")) : null);
    }
  }, [files, params]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return setHits(null);
    const timer = setTimeout(() => api.searchCourse(course.id, q).then(setHits, () => setHits([])), 350);
    return () => clearTimeout(timer);
  }, [query, course.id]);

  async function upload(folder: FileFolder, list: File[]) {
    if (list.length === 0) return;
    setUploading(list.length);
    setError(null);
    try {
      const saved = await api.upload(course.id, folder, list);
      await load();
      if (saved[0]) setSelected(saved[0]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(0);
    }
  }

  const openMenu = (file: CourseFile, at: MenuPosition) => canEdit && setMenu({ file, at });

  return (
    <div className="work-split">
      <aside className="file-tree" aria-label={t.course.tabs.documents}>
        <SearchField label={t.search.placeholder.replace(" …", "")} value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
        {error && <Notice tone="danger">{error}</Notice>}
        {uploading > 0 && <Notice>{t.course.uploading(uploading)}</Notice>}
        {hits && (
          <List>
            {hits.length === 0 && <ListRow title={t.search.none} />}
            {hits.map((hit, i) => (
              <ListRow
                key={i}
                title={
                  <>
                    {hit.name} <span className="quiet">{t.search.page(hit.page)}</span>
                  </>
                }
                meta={`${hit.text.slice(0, 160)} …`}
                onClick={() => {
                  const file = files.find((f) => f.id === hit.fileId);
                  if (file) {
                    setSelected(file);
                    setPage(hit.page);
                  }
                }}
              />
            ))}
          </List>
        )}
        {!hits &&
          FILE_FOLDERS.map((folder) => {
            const inFolder = files.filter((f) => f.folder === folder);
            return (
              <section
                key={folder}
                className={`folder ${dropTarget === folder ? "folder-drop" : ""}`}
                aria-label={t.folders[folder]}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDropTarget(folder);
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  if (canEdit) void upload(folder, Array.from(e.dataTransfer.files));
                }}
              >
                <div className="folder-head">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={open[folder] ? "chevron-down" : "chevron-right"}
                    aria-expanded={!!open[folder]}
                    onClick={() => setOpen({ ...open, [folder]: !open[folder] })}
                    className="folder-switch"
                  >
                    {t.folders[folder]} <span className="quiet">{inFolder.length}</span>
                  </Button>
                  {canEdit && <IconButton icon="upload" size="sm" label={t.course.uploadTo(t.folders[folder])} onClick={async () => upload(folder, await pickFiles())} />}
                </div>
                {open[folder] &&
                  (inFolder.length === 0 ? (
                    <p className="folder-empty quiet small">{canEdit ? t.course.dropHere : t.course.emptyFolder}</p>
                  ) : (
                    <List>
                      {inFolder.map((file) => (
                        <ListRow
                          key={file.id}
                          selected={selected?.id === file.id}
                          onClick={() => {
                            setSelected(file);
                            setPage(null);
                          }}
                          onContextMenu={(e) => {
                            if (!canEdit) return;
                            e.preventDefault();
                            openMenu(file, { x: e.clientX, y: e.clientY });
                          }}
                          leading={<FileTile kind={fileKind(file.name, file.mime)} size={34} />}
                          title={file.name}
                          meta={`${formatShortDate(file.createdAt)} · ${formatSize(file.size)}`}
                          actions={
                            canEdit ? (
                              <IconButton icon="more" size="sm" label={t.course.fileActions(file.name)} onClick={(e) => openMenu(file, menuPositionFrom(e.currentTarget))} />
                            ) : undefined
                          }
                        />
                      ))}
                    </List>
                  ))}
              </section>
            );
          })}
      </aside>
      <section className="work-pane">
        {selected ? (
          <DocumentViewer
            key={selected.id}
            file={selected}
            page={page}
            actions={
              <Button size="sm" icon="expand" onClick={() => onLecture(selected)}>
                {t.lecture.enter}
              </Button>
            }
          />
        ) : files.length === 0 ? (
          <EmptyState
            illustration="buecher"
            title={t.course.noFiles}
            actions={canEdit && <Button variant="primary" icon="upload" onClick={async () => upload("skripte", await pickFiles())}>{t.course.upload}</Button>}
          >
            {t.course.noFilesText}
          </EmptyState>
        ) : (
          <EmptyState variant="plain" size="sm" illustration="buecher" title={t.course.selectTitle}>
            {t.course.select}
          </EmptyState>
        )}
      </section>
      {menu && (
        <ContextMenu at={menu.at} label={menu.file.name} onClose={() => setMenu(null)}>
          <MenuItem
            icon="edit"
            onSelect={() => {
              setRenaming(menu.file);
              setMenu(null);
            }}
          >
            {t.course.rename}
          </MenuItem>
          <MenuSeparator />
          {FILE_FOLDERS.filter((f) => f !== menu.file.folder).map((folder) => (
            <MenuItem
              key={folder}
              icon="folder"
              onSelect={async () => {
                setMenu(null);
                await api.updateFile(menu.file.id, { folder }).catch((e) => setError(errorMessage(e)));
                await load();
              }}
            >
              {t.course.moveTo} {t.folders[folder]}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem
            icon="trash"
            danger
            onSelect={async () => {
              const file = menu.file;
              setMenu(null);
              await api.trashFile(file.id).catch((e) => setError(errorMessage(e)));
              if (selected?.id === file.id) setSelected(null);
              await load();
            }}
          >
            {t.course.trash}
          </MenuItem>
        </ContextMenu>
      )}
      {renaming && (
        <RenameDialog
          file={renaming}
          onClose={() => setRenaming(null)}
          onSaved={async (file) => {
            setRenaming(null);
            await load();
            if (selected?.id === file.id) setSelected(file);
          }}
        />
      )}
    </div>
  );
}

function RenameDialog({ file, onClose, onSaved }: { file: CourseFile; onClose: () => void; onSaved: (file: CourseFile) => void }) {
  const [name, setName] = useState(file.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await api.updateFile(file.id, { name }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t.course.rename}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void save()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form
        className="ui-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField label={t.course.newName} value={name} onChange={(e) => setName(e.target.value)} autoFocus error={error ?? undefined} />
      </form>
    </Dialog>
  );
}

// --- Members ---------------------------------------------------------------

function MembersTab({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const { me, reloadCourses } = useSession();
  const go = useGo();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteRole, setInviteRole] = useState<CourseRole>("editor");
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const owner = course.role === "owner";

  const load = useCallback(() => api.members(course.id).then(setMembers, (e) => setError(errorMessage(e))), [course.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (operation: Promise<unknown>) => {
    setError(null);
    try {
      await operation;
      await load();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="narrow ui-stack">
      {error && <Notice tone="danger">{error}</Notice>}
      <Card as="section" aria-labelledby="mitglieder">
        <SectionHeader id="mitglieder" title={t.members.count(members.length)} />
        <List className="card-list">
          {members.map((m) => (
            <ListRow
              key={m.userId}
              leading={<Avatar userId={m.userId} name={m.displayName} size={40} decorative />}
              title={
                <>
                  {m.displayName}
                  {m.userId === me?.id && <span className="quiet"> ({t.members.you})</span>}
                </>
              }
              meta={m.email}
              trailing={
                <>
                  {owner ? (
                    <Select label={t.course.roleOf(m.displayName)} hideLabel size="sm" value={m.role} onChange={(e) => run(api.setRole(course.id, m.userId, e.target.value as CourseRole))}>
                      {COURSE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t.roles[role]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Chip>{t.roles[m.role]}</Chip>
                  )}
                  {owner && m.userId !== me?.id && (
                    <Button size="sm" variant="ghost" onClick={() => run(api.removeMember(course.id, m.userId))}>
                      {t.members.remove}
                    </Button>
                  )}
                  {m.userId === me?.id && (
                    <Button size="sm" variant="danger" onClick={() => setLeaving(true)}>
                      {t.members.leave}
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </List>
        <dl className="role-legend">
          {COURSE_ROLES.map((role) => (
            <div key={role}>
              <dt>{t.roles[role]}</dt>
              <dd>{t.roleHints[role]}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {owner && <InvitePeople course={course} onChanged={() => void load()} />}
      {owner && (
        <Card as="section" variant="sunken" aria-labelledby="einladen">
          <SectionHeader id="einladen" title={t.members.byLink} description={t.members.inviteHint} />
          <div className="invite-row">
            <Select label={t.members.inviteRole} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as CourseRole)}>
              {COURSE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t.roles[role]}
                </option>
              ))}
            </Select>
            <Button icon="link" onClick={async () => setInvite((await api.createInvite(course.id, inviteRole)).url)}>
              {t.members.invite}
            </Button>
          </div>
          {invite && <CopyField value={invite} label={t.members.inviteLink} />}
        </Card>
      )}
      {leaving && (
        <ConfirmDialog
          title={t.overview.leave}
          text={t.course.leaveConfirm(course.title)}
          confirm={t.members.leave}
          danger
          onClose={() => setLeaving(false)}
          onConfirm={async () => {
            await api.removeMember(course.id, me!.id);
            await reloadCourses();
            go("/");
          }}
        />
      )}
    </div>
  );
}

/** Finding people who have an account and inviting them; the invitation waits in their notifications. */
function InvitePeople({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<CourseRole>("editor");
  const [matches, setMatches] = useState<PersonMatch[] | null>(null);
  const [pending, setPending] = useState<PendingInvitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPending = useCallback(() => api.pendingInvitations(course.id).then(setPending, () => {}), [course.id]);
  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return setMatches(null);
    const timer = setTimeout(() => api.findPeople(course.id, term).then(setMatches, (e) => setError(errorMessage(e))), 250);
    return () => clearTimeout(timer);
  }, [query, course.id]);

  async function invite(person: PersonMatch) {
    setBusy(person.id);
    setError(null);
    try {
      await api.inviteUser(course.id, person.id, role);
      toast(t.members.invitedToast(person.displayName), "success");
      setMatches((list) => list?.map((p) => (p.id === person.id ? { ...p, status: "invited" } : p)) ?? null);
      await loadPending();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card as="section" tone="blau" aria-labelledby="hinzufuegen">
      <SectionHeader id="hinzufuegen" title={t.members.addTitle} description={t.members.addText} />
      <div className="invite-search">
        <SearchField label={t.members.search} value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
        <Select label={t.members.role} size="md" value={role} onChange={(e) => setRole(e.target.value as CourseRole)}>
          {COURSE_ROLES.map((r) => (
            <option key={r} value={r}>
              {t.roles[r]}
            </option>
          ))}
        </Select>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {matches && matches.length === 0 && <p className="card-quiet">{t.members.noMatch}</p>}
      {matches && matches.length > 0 && (
        <List variant="raised" className="card-list" aria-label={t.members.search}>
          {matches.map((person) => (
            <ListRow
              key={person.id}
              leading={<Avatar userId={person.id} name={person.displayName} size={36} version={person.hasAvatar ? person.avatarVersion : null} decorative />}
              title={person.displayName}
              meta={person.email}
              trailing={
                person.status === "member" ? (
                  <Chip size="sm">{t.members.isMember}</Chip>
                ) : person.status === "invited" ? (
                  <Chip size="sm" tone="gelb">
                    {t.members.isInvited}
                  </Chip>
                ) : (
                  <Button size="sm" variant="primary" icon="plus" loading={busy === person.id} onClick={() => void invite(person)}>
                    {t.members.inviteOne}
                  </Button>
                )
              }
            />
          ))}
        </List>
      )}
      {pending.length > 0 && (
        <>
          <div className="settings-sub">
            <h3>{t.members.pending}</h3>
          </div>
          <List variant="raised" className="card-list" aria-label={t.members.pending}>
            {pending.map((p) => (
              <ListRow
                key={p.userId}
                leading={<Avatar userId={p.userId} name={p.displayName} size={36} decorative />}
                title={p.displayName}
                meta={`${t.roles[p.role]} · ${formatDateTime(p.createdAt)}`}
                trailing={
                  <Button size="sm" variant="ghost" onClick={() => api.withdrawInvitation(course.id, p.userId).then(loadPending, (e) => setError(errorMessage(e)))}>
                    {t.members.withdraw}
                  </Button>
                }
              />
            ))}
          </List>
        </>
      )}
    </Card>
  );
}

// --- Activity --------------------------------------------------------------

function ActivityTab({ course }: { course: Course }) {
  const courseTitle = useCourseTitles();
  const load = useCallback((before?: string) => api.courseActivity(course.id, before), [course.id]);
  return (
    <Card as="section" className="narrow">
      <ActivityFeed load={load} courseTitle={courseTitle} />
    </Card>
  );
}

// --- Trash -----------------------------------------------------------------

function TrashTab({ course }: { course: Course }) {
  const [files, setFiles] = useState<CourseFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = atLeast(course.role, "editor");
  const load = useCallback(() => api.trash(course.id).then(setFiles, (e) => setError(errorMessage(e))), [course.id]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="narrow ui-stack">
      <p className="quiet">{t.course.trashText}</p>
      {error && <Notice tone="danger">{error}</Notice>}
      {files && files.length === 0 && <EmptyState variant="plain" size="sm" illustration="pflanze" title={t.course.trashEmpty} />}
      {files && files.length > 0 && (
        <Card>
          <List>
            {files.map((f) => (
              <ListRow
                key={f.id}
                leading={<FileTile kind={fileKind(f.name, f.mime)} size={34} />}
                title={f.name}
                meta={`${t.folders[f.folder]} · ${t.course.deletedBy(f.deletedBy, formatDateTime(f.deletedAt!))}`}
                trailing={
                  canEdit && (
                    <Button size="sm" icon="restore" onClick={() => api.restoreFile(f.id).then(load, (e) => setError(errorMessage(e)))}>
                      {t.course.restore}
                    </Button>
                  )
                }
              />
            ))}
          </List>
        </Card>
      )}
    </div>
  );
}

