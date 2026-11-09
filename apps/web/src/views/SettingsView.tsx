// The settings, one page per topic with a menu beside them (a list of the
// topics on phones).
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import {
  Breadcrumb,
  Button,
  Card,
  Chip,
  Icon,
  List,
  ListRow,
  NavItem,
  NavSection,
  Notice,
  pickFiles,
  SectionHeader,
  SegmentedControl,
  Select,
  Slider,
  TextField,
  TonePicker,
  type IconName,
  type Tone,
} from "@study/ui";
import { Avatar } from "../components/Avatar";
import { CopyField, ConfirmDialog, Dialog } from "../components/Dialog";
import { TranscriptionSettings } from "../components/TranscriptionSettings";
import { ProgramsView } from "./ProgramsView";
import { de, errorMessage, formatDate, formatDateTime, today } from "../i18n/de";
import { api, type DeletionCheck, type Feed, type Series } from "../lib/api";
import { auth, mailEnabled } from "../lib/auth";
import { useSession } from "../lib/session";
import { saveTheme, storedTheme, type Theme } from "../lib/theme";
import { toneOf } from "../lib/tone";

const PAGES: { path: string; label: string; icon: IconName }[] = [
  { path: "profil", label: de.settings.profile, icon: "person" },
  { path: "darstellung", label: de.settings.appearance, icon: "palette" },
  { path: "sicherheit", label: de.settings.security, icon: "lock" },
  { path: "studiengang", label: de.settings.programs, icon: "book" },
  { path: "kalender", label: de.settings.calendarPage, icon: "calendar" },
  { path: "transkription", label: de.settings.transcription, icon: "mic" },
  { path: "claude", label: de.settings.claude, icon: "claude" },
];

/** Phones show the menu and a page one after the other. */
function useNarrow() {
  const query = "(max-width: 760px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const change = () => setNarrow(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, []);
  return narrow;
}

export function SettingsView() {
  const narrow = useNarrow();
  const location = useLocation();
  const atMenu = /^\/einstellungen\/?$/.test(location.pathname);
  const current = PAGES.find((p) => location.pathname.startsWith(`/einstellungen/${p.path}`));

  if (atMenu && !narrow) return <Navigate to="/einstellungen/profil" replace />;

  return (
    <div className="page">
      {narrow && !atMenu && current ? (
        <div className="ui-stack">
          <Breadcrumb linkAs={Link} items={[{ label: de.settings.title, href: "/einstellungen" }, { label: current.label }]} />
          <SectionHeader level={1} size="xl" title={current.label} />
        </div>
      ) : (
        <SectionHeader level={1} size="xl" title={de.settings.title} />
      )}
      <div className="settings-layout">
        {narrow && atMenu && (
          <Card padding="sm">
            <List>
              {PAGES.map((p) => (
                <ListRow
                  key={p.path}
                  href={`/einstellungen/${p.path}`}
                  linkAs={Link}
                  leading={<Icon name={p.icon} size={22} />}
                  title={p.label}
                  trailing={<Icon name="chevron-right" size={18} />}
                />
              ))}
            </List>
          </Card>
        )}
        {!narrow && (
          <Card as="nav" padding="sm" className="settings-nav" aria-label={de.settings.title}>
            <NavSection>
              {PAGES.map((p) => (
                <NavItem key={p.path} icon={p.icon} label={p.label} href={`/einstellungen/${p.path}`} linkAs={Link} active={current?.path === p.path} />
              ))}
            </NavSection>
          </Card>
        )}
        {!atMenu && (
          <div className="settings-page">
            <Routes>
              <Route path="profil" element={<ProfilePage />} />
              <Route path="darstellung" element={<Appearance />} />
              <Route path="sicherheit" element={<Security />} />
              <Route
                path="kalender"
                element={
                  <>
                    <PhoneCalendar />
                    <Feeds />
                  </>
                }
              />
              <Route path="studiengang/*" element={<ProgramsView />} />
              <Route path="transkription" element={<TranscriptionSettings />} />
              <Route path="claude" element={<Claude />} />
              <Route path="*" element={<Navigate to="/einstellungen/profil" replace />} />
            </Routes>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, text, children, danger, action }: { title: string; text?: string; children: ReactNode; danger?: boolean; action?: ReactNode }) {
  const id = useId();
  return (
    <Card as="section" tone={danger ? "rot" : undefined} className="settings-section" aria-labelledby={id}>
      <SectionHeader id={id} title={title} description={text} action={action} />
      <div className="ui-stack settings-section-body">{children}</div>
    </Card>
  );
}

function Sub({ title, text }: { title: string; text?: string }) {
  return (
    <div className="settings-sub">
      <h3>{title}</h3>
      {text && <p className="quiet small">{text}</p>}
    </div>
  );
}

// --- Profile -----------------------------------------------------------------

function ProfilePage() {
  return (
    <>
      <Profile />
      <DeleteAccount />
    </>
  );
}

function Profile() {
  const { me, reloadMe, reloadPeople } = useSession();
  const [name, setName] = useState(me?.displayName ?? "");
  const [studies, setStudies] = useState(me?.studies ?? "");
  const [semester, setSemester] = useState(me?.semester ? String(me.semester) : "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picture, setPicture] = useState<string | null>(null);

  const touched = () => setSaved(false);
  const refresh = async () => {
    await reloadMe();
    await reloadPeople();
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.updateProfile({ displayName: name, studies: studies.trim() || null, semester: semester ? Number(semester) : null });
      await refresh();
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;
  return (
    <Section title={de.settings.profile} text={de.settings.profileText}>
      <div className="profile-picture">
        <Avatar userId={me.id} name={me.displayName} size={88} version={me.avatarVersion} />
        <div className="ui-stack">
          <strong>{de.settings.picture}</strong>
          <div className="toolbar-row">
            <Button
              size="sm"
              icon="camera"
              onClick={async () => {
                const [file] = await pickFiles({ accept: "image/*", multiple: false });
                if (file) setPicture(URL.createObjectURL(file));
              }}
            >
              {me.avatarVersion != null ? de.settings.pictureChange : de.settings.pictureChoose}
            </Button>
            {me.avatarVersion != null && (
              <Button size="sm" variant="ghost" onClick={() => api.removeAvatar().then(refresh)}>
                {de.settings.pictureRemove}
              </Button>
            )}
          </div>
        </div>
      </div>
      {picture && (
        <CropDialog
          src={picture}
          onClose={() => {
            URL.revokeObjectURL(picture);
            setPicture(null);
          }}
          onDone={async (blob) => {
            await api.uploadAvatar(blob);
            await refresh();
          }}
        />
      )}

      <form className="entry-form" onSubmit={save}>
        <TextField label={de.settings.name} value={name} maxLength={80} onChange={(e) => (setName(e.target.value), touched())} required />
        <TextField label={de.settings.semester} type="number" min={1} max={30} value={semester} onChange={(e) => (setSemester(e.target.value), touched())} />
        <TextField
          className="wide"
          label={de.settings.studies}
          value={studies}
          maxLength={120}
          placeholder={de.settings.studiesPlaceholder}
          onChange={(e) => (setStudies(e.target.value), touched())}
        />
        <EmailField current={me.email} />
        {error && (
          <Notice tone="danger" className="wide">
            {error}
          </Notice>
        )}
        <div className="form-actions wide">
          {saved && <Chip tone="gruen" icon="check">{de.settings.profileSaved}</Chip>}
          <Button type="submit" variant="primary" loading={busy}>
            {de.common.save}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/** The address, changed by confirming it from the old and the new mailbox. */
function EmailField({ current }: { current: string }) {
  const [email, setEmail] = useState(current);
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!mailEnabled) {
    return <TextField className="wide" label={de.settings.email} value={current} disabled hint={de.settings.emailLocked} />;
  }
  const change = async () => {
    setState("busy");
    setError(null);
    const { error } = await auth().auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/einstellungen/profil` });
    if (error) {
      setError(error.message);
      setState("idle");
    } else setState("sent");
  };
  return (
    <div className="wide ui-stack">
      <div className="field-with-button">
        <TextField label={de.settings.email} type="email" value={email} onChange={(e) => (setEmail(e.target.value), setState("idle"))} error={error ?? undefined} />
        <Button loading={state === "busy"} disabled={email.trim().toLowerCase() === current} onClick={change}>
          {de.settings.emailChange}
        </Button>
      </div>
      {state === "sent" && <Notice tone="success">{de.settings.emailSent(email.trim())}</Notice>}
    </div>
  );
}

const CROP = 240;
const OUTPUT = 512;

/** Cuts a square out of a picture: drag to move, slider to zoom. */
function CropDialog({ src, onClose, onDone }: { src: string; onClose: () => void; onDone: (picture: Blob) => Promise<void> }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; start: { x: number; y: number } } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError(de.errors.avatar_type);
    img.src = src;
  }, [src]);

  // At zoom 1 the shorter side fills the square.
  const scale = image ? (CROP / Math.min(image.naturalWidth, image.naturalHeight)) * zoom : 1;
  const width = (image?.naturalWidth ?? 0) * scale;
  const height = (image?.naturalHeight ?? 0) * scale;
  const clamp = (value: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(CROP - width, value.x)),
    y: Math.min(0, Math.max(CROP - height, value.y)),
  });

  // Centred at first, and kept inside the square while zooming.
  useEffect(() => {
    if (image) setOffset((o) => clamp(o.x === 0 && o.y === 0 && zoom === 1 ? { x: (CROP - width) / 2, y: (CROP - height) / 2 } : o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, zoom]);

  const down = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: offset };
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.start.x + e.clientX - drag.current.x, y: drag.current.start.y + e.clientY - drag.current.y }));
  };

  async function save() {
    if (!image) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const factor = OUTPUT / CROP;
    canvas.getContext("2d")!.drawImage(image, offset.x * factor, offset.y * factor, width * factor, height * factor);
    // Safari cannot write WebP and hands back PNG; JPEG is smaller then.
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
    if (!blob || blob.type !== "image/webp") blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    try {
      await onDone(blob!);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={de.settings.pictureCrop}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{de.common.cancel}</Button>
          <Button variant="primary" loading={busy} disabled={!image} onClick={save}>
            {de.settings.pictureSave}
          </Button>
        </>
      }
    >
      <div className="ui-stack">
        <p className="quiet small">{de.settings.pictureCropText}</p>
        <div className="crop-frame" style={{ width: CROP, height: CROP }} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)}>
          {image && <img src={src} alt="" draggable={false} style={{ width, height, transform: `translate(${offset.x}px, ${offset.y}px)` }} />}
        </div>
        <Slider label={de.settings.pictureZoom} min={1} max={4} step={0.01} value={zoom} onChange={setZoom} format={(v) => `${v.toFixed(1)} ×`} />
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <Section
      title={de.settings.deleteAccount}
      text={de.settings.deleteText}
      danger
      action={
        <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>
          {de.settings.deleteStart}
        </Button>
      }
    >
      {open && <DeleteDialog onClose={() => setOpen(false)} />}
    </Section>
  );
}

/** Hands over shared subjects, asks the user to sign in again and to type their address. */
function DeleteDialog({ onClose }: { onClose: () => void }) {
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  const [check, setCheck] = useState<DeletionCheck | null>(null);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.deletionCheck().then(setCheck, (e) => setError(errorMessage(e))), []);
  useEffect(() => {
    void load();
  }, [load]);

  const proved = (problem: { message: string } | null) => {
    if (problem) setError(problem.message);
    else {
      setError(null);
      setConfirmed(true);
    }
  };

  if (!me) return null;
  const blocked = !check || check.lastAdmin || check.handOver.length > 0;
  return (
    <Dialog
      title={de.settings.deleteAccount}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{de.common.cancel}</Button>
          <Button
            variant="danger"
            icon="trash"
            loading={busy}
            disabled={blocked || !confirmed || email.trim().toLowerCase() !== me.email}
            onClick={async () => {
              setBusy(true);
              try {
                await api.deleteAccount(email);
                await signOut();
                navigate("/anmelden", { replace: true });
              } catch (e) {
                setError(errorMessage(e));
                setBusy(false);
              }
            }}
          >
            {de.settings.deleteFinal}
          </Button>
        </>
      }
    >
      <div className="ui-stack">
        {!check ? null : check.lastAdmin ? (
          <Notice tone="danger">{de.settings.deleteLastAdmin}</Notice>
        ) : check.handOver.length > 0 ? (
          <>
            <p>{de.settings.deleteHandOver}</p>
            <List>
              {check.handOver.map((h) => (
                <ListRow
                  key={h.courseId}
                  title={h.title}
                  meta={h.semester}
                  trailing={
                    <Button size="sm" onClick={() => api.setRole(h.courseId, h.successor.userId, "owner").then(load, (e) => setError(errorMessage(e)))}>
                      {de.settings.deleteHandOverTo(h.successor.displayName)}
                    </Button>
                  }
                />
              ))}
            </List>
          </>
        ) : (
          <>
            {check.alone.length > 0 && <Notice tone="warning">{de.settings.deleteAlone(check.alone.map((a) => a.title).join(", "))}</Notice>}
            {!confirmed ? (
              <>
                <p>{de.settings.deleteConfirmSignIn}</p>
                <form
                  className="field-with-button"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const { error } = await auth().auth.signInWithPassword({ email: me.email, password });
                    proved(error);
                  }}
                >
                  <TextField label={de.settings.currentPassword} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <Button type="submit" disabled={!password}>
                    {de.settings.deleteConfirmPassword}
                  </Button>
                </form>
                <div>
                  <Button icon="key" onClick={async () => proved((await auth().auth.signInWithPasskey()).error)}>
                    {de.settings.deleteConfirmPasskey}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Notice tone="success">{de.settings.deleteConfirmed}</Notice>
                <TextField label={de.settings.deleteTypeEmail(me.email)} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              </>
            )}
          </>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}

// --- Appearance ---------------------------------------------------------------

function Appearance() {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const choose = (next: Theme) => {
    saveTheme(next);
    setTheme(next);
  };
  return (
    <Section title={de.settings.appearance} text={de.settings.appearanceText}>
      <SegmentedControl
        label={de.settings.appearance}
        value={theme}
        onChange={choose}
        options={[
          { value: "light", label: de.settings.themes.light, icon: "sun" },
          { value: "dark", label: de.settings.themes.dark, icon: "star" },
          { value: "system", label: de.settings.themes.system, icon: "settings" },
        ]}
      />
      <div className="theme-previews" aria-hidden="true">
        <div className="theme-preview ui-theme-light">
          <span className="ui-display">Aa</span>
          <i className="ui-tone-blau" />
          <i className="ui-tone-orange" />
        </div>
        <div className="theme-preview ui-theme-dark">
          <span className="ui-display">Aa</span>
          <i className="ui-tone-blau" />
          <i className="ui-tone-orange" />
        </div>
      </div>
      <p className="quiet small">{de.settings.motionHint}</p>
    </Section>
  );
}

// --- Security, calendar, Claude ---------------------------------------------

function Security() {
  const [passkeys, setPasskeys] = useState<{ id: string; friendly_name?: string; created_at: string; last_used_at?: string }[]>([]);
  const [factors, setFactors] = useState<{ id: string; status: string }[]>([]);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: keys }, { data: mfa }] = await Promise.all([auth().auth.passkey.list(), auth().auth.mfa.listFactors()]);
    setPasskeys(keys ?? []);
    setFactors((mfa?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const show = (ok: string | null, problem?: { message: string } | null) => {
    setError(problem ? problem.message : null);
    setMessage(problem ? null : ok);
  };

  async function enrollTotp() {
    // A setup that was started but not finished is replaced.
    for (const factor of factors.filter((f) => f.status !== "verified")) await auth().auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await auth().auth.mfa.enroll({ factorType: "totp", friendlyName: "Study Manager" });
    if (error) return show(null, error);
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyTotp(event: FormEvent) {
    event.preventDefault();
    if (!enrolling) return;
    const { error } = await auth().auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
    if (error) return show(null, error);
    setEnrolling(null);
    setCode("");
    show(de.settings.totpActive);
    await load();
  }

  const verified = factors.some((f) => f.status === "verified");
  return (
    <Section title={de.settings.security}>
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      <Sub title={de.settings.passkeys} />
      {passkeys.length > 0 && (
        <List>
          {passkeys.map((p) => (
            <ListRow
              key={p.id}
              leading={<Icon name="key" size={22} />}
              title={p.friendly_name || "Passkey"}
              meta={formatDateTime(p.created_at)}
              trailing={
                <Button size="sm" variant="ghost" onClick={() => auth().auth.passkey.delete({ passkeyId: p.id }).then(load)}>
                  {de.common.delete}
                </Button>
              }
            />
          ))}
        </List>
      )}
      <div>
        <Button
          icon="plus"
          onClick={async () => {
            const { error } = await auth().auth.registerPasskey();
            show(de.settings.passkeyAdded, error);
            await load();
          }}
        >
          {de.settings.addPasskey}
        </Button>
      </div>

      <Sub title={de.settings.totp} text={de.settings.totpText} />
      {verified ? (
        <div>
          <Chip tone="gruen" icon="check">
            {de.settings.totpActive}
          </Chip>
        </div>
      ) : enrolling ? (
        <form className="ui-stack" onSubmit={verifyTotp}>
          <img className="qr" src={enrolling.qr} alt="QR-Code für die Authenticator-App" width={180} height={180} />
          <code className="mono small">{enrolling.secret}</code>
          <div className="field-with-button">
            <TextField label={de.settings.totpCode} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button type="submit" variant="primary">
              {de.settings.totpVerify}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button icon="shield" onClick={enrollTotp}>
            {de.settings.totpSetup}
          </Button>
        </div>
      )}

      <Sub title={de.settings.password} />
      <form
        className="field-with-button"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await auth().auth.updateUser({ password });
          show(de.settings.passwordSaved, error);
          if (!error) setPassword("");
        }}
      >
        <TextField label={de.settings.newPassword} type="password" autoComplete="new-password" minLength={10} hint={de.settings.passwordHint} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={password.length < 10}>
          {de.common.save}
        </Button>
      </form>
    </Section>
  );
}

function PhoneCalendar() {
  const { me, reloadMe } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Section title={de.settings.calendar} text={de.settings.calendarText}>
      {me && <CopyField value={me.icalUrl.replace(/^https:/, "webcal:")} />}
      <div className="toolbar-row">
        <Button
          size="sm"
          icon="restore"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await api.renewIcal();
            await reloadMe();
            setBusy(false);
          }}
        >
          {de.settings.renewIcal}
        </Button>
        <span className="quiet small">{de.settings.renewHint}</span>
      </div>
    </Section>
  );
}

function Feeds() {
  const { courses } = useSession();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState<Tone | null>("grau");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, s] = await Promise.all([api.feeds(), api.series()]);
    setFeeds(f);
    setSeries(s);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.addFeed({ name, url, color });
      setName("");
      setUrl("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={de.settings.feeds} text={de.settings.feedsText}>
      {error && <Notice tone="danger">{error}</Notice>}
      {feeds.length > 0 && (
        <List>
          {feeds.map((f) => (
            <ListRow
              key={f.id}
              leading={<span className={`time-dot ui-tone-${toneOf(f.color)}`} aria-hidden="true" />}
              title={f.name}
              meta={f.error ? <span className="danger-text">{f.error}</span> : f.fetchedAt ? de.settings.feedFetched(formatDateTime(f.fetchedAt)) : undefined}
              trailing={
                <>
                  <Button size="sm" icon="restore" onClick={() => api.refreshFeed(f.id).then(load, (e) => setError(errorMessage(e)))}>
                    {de.settings.feedRefresh}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => api.removeFeed(f.id).then(load)}>
                    {de.common.delete}
                  </Button>
                </>
              }
            />
          ))}
        </List>
      )}
      <Card variant="sunken" padding="sm">
        <form className="entry-form" onSubmit={add}>
          <TextField label={de.settings.feedName} value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField className="wide" label={de.settings.feedUrl} value={url} onChange={(e) => setUrl(e.target.value)} required />
          <div className="wide ui-stack">
            <span className="ui-field-label">{de.settings.feedColor}</span>
            <TonePicker label={de.settings.feedColor} value={color} onChange={setColor} />
          </div>
          <div className="form-actions wide">
            <Button type="submit" variant="primary" icon="plus" loading={busy}>
              {de.settings.feedAdd}
            </Button>
          </div>
        </form>
      </Card>

      {series.length > 0 && (
        <>
          <Sub title={de.settings.series} text={de.settings.seriesText} />
          <List>
            {series.map((s) => {
              const value = s.decided ? (s.courseId ?? "") : (s.suggestion ?? "");
              return (
                <ListRow
                  key={`${s.feedId}|${s.title}`}
                  title={s.title}
                  meta={`${s.count}×`}
                  trailing={
                    <>
                      {!s.decided && s.suggestion && (
                        <Chip tone="gelb" size="sm">
                          {de.settings.seriesSuggestion}
                        </Chip>
                      )}
                      <Select label={de.settings.seriesFor(s.title)} hideLabel size="sm" value={value} onChange={(e) => api.assignSeries(s.feedId, s.title, e.target.value || null).then(load)}>
                        <option value="">{de.settings.seriesNone}</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </Select>
                      {!s.decided && s.suggestion && (
                        <Button size="sm" variant="primary" icon="check" onClick={() => api.assignSeries(s.feedId, s.title, s.suggestion).then(load)}>
                          {de.settings.seriesAccept}
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </List>
        </>
      )}
    </Section>
  );
}

/** Everything that reaches the Study Manager on the user's behalf: apps let in by login, and personal keys. */
type Connection =
  | { kind: "app"; id: string; name: string; detail: string; lastUsedAt: string | null; since: string }
  | { kind: "key"; id: string; name: string; lastUsedAt: string | null; since: string; expiresAt: string };

type Way = "claude" | "code" | "other";
const WAY_ICON: Record<Way, IconName> = { claude: "claude", code: "code", other: "link" };

function Claude() {
  const { me } = useSession();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [way, setWay] = useState<Way | null>(null);
  const [shown, setShown] = useState<{ way: Way; secret: string } | null>(null);
  const [name, setName] = useState("");
  const [newest, setNewest] = useState<string | null>(null);
  const [ending, setEnding] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mcpUrl = me?.mcpUrl ?? "";

  const load = useCallback(async () => {
    try {
      const [apps, keys] = await Promise.all([api.connectedApps(), api.keys()]);
      const list: Connection[] = [
        ...apps.map((a) => ({ kind: "app" as const, id: a.clientId, name: a.name, detail: a.redirectHosts.join(", "), lastUsedAt: a.lastUsedAt, since: a.grantedAt })),
        ...keys.map((k) => ({ kind: "key" as const, id: k.id, name: k.name, lastUsedAt: k.lastUsedAt, since: k.createdAt, expiresAt: k.expiresAt })),
      ];
      // The most recently used first; never used ones by when they were made.
      list.sort((x, y) => (y.lastUsedAt ?? y.since).localeCompare(x.lastUsedAt ?? x.since));
      setConnections(list);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const choose = (next: Way) => {
    setWay(way === next ? null : next);
    setShown(null);
    setName("");
  };

  async function makeKey(target: Way, keyName: string) {
    setError(null);
    try {
      const created = await api.createKey(keyName);
      setNewest(created.id);
      setShown({
        way: target,
        secret:
          target === "code"
            ? `claude mcp remove -s user study-manager >/dev/null 2>&1; claude mcp add -s user --transport http study-manager ${mcpUrl} --header "Authorization: Bearer ${created.key}"`
            : created.key,
      });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

  return (
    <>
      <Section title={de.settings.connectNew} text={de.settings.claudeText}>
        <div className="connect-ways">
          {(["claude", "code", "other"] as const).map((value) => (
            <Card
              key={value}
              as="button"
              type="button"
              tone={way === value ? "gelb" : undefined}
              variant="sunken"
              interactive
              padding="sm"
              aria-pressed={way === value}
              className="connect-way"
              onClick={() => choose(value)}
            >
              <Icon name={WAY_ICON[value]} size={24} />
              <strong>{de.settings.ways[value].title}</strong>
              <span className="small">{de.settings.ways[value].text}</span>
            </Card>
          ))}
        </div>

        {way === "claude" && (
          <ol className="connect-steps">
            <li>{de.settings.claudeStep1}</li>
            <li>
              {de.settings.claudeStep2}
              <CopyField value={mcpUrl} />
            </li>
            <li>{de.settings.claudeStep3}</li>
          </ol>
        )}

        {way === "code" &&
          (shown?.way === "code" ? (
            <Notice tone="success" title={de.settings.codeShown}>
              <CopyField value={shown.secret} />
            </Notice>
          ) : (
            <div className="ui-stack">
              <p className="quiet small">{de.settings.codeText}</p>
              <div>
                <Button variant="primary" icon="key" onClick={() => makeKey("code", `Claude Code · ${formatDate(today())}`)}>
                  {de.settings.codeMake}
                </Button>
              </div>
            </div>
          ))}

        {way === "other" &&
          (shown?.way === "other" ? (
            <Notice tone="success" title={de.settings.otherShown}>
              <div className="ui-stack">
                <CopyField value={mcpUrl} label={de.settings.mcpUrl} />
                <CopyField value={shown.secret} label={de.settings.otherKey} />
              </div>
            </Notice>
          ) : (
            <form
              className="ui-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void makeKey("other", name.trim());
              }}
            >
              <p className="quiet small">{de.settings.otherText}</p>
              <div className="field-with-button">
                <TextField label={de.settings.otherName} value={name} onChange={(e) => setName(e.target.value)} required />
                <Button type="submit" variant="primary" icon="key" disabled={!name.trim()}>
                  {de.settings.otherMake}
                </Button>
              </div>
            </form>
          ))}
      </Section>

      <Section title={de.settings.connections} text={de.settings.connectionsText}>
        {error && <Notice tone="danger">{error}</Notice>}
        {connections && connections.length === 0 && <p className="quiet">{de.settings.connectionsEmpty}</p>}
        {connections && connections.length > 0 && (
          <List>
            {connections.map((c) => (
              <ListRow
                key={`${c.kind}-${c.id}`}
                rowClassName={c.id === newest ? "row-new" : undefined}
                leading={<Icon name={c.kind === "app" ? "claude" : "key"} size={22} />}
                title={
                  <>
                    {c.name} <Chip size="sm">{c.kind === "app" ? de.settings.byLogin : de.settings.byKey}</Chip>
                    {c.id === newest && (
                      <>
                        {" "}
                        <Chip size="sm" tone="gruen">
                          {de.settings.keyNew}
                        </Chip>
                      </>
                    )}
                  </>
                }
                meta={
                  <>
                    {c.lastUsedAt ? de.settings.lastActive(formatDateTime(c.lastUsedAt)) : de.settings.neverActive}
                    {c.kind === "app" && c.detail && ` · ${c.detail}`}
                    {c.kind === "key" && ` · ${de.settings.keyExpires(formatDate(c.expiresAt), daysLeft(c.expiresAt))}`}
                  </>
                }
                trailing={
                  <>
                    {c.kind === "key" && (
                      <Button size="sm" onClick={() => api.extendKey(c.id).then(load)}>
                        {de.settings.keyExtend}
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => setEnding(c)}>
                      {de.settings.disconnect}
                    </Button>
                  </>
                }
              />
            ))}
          </List>
        )}
        {ending && (
          <ConfirmDialog
            title={de.settings.disconnect}
            text={de.settings.disconnectConfirm(ending.name)}
            confirm={de.settings.disconnect}
            danger
            onClose={() => setEnding(null)}
            onConfirm={() => (ending.kind === "app" ? api.disconnectApp(ending.id) : api.revokeKey(ending.id)).then(load)}
          />
        )}
      </Section>
    </>
  );
}
