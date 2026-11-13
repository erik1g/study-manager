// The lectures of a subject: transcripts shared with all members, made in
// the member's browser or with their own key for a transcription service.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { atLeast } from "@study/shared";
import { LANGUAGE_NAMES, t, errorMessage, formatDate, today } from "../i18n";
import { api, type Course, type Recording, type Session } from "../lib/api";
import {
  checkBrowser,
  decodeAudio,
  PROVIDERS,
  rate,
  storedKey,
  storedMethod,
  storedProvider,
  timestamp,
  toMarkdown,
  transcribeInBrowser,
  transcribeWithApi,
  SAMPLE_RATE,
  type Phase,
  type Rating,
} from "../lib/transcribe";
import { Button, Card, Chip, EmptyState, FileDrop, FileTile, List, ListRow, Notice, ProgressBar, SectionHeader, Select, TextField } from "@study/ui";
import { Person } from "./Avatar";
import { ConfirmDialog } from "./Dialog";
import { Rich } from "./Rich";

export function LecturesTab({ course }: { course: Course }) {
  const [params, setParams] = useSearchParams();
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = atLeast(course.role, "editor");
  const selected = params.get("aufnahme");

  const load = useCallback(() => api.recordings(course.id).then(setRecordings, (e) => setError(errorMessage(e))), [course.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("aufnahme", id);
    else next.delete("aufnahme");
    setParams(next);
  };

  if (selected) return <Transcript id={selected} canEdit={canEdit} onBack={() => open(null)} onChanged={load} />;

  return (
    <div className="narrow ui-stack">
      {error && <Notice tone="danger">{error}</Notice>}
      <SectionHeader
        title={t.course.tabs.lectures}
        description={t.lectures.text}
        action={
          canEdit &&
          !transcribing &&
          !!recordings?.length && (
            <Button variant="primary" icon="mic" onClick={() => setTranscribing(true)}>
              {t.lectures.transcribe}
            </Button>
          )
        }
      />
      {transcribing && (
        <TranscribePanel
          course={course}
          onClose={() => setTranscribing(false)}
          onDone={async (id) => {
            setTranscribing(false);
            await load();
            open(id);
          }}
        />
      )}
      {recordings && recordings.length === 0 && !transcribing && (
        <EmptyState
          illustration="kalender"
          title={t.lectures.emptyTitle}
          actions={canEdit && <Button variant="primary" icon="mic" onClick={() => setTranscribing(true)}>{t.lectures.transcribe}</Button>}
        >
          {t.lectures.emptyText}
        </EmptyState>
      )}
      {recordings && recordings.length > 0 && (
        <Card>
          <List>
            {recordings.map((r) => (
              <ListRow
                key={r.id}
                onClick={() => open(r.id)}
                leading={<FileTile kind="audio" size={40} />}
                title={r.title}
                meta={
                  <>
                    {formatDate(r.date)}
                    {r.durationSeconds ? ` · ${timestamp(r.durationSeconds)}` : ""} · <Person userId={r.createdById} name={r.createdBy} size={16} />
                  </>
                }
                trailing={r.analysedAt ? <Chip tone="gruen" icon="check" size="sm">{t.lectures.analysed(r.analysedBy)}</Chip> : <Chip size="sm">{t.lectures.waiting}</Chip>}
              />
            ))}
          </List>
        </Card>
      )}
      <p className="quiet small">{t.lectures.claudeHint}</p>
    </div>
  );
}

function Transcript({ id, canEdit, onBack, onChanged }: { id: string; canEdit: boolean; onBack: () => void; onChanged: () => void }) {
  const [recording, setRecording] = useState<(Recording & { transcript: string }) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.recording(id).then(setRecording, (e) => setError(errorMessage(e)));
  }, [id]);
  return (
    <div className="narrow ui-stack">
      <div className="toolbar-row">
        <Button size="sm" variant="ghost" icon="arrow-left" onClick={onBack}>
          {t.lectures.all}
        </Button>
        <span className="spacer" />
        {recording && (
          <Button
            size="sm"
            icon="download"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([recording.transcript], { type: "text/markdown" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = `${recording.date} ${recording.title}.md`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 5000);
            }}
          >
            {t.common.download}
          </Button>
        )}
        {canEdit && (
          <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleting(true)}>
            {t.common.delete}
          </Button>
        )}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {recording && (
        <Card as="article" padding="lg" className="transcript">
          <Rich>{recording.transcript}</Rich>
        </Card>
      )}
      {deleting && recording && (
        <ConfirmDialog
          title={t.common.delete}
          text={t.lectures.deleteConfirm(recording.title)}
          confirm={t.common.delete}
          danger
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await api.deleteRecording(recording.id);
            onChanged();
            onBack();
          }}
        />
      )}
    </div>
  );
}

function TranscribePanel({ course, onClose, onDone }: { course: Course; onClose: () => void; onDone: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  // Lectures are usually held in the language the course is written in.
  const [language, setLanguage] = useState<string>(course.locale);
  // Chosen in the settings; here it is only shown.
  const [method] = useState(storedMethod);
  const [provider] = useState(storedProvider);
  const [key] = useState(() => storedKey(storedProvider()));
  const [rating, setRating] = useState<Rating | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [phase, setPhase] = useState<{ phase: Phase; fraction: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    api.sessions(course.id).then((all) => setSessions(all.filter((s) => !s.cancelled && new Date(s.start) <= new Date())), () => {});
    void checkBrowser().then((check) => setRating(rate(check)));
  }, [course.id]);

  async function start(event?: FormEvent) {
    event?.preventDefault();
    if (!file) return;
    setError(null);
    abort.current = new AbortController();
    const progress = (p: Phase, fraction: number) => setPhase({ phase: p, fraction });
    try {
      const samples = await decodeAudio(file, progress);
      const duration = Math.round(samples.length / SAMPLE_RATE);
      const lang = language === "auto" ? null : language;
      let segments;
      if (method === "api") {
        segments = await transcribeWithApi(samples, { provider, key: key.trim(), language: lang }, progress, abort.current.signal);
      } else {
        segments = await transcribeInBrowser(samples, lang, progress, abort.current.signal);
      }
      if (segments.length === 0) throw new Error(t.lectures.nothingHeard);
      progress("uploading", 0);
      const name = title.trim() || file.name.replace(/\.[^.]+$/, "");
      const markdown = toMarkdown(name, course, date, lang, duration, segments);
      const { id } = await api.createRecording(course.id, { title: name, date, language: lang, durationSeconds: duration, transcript: markdown });
      onDone(id);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      // A broken download of the model reads as a bare "Failed to fetch".
      setError(/failed to fetch|network/i.test((e as Error).message ?? "") ? t.lectures.downloadFailed : errorMessage(e));
      setPhase(null);
    }
  }

  const busy = phase !== null;
  const missingKey = method === "api" && !key;
  const slow = method === "browser" && rating === "slow";
  return (
    <Card as="form" tone="violett" className="ui-stack" onSubmit={start}>
      <SectionHeader title={t.lectures.transcribe} />
      {file ? (
        <Card variant="surface" padding="sm" className="chosen-file">
          <span className="chosen-file-name">{file.name}</span>
          {!busy && (
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
              {t.lectures.otherFile}
            </Button>
          )}
        </Card>
      ) : (
        <FileDrop label={t.lectures.file} hint={t.lectures.fileHint} accept="audio/*,video/*" multiple={false} disabled={busy} onFiles={(files) => setFile(files[0] ?? null)} />
      )}
      {sessions.length > 0 && (
        <Select
          label={t.lectures.session}
          disabled={busy}
          defaultValue=""
          onChange={(e) => {
            const session = sessions.find((s) => s.id === e.target.value);
            if (!session) return;
            setTitle(`${session.title.split(",")[0]}${session.number ? ` · Sitzung ${session.number}` : ""}`);
            setDate(new Date(session.start).toLocaleDateString("sv-SE"));
          }}
        >
          <option value="">–</option>
          {[...sessions].reverse().map((s) => (
            <option key={s.id} value={s.id}>
              {formatDate(s.start)} · {s.title}
            </option>
          ))}
        </Select>
      )}
      <div className="form-grid three">
        <TextField label={t.lectures.title} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name} />
        <TextField label={t.lectures.date} type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} required />
        <Select label={t.lectures.language} value={language} disabled={busy} onChange={(e) => setLanguage(e.target.value)}>
          <option value="de">{LANGUAGE_NAMES.de}</option>
          <option value="en">{LANGUAGE_NAMES.en}</option>
          <option value="auto">{t.lectures.auto}</option>
        </Select>
      </div>
      <Notice tone={missingKey ? "warning" : slow ? "warning" : "info"}>
        {missingKey ? t.lectures.noKey : method === "api" ? t.lectures.usesKey(PROVIDERS[provider].name) : slow ? t.lectures.usesSlowBrowser : t.lectures.usesBrowser}{" "}
        <Link to="/einstellungen/transkription">{t.lectures.toSettings}</Link>
      </Notice>
      {phase && (
        <div className="ui-stack">
          <ProgressBar value={phase.fraction} label={t.lectures.phases[phase.phase]} tone="violett" />
          <p className="quiet small">{t.lectures.keepOpen}</p>
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="form-actions">
        <Button
          onClick={() => {
            abort.current?.abort();
            onClose();
          }}
        >
          {busy ? t.lectures.cancel : t.common.cancel}
        </Button>
        {!busy && (
          <Button type="submit" variant="primary" icon="play" disabled={!file || missingKey}>
            {t.lectures.start}
          </Button>
        )}
      </div>
    </Card>
  );
}
