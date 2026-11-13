// The way around the app: a side menu with the student's subjects on wide
// screens; on phones a bar at the top and the tabs at the bottom.
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { IconButton, LinkButton, Logo, NavItem, NavSection, Sidebar, TabBar } from "@study/ui";
import { t, semesterName, semesterOf, today } from "../i18n";
import { api } from "../lib/api";
import { openPalette, useChanged } from "../lib/events";
import { useGo } from "../lib/motion";
import { useUnreadNotifications } from "../lib/notifications";
import { useSession } from "../lib/session";
import { useStored } from "../lib/stored";
import { toneOf } from "../lib/tone";
import { deadlineOpen } from "./Agenda";
import { Avatar } from "./Avatar";
import { ContextMenu, MenuItem, MenuSeparator, menuPositionFrom, type MenuPosition } from "./ContextMenu";

const BADGE_DAYS = 14;

function useCounts() {
  const { pathname } = useLocation();
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState(0);
  const load = useCallback(() => {
    const from = new Date(`${today()}T00:00:00`);
    const to = new Date(from.getTime() + BADGE_DAYS * 86_400_000);
    void Promise.all([api.deadlines({ from: from.toISOString(), to: to.toISOString() }), api.tasks({ open: true })]).then(
      ([d, open]) => {
        const counts: Record<string, number> = {};
        for (const item of d) if (item.courseId && deadlineOpen(item)) counts[item.courseId] = (counts[item.courseId] ?? 0) + 1;
        setDeadlines(counts);
        setTasks(open.length);
      },
      () => {},
    );
  }, []);
  useEffect(load, [load, pathname]);
  useChanged(load);
  return { deadlines, tasks };
}

/** A full page load, so that a proxy in front (e.g. an access gateway) can check the admin before the app asks for data. */
const openAdmin = () => window.location.assign("/admin");

export function AppSidebar() {
  const { me, courses, signOut } = useSession();
  const { pathname } = useLocation();
  const go = useGo();
  const [older, setOlder] = useState(false);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const { deadlines, tasks } = useCounts();
  const unread = useUnreadNotifications();
  const [collapsed, setCollapsed] = useStored("sidebar.collapsed", false);

  // ⌘B / Ctrl+B folds the side menu in and out, wherever one is.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCollapsed]);

  const current = semesterOf();
  const now = courses.filter((c) => c.semester === current);
  const past = courses.filter((c) => c.semester !== current);
  const openCourse = pathname.match(/^\/fach\/([^/]+)/)?.[1];
  const choose = (action: () => void) => () => {
    setMenu(null);
    action();
  };

  return (
    <Sidebar
      className={collapsed ? "app-sidebar collapsed" : "app-sidebar"}
      collapsed={collapsed}
      label={t.nav.main}
      brand={
        <div className="brand-row">
          <Link to="/" className="brand-link" aria-label={t.nav.today}>
            <Logo withName={!collapsed} />
          </Link>
          <IconButton
            icon="sidebar"
            label={collapsed ? t.nav.expand : t.nav.collapse}
            aria-keyshortcuts="Control+B Meta+B"
            onClick={() => setCollapsed(!collapsed)}
          />
        </div>
      }
      footer={
        <NavSection>
          <NavItem
            label={me?.displayName ?? ""}
            leading={me && <Avatar userId={me.id} name={me.displayName} size={32} version={me.avatarVersion} decorative />}
            endIcon="settings"
            aria-haspopup="menu"
            aria-expanded={menu !== null}
            onClick={(event) => setMenu(menu ? null : menuPositionFrom(event.currentTarget, "start"))}
          />
        </NavSection>
      }
    >
      <NavSection>
        <NavItem icon="sun" label={t.nav.today} href="/" linkAs={Link} active={pathname === "/"} />
        <NavItem icon="grid" label={t.nav.subjects} href="/faecher" linkAs={Link} active={pathname === "/faecher"} />
        <NavItem icon="calendar" label={t.nav.planning} href="/planung" linkAs={Link} active={pathname === "/planung"} />
        <NavItem icon="checklist" label={t.nav.todos} href="/todos" linkAs={Link} active={pathname === "/todos"} badge={tasks} />
        <NavItem icon="bell" label={t.nav.notifications} href="/benachrichtigungen" linkAs={Link} active={pathname === "/benachrichtigungen"} badge={unread} />
        <NavItem icon="search" label={t.nav.search} shortcut="⌘K" onClick={openPalette} />
      </NavSection>
      <NavSection title={semesterName(current)}>
        {now.map((c) => (
          <NavItem key={c.id} size="sm" dot={toneOf(c.color)} label={c.title} href={`/fach/${c.id}`} linkAs={Link} active={openCourse === c.id} badge={deadlines[c.id]} />
        ))}
        {past.length > 0 && (
          <NavItem size="sm" icon={older ? "chevron-down" : "chevron-right"} label={t.nav.olderSubjects} aria-expanded={older} onClick={() => setOlder(!older)} />
        )}
        {older &&
          past.map((c) => (
            <NavItem key={c.id} size="sm" dot={toneOf(c.color)} label={c.title} href={`/fach/${c.id}`} linkAs={Link} active={openCourse === c.id} badge={deadlines[c.id]} />
          ))}
      </NavSection>
      {menu && (
        <ContextMenu at={menu} label={t.nav.account} onClose={() => setMenu(null)}>
          <MenuItem icon="settings" onSelect={choose(() => go("/einstellungen"))}>
            {t.nav.settings}
          </MenuItem>
          {me?.isAdmin && (
            <MenuItem icon="shield" onSelect={choose(openAdmin)}>
              {t.nav.admin}
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon="logout" onSelect={choose(() => void signOut())}>
            {t.nav.signOut}
          </MenuItem>
        </ContextMenu>
      )}
    </Sidebar>
  );
}

/** On phones: the app's mark, the search and the way to the settings. */
export function PhoneBar() {
  const { me } = useSession();
  const go = useGo();
  const unread = useUnreadNotifications();
  return (
    <header className="phone-bar">
      <Link to="/" className="brand-link" aria-label={t.nav.today}>
        <Logo size={34} />
      </Link>
      <span className="spacer" />
      <IconButton icon="bell" label={t.nav.notifications} badge={unread} onClick={() => go("/benachrichtigungen")} />
      <IconButton icon="search" label={t.nav.search} onClick={openPalette} />
      <LinkButton as={Link} to="/einstellungen" variant="ghost" className="phone-account" aria-label={t.nav.settings}>
        {me && <Avatar userId={me.id} name={me.displayName} size={32} version={me.avatarVersion} decorative />}
      </LinkButton>
    </header>
  );
}

export function AppTabBar() {
  const { pathname } = useLocation();
  const active = pathname === "/" ? "heute" : pathname === "/faecher" || pathname.startsWith("/fach/") ? "faecher" : pathname === "/planung" ? "planung" : pathname === "/todos" ? "todos" : undefined;
  return (
    <TabBar
      className="app-tabbar"
      label={t.nav.main}
      linkAs={Link}
      active={active}
      items={[
        { id: "heute", label: t.nav.today, icon: "sun", href: "/" },
        { id: "faecher", label: t.nav.subjects, icon: "grid", href: "/faecher" },
        { id: "planung", label: t.nav.planning, icon: "calendar", href: "/planung" },
        { id: "todos", label: t.nav.todos, icon: "checklist", href: "/todos" },
      ]}
      action={{ label: t.overview.add, icon: "plus", onClick: openPalette }}
    />
  );
}
