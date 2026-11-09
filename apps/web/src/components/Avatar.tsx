// A person's picture or initials, with the picture found by their id.
import { Avatar as UiAvatar } from "@study/ui";
import { usePeople } from "../lib/session";

export { initials } from "@study/ui";

export function Avatar({
  userId,
  name,
  size = 24,
  version,
  decorative,
}: {
  /** Null for a deleted account. */
  userId: string | null;
  name?: string | null;
  size?: number;
  /** The picture's version when known better than from the people list (own profile). */
  version?: number | null;
  /** The name stands next to it. */
  decorative?: boolean;
}) {
  const people = usePeople();
  const person = userId ? people.get(userId) : undefined;
  const shown = name ?? person?.displayName ?? "";
  const picture = version !== undefined ? version : person?.hasAvatar ? person.avatarVersion : null;
  const src = userId && picture != null ? `/api/avatars/${userId}?v=${picture}` : null;
  return <UiAvatar name={shown || "Gelöschter Nutzer"} src={src} size={size} colorKey={userId ?? undefined} gone={!userId} decorative={decorative} />;
}

/** A name with its picture in front, as authors are shown. */
export function Person({ userId, name, size = 20 }: { userId: string | null; name: string | null; size?: number }) {
  return (
    <span className="person">
      <Avatar userId={userId} name={name} size={size} decorative />
      <span className="person-name">{userId && name ? name : (name ?? "Gelöschter Nutzer")}</span>
    </span>
  );
}
