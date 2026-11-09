// Who changed what, newest first: in a subject for its members, or across
// the whole cloud for admins.
import { useCallback, useEffect, useState } from "react";
import { Button, Chip, List, ListRow, Notice } from "@study/ui";
import { de, errorMessage, formatDate, formatDateTime } from "../i18n/de";
import type { ActivityEntry } from "../lib/api";
import { Avatar } from "./Avatar";

const ROLE: Record<string, string> = { owner: "Besitzer", editor: "Bearbeiter", viewer: "Leser" };

/** A changed value as people read it. */
function shown(field: string, value: unknown, courseTitle: (id: string) => string | null): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (field === "role") return ROLE[String(value)] ?? String(value);
  if (field === "folder") return de.folders[value as keyof typeof de.folders] ?? String(value);
  if (field === "courseId") return courseTitle(String(value)) ?? "anderes Fach";
  if (field === "quotaBytes") return `${Math.round(Number(value) / 1e9)} GB`;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)} …` : text;
}

function Changes({ entry, courseTitle }: { entry: ActivityEntry; courseTitle: (id: string) => string | null }) {
  const pairs = Object.entries(entry.details).filter(([, v]) => Array.isArray(v) && v.length === 2) as [string, [unknown, unknown]][];
  if (pairs.length === 0) return null;
  return (
    <span className="activity-changes">
      {pairs.map(([field, [before, after]]) => (
        <span key={field}>
          {de.activity.fields[field] ?? field}: <s>{shown(field, before, courseTitle)}</s> → {shown(field, after, courseTitle)}
        </span>
      ))}
    </span>
  );
}

/** The entries themselves, without loading or paging. */
export function ActivityList({
  entries,
  showCourse = false,
  courseTitle = () => null,
  compact = false,
}: {
  entries: ActivityEntry[];
  showCourse?: boolean;
  courseTitle?: (id: string) => string | null;
  /** Without the changed values, e.g. in a side column. */
  compact?: boolean;
}) {
  return (
    <List className="card-list">
      {entries.map((entry) => (
        <ListRow
          key={entry.id}
          leading={<Avatar userId={entry.actorId} name={entry.actorName} size={32} decorative />}
          title={
            <span className="activity-text">
              {entry.actorName ?? de.activity.deletedUser}{" "}
              <span className="activity-action">
                {de.activity.actions[entry.action] ?? entry.action}{" "}
                {entry.action !== "notes.edited" && entry.action !== "member.joined" && entry.action !== "member.left" && <em>{entry.subject}</em>}
                {entry.count > 1 && <span className="quiet"> · {de.activity.times(entry.count)}</span>}
              </span>
              {entry.via === "claude" && (
                <Chip tone="gelb" icon="claude" size="sm" className="activity-claude">
                  {de.activity.viaClaude}
                </Chip>
              )}
            </span>
          }
          meta={
            <>
              {!compact && <Changes entry={entry} courseTitle={courseTitle} />}
              {formatDateTime(entry.at)}
              {showCourse && entry.courseTitle && ` · ${entry.courseTitle}`}
            </>
          }
        />
      ))}
    </List>
  );
}

export function ActivityFeed({
  load,
  showCourse = false,
  courseTitle = () => null,
}: {
  /** Fetches entries older than `before`, or the newest ones. */
  load: (before?: string) => Promise<ActivityEntry[]>;
  showCourse?: boolean;
  courseTitle?: (id: string) => string | null;
}) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const first = useCallback(() => {
    load().then(
      (rows) => {
        setEntries(rows);
        setMore(rows.length >= 50);
      },
      (e) => setError(errorMessage(e)),
    );
  }, [load]);
  useEffect(first, [first]);

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!entries) return null;
  if (entries.length === 0) return <p className="quiet">{de.activity.empty}</p>;

  return (
    <div className="ui-stack">
      <ActivityList entries={entries} showCourse={showCourse} courseTitle={courseTitle} />
      {more && (
        <div>
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const older = await load(entries[entries.length - 1]!.at);
              setEntries([...entries, ...older]);
              setMore(older.length >= 50);
              setBusy(false);
            }}
          >
            {de.activity.more}
          </Button>
        </div>
      )}
    </div>
  );
}
