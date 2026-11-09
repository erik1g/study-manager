// Invitations into subjects, answered right here, and what became of the
// invitations one sent.
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Chip, EmptyState, LinkButton, List, ListRow, Notice, SectionHeader, toast } from "@study/ui";
import { Link } from "react-router";
import { Avatar } from "../components/Avatar";
import { de, errorMessage, formatDateTime } from "../i18n/de";
import { api, type AppNotification } from "../lib/api";
import { emitChanged } from "../lib/events";
import { useSession } from "../lib/session";

export function NotificationsView() {
  const { reloadCourses } = useSession();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.notifications();
      setItems(list);
      // Seen now: only open invitations keep the bell counting.
      if (list.some((n) => !n.read)) {
        await api.markNotificationsRead();
        emitChanged();
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function answer(item: AppNotification, accept: boolean) {
    setBusy(item.id);
    setError(null);
    try {
      await api.answerInvitation(item.courseId!, accept);
      if (accept) {
        await reloadCourses();
        toast(de.notifications.joinedToast(item.courseTitle ?? ""), "success");
      }
      emitChanged();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const who = (item: AppNotification) => item.actorName ?? de.notifications.someone;
  const course = (item: AppNotification) => item.courseTitle ?? "";

  return (
    <div className="page narrow-page">
      <SectionHeader level={1} size="xl" title={de.notifications.title} description={de.notifications.subtitle} />
      {error && <Notice tone="danger">{error}</Notice>}
      {items && items.length === 0 && (
        <EmptyState illustration="tasse" title={de.notifications.empty}>
          {de.notifications.emptyText}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <Card padding="sm">
          <List aria-label={de.notifications.title}>
            {items.map((item) => {
              const open = item.kind === "course_invitation" && item.data.status === "open";
              return (
                <ListRow
                  key={item.id}
                  rowClassName={open ? "notification-open" : undefined}
                  leading={<Avatar userId={item.actorId} name={item.actorName} size={40} decorative />}
                  title={
                    item.kind === "course_invitation"
                      ? de.notifications.invited(who(item), course(item), de.roles[item.data.role ?? "editor"])
                      : item.kind === "invitation_accepted"
                        ? de.notifications.accepted(who(item), course(item))
                        : de.notifications.declined(who(item), course(item))
                  }
                  meta={formatDateTime(item.createdAt)}
                  trailing={
                    open ? (
                      <span className="notification-actions">
                        <Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => void answer(item, false)}>
                          {de.notifications.decline}
                        </Button>
                        <Button size="sm" variant="primary" icon="check" loading={busy === item.id} onClick={() => void answer(item, true)}>
                          {de.notifications.accept}
                        </Button>
                      </span>
                    ) : item.kind === "course_invitation" ? (
                      item.data.status === "accepted" && item.courseId ? (
                        <LinkButton as={Link} to={`/fach/${item.courseId}`} size="sm" iconEnd="arrow-right">
                          {de.notifications.open}
                        </LinkButton>
                      ) : (
                        <Chip size="sm" tone={item.data.status === "declined" ? "grau" : "gelb"}>
                          {item.data.status === "declined" ? de.notifications.refused : de.notifications.withdrawn}
                        </Chip>
                      )
                    ) : item.kind === "invitation_accepted" && item.courseId ? (
                      <LinkButton as={Link} to={`/fach/${item.courseId}?tab=mitglieder`} size="sm" variant="ghost" iconEnd="arrow-right">
                        {de.notifications.open}
                      </LinkButton>
                    ) : undefined
                  }
                />
              );
            })}
          </List>
        </Card>
      )}
    </div>
  );
}
