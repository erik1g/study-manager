import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, Checkbox, Chip, EmptyState, IconButton, List, ListRow, Notice, SectionHeader, Select, TextField } from "@study/ui";
import { ActivityFeed } from "../components/ActivityFeed";
import { Avatar } from "../components/Avatar";
import { ContextMenu, MenuItem, MenuSeparator, menuPositionFrom, type MenuPosition } from "../components/ContextMenu";
import { ConfirmDialog, CopyField, Dialog } from "../components/Dialog";
import { t, errorMessage, formatDateTime, formatSize } from "../i18n";
import { ApiError, api, type ServerStatus, type UserView } from "../lib/api";
import { useSession } from "../lib/session";

const GB = 1024 ** 3;

export function AdminView() {
  const { me } = useSession();
  const [users, setUsers] = useState<UserView[]>([]);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ title: string; url: string } | null>(null);
  const [removing, setRemoving] = useState<UserView | null>(null);
  const [emailOf, setEmailOf] = useState<UserView | null>(null);
  const [quotaOf, setQuotaOf] = useState<UserView | null>(null);
  const [menu, setMenu] = useState<{ user: UserView; at: MenuPosition } | null>(null);
  const [mailed, setMailed] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [actor, setActor] = useState("");
  const loadActivity = useCallback((before?: string) => api.admin.activity(actor || undefined, before), [actor]);

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([api.admin.users(), api.admin.status()]);
      setUsers(u);
      setStatus(s);
    } catch (e) {
      if (e instanceof ApiError && e.code === "admin_needs_second_factor") setBlocked(true);
      else setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (operation: Promise<unknown>) => {
    setError(null);
    try {
      await operation;
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const choose = (action: (user: UserView) => void) => () => {
    const user = menu!.user;
    setMenu(null);
    action(user);
  };

  if (blocked) {
    return (
      <div className="page">
        <EmptyState illustration="fehler" title={t.admin.title}>
          {t.admin.needsFactor}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page">
      <SectionHeader level={1} size="xl" title={t.admin.title} />
      {error && <Notice tone="danger">{error}</Notice>}
      {link && (
        <Notice tone="info" title={link.title} action={<IconButton icon="close" size="sm" label={t.common.close} onClick={() => setLink(null)} />}>
          <CopyField value={link.url} />
        </Notice>
      )}

      <Card as="section" aria-labelledby="nutzer">
        <SectionHeader id="nutzer" title={t.admin.users} />
        <Card variant="sunken" padding="sm" className="admin-invite">
          <InviteForm
            onInvited={async (result, email) => {
              setLink(result.link ? { title: t.admin.inviteLink, url: result.link } : null);
              setMailed(result.mailed ? email : null);
              await load();
            }}
          />
        </Card>
        {mailed && <Notice tone="success">{t.admin.inviteMailed(mailed)}</Notice>}
        <List className="card-list">
          {users.map((u) => (
            <ListRow
              key={u.id}
              rowClassName={u.disabled ? "row-past" : undefined}
              leading={<Avatar userId={u.id} name={u.displayName} size={40} decorative />}
              title={
                <>
                  {u.displayName}{" "}
                  {u.isAdmin && (
                    <Chip size="sm" tone="violett" icon="shield">
                      Admin
                    </Chip>
                  )}{" "}
                  {u.disabled && (
                    <Chip size="sm" tone="rot">
                      {t.admin.disabled}
                    </Chip>
                  )}
                </>
              }
              meta={`${u.email} · ${t.admin.lastSignIn(u.lastSignInAt && formatDateTime(u.lastSignInAt))} · ${t.admin.used(formatSize(u.usedBytes), u.quotaBytes ? formatSize(u.quotaBytes) : null)}`}
              trailing={<IconButton icon="more" size="sm" label={t.common.actionsFor(u.displayName)} onClick={(e) => setMenu({ user: u, at: menuPositionFrom(e.currentTarget) })} />}
            />
          ))}
        </List>
      </Card>

      {menu && (
        <ContextMenu at={menu.at} label={t.common.actionsFor(menu.user.displayName)} onClose={() => setMenu(null)}>
          <MenuItem icon="edit" onSelect={choose(setEmailOf)}>
            {t.admin.changeEmail}
          </MenuItem>
          <MenuItem icon="folder" onSelect={choose(setQuotaOf)}>
            {t.admin.quota}
          </MenuItem>
          <MenuItem icon="key" onSelect={choose(async (u) => setLink({ title: t.admin.resetLink, url: (await api.admin.resetLink(u.id)).link }))}>
            {t.admin.resetLink}
          </MenuItem>
          {menu.user.id !== me?.id && (
            <>
              <MenuSeparator />
              <MenuItem icon="shield" onSelect={choose((u) => void run(api.admin.update(u.id, { isAdmin: !u.isAdmin })))}>
                {menu.user.isAdmin ? t.admin.revokeAdmin : t.admin.makeAdminShort}
              </MenuItem>
              <MenuItem icon="lock" onSelect={choose((u) => void run(api.admin.update(u.id, { disabled: !u.disabled })))}>
                {menu.user.disabled ? t.admin.enable : t.admin.disable}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon="trash" danger onSelect={choose(setRemoving)}>
                {t.common.delete}
              </MenuItem>
            </>
          )}
        </ContextMenu>
      )}

      <Card as="section" aria-labelledby="aktivitaet">
        <SectionHeader
          id="aktivitaet"
          title={t.admin.activity}
          description={t.admin.activityText}
          action={
            <Select label={t.admin.activityWho} hideLabel size="sm" value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">{t.admin.activityAll}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </Select>
          }
        />
        <ActivityFeed key={actor} load={loadActivity} showCourse />
      </Card>

      {status && (
        <Card as="section" aria-labelledby="server">
          <SectionHeader id="server" title={t.admin.server} />
          <div className="stats">
            {status.disk && (
              <Card tone="blau" padding="sm">
                <span className="stat-label">{t.admin.disk}</span>
                <strong className="ui-display">{formatSize(status.disk.free)}</strong>
                <span className="small">frei von {formatSize(status.disk.total)}</span>
              </Card>
            )}
            <Card tone="petrol" padding="sm">
              <span className="stat-label">{t.admin.database}</span>
              <strong className="ui-display">{formatSize(status.databaseBytes)}</strong>
            </Card>
            <Card tone="violett" padding="sm">
              <span className="stat-label">{t.admin.files}</span>
              <strong className="ui-display">{status.files}</strong>
              <span className="small">{formatSize(status.fileBytes)}</span>
            </Card>
            <Card tone="gelb" padding="sm">
              <span className="stat-label">{t.admin.usersAndCourses}</span>
              <strong className="ui-display">
                {status.users} · {status.courses}
              </strong>
            </Card>
          </div>
          <div className="settings-sub">
            <h3>{t.admin.backups}</h3>
          </div>
          <div className="toolbar-row">
            <Button
              icon="download"
              loading={backingUp}
              onClick={async () => {
                setBackingUp(true);
                await run(api.admin.backup());
                setBackingUp(false);
              }}
            >
              {t.admin.backupNow}
            </Button>
          </div>
          {status.backups.length === 0 ? (
            <p className="quiet">{t.admin.noBackups}</p>
          ) : (
            <List className="card-list">
              {status.backups.slice(0, 10).map((b) => (
                <ListRow key={b.name} title={<span className="mono small">{b.name}</span>} trailing={`${formatSize(b.size)} · ${formatDateTime(b.createdAt)}`} />
              ))}
            </List>
          )}
          {status.feedErrors.length > 0 && (
            <>
              <div className="settings-sub">
                <h3>{t.admin.feedErrors}</h3>
              </div>
              {status.feedErrors.map((f, i) => (
                <Notice key={i} tone="warning" title={f.name}>
                  {f.error}
                </Notice>
              ))}
            </>
          )}
        </Card>
      )}

      {emailOf && (
        <EmailDialog
          user={emailOf}
          onClose={() => setEmailOf(null)}
          onSave={async (email) => {
            await api.admin.update(emailOf.id, { email });
            await load();
          }}
        />
      )}
      {quotaOf && (
        <QuotaDialog
          user={quotaOf}
          onClose={() => setQuotaOf(null)}
          onSave={async (quotaBytes) => {
            await api.admin.update(quotaOf.id, { quotaBytes });
            await load();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t.common.delete}
          text={t.admin.removeConfirm(removing.displayName)}
          confirm={t.common.delete}
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.admin.remove(removing.id);
            await load();
          }}
        />
      )}
    </div>
  );
}

function InviteForm({ onInvited }: { onInvited: (result: { link: string | null; mailed: boolean }, email: string) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.admin.invite(email, name, admin);
      setEmail("");
      setName("");
      setAdmin(false);
      setError(null);
      onInvited(result, email);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="entry-form" onSubmit={submit}>
      <TextField label={t.admin.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <TextField label={t.admin.name} value={name} onChange={(e) => setName(e.target.value)} />
      <Checkbox className="wide" label={t.admin.makeAdmin} checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
      {error && (
        <Notice tone="danger" className="wide">
          {error}
        </Notice>
      )}
      <div className="form-actions wide">
        <Button type="submit" variant="primary" icon="plus" loading={busy}>
          {t.admin.invite}
        </Button>
      </div>
    </form>
  );
}

function QuotaDialog({ user, onClose, onSave }: { user: UserView; onClose: () => void; onSave: (bytes: number | null) => Promise<void> }) {
  const [value, setValue] = useState(user.quotaBytes ? String(Math.round((user.quotaBytes / GB) * 10) / 10) : "");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const gb = Number(value.replace(",", "."));
    try {
      await onSave(value.trim() && gb > 0 ? Math.round(gb * GB) : null);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Dialog
      title={`${t.admin.quota}: ${user.displayName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={() => void save()}>
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
        <TextField label={t.admin.quota} inputMode="decimal" trailing="GB" hint={t.admin.quotaHint} value={value} onChange={(e) => setValue(e.target.value)} autoFocus error={error ?? undefined} />
      </form>
    </Dialog>
  );
}

function EmailDialog({ user, onClose, onSave }: { user: UserView; onClose: () => void; onSave: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await onSave(email);
      onClose();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  };
  return (
    <Dialog
      title={`${t.admin.changeEmail}: ${user.displayName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" disabled={email.trim().toLowerCase() === user.email} onClick={() => void save()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form
        className="ui-stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField label={t.admin.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus error={error ?? undefined} />
      </form>
    </Dialog>
  );
}
