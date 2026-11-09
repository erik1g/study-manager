import { lazy, Suspense, useEffect, useState } from "react";
import { Button, EmptyState } from "@study/ui";
import { de } from "./i18n/de";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { CommandPalette } from "./components/CommandPalette";
import { AppSidebar, AppTabBar, PhoneBar } from "./components/Sidebar";
import { PageSkeleton } from "./components/Skeleton";
import { Toasts } from "./components/Toasts";
import { SessionProvider, useSession } from "./lib/session";
import { ConsentView } from "./views/ConsentView";
import { JoinView } from "./views/JoinView";
import { NotificationsView } from "./views/NotificationsView";
import { OverviewView } from "./views/OverviewView";
import { SignInView } from "./views/SignInView";
import { SubjectsView } from "./views/SubjectsView";
import { TodosView } from "./views/TodosView";
import { WelcomeView } from "./views/WelcomeView";

// The heavy pages (PDF viewer, calendar, Whisper) load when first opened.
const CourseView = lazy(() => import("./views/CourseView").then((m) => ({ default: m.CourseView })));
const PlanningView = lazy(() => import("./views/PlanningView").then((m) => ({ default: m.PlanningView })));
const SettingsView = lazy(() => import("./views/SettingsView").then((m) => ({ default: m.SettingsView })));
const AdminView = lazy(() => import("./views/AdminView").then((m) => ({ default: m.AdminView })));

export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/anmelden" element={<SignInView />} />
        <Route path="/willkommen" element={<WelcomeView />} />
        <Route path="/*" element={<SignedIn />} />
      </Routes>
    </SessionProvider>
  );
}

/** Pages within one area share their entry animation. */
const area = (path: string) => (path.startsWith("/fach/") ? path.split("/").slice(0, 3).join("/") : path.split("/")[1]);

function ProgramsMoved() {
  const rest = useLocation().pathname.replace(/^\/studiengaenge\/?/, "");
  return <Navigate to={`/einstellungen/studiengang${rest ? `/${rest}` : ""}`} replace />;
}

/** Signed in, but the profile does not come: say so instead of a blank page. */
function SessionProblem() {
  const { reloadMe, signOut } = useSession();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // A slow answer is not yet a problem.
    const timer = setTimeout(() => setFailed(true), 4000);
    return () => clearTimeout(timer);
  }, []);
  if (!failed) return null;
  return (
    <div className="page">
      <EmptyState
        illustration="fehler"
        title={de.session.problem}
        actions={
          <>
            <Button variant="primary" icon="restore" onClick={() => void reloadMe().catch(() => {})}>
              {de.session.retry}
            </Button>
            <Button onClick={() => void signOut()}>{de.nav.signOut}</Button>
          </>
        }
      >
        {de.session.problemText}
      </EmptyState>
    </div>
  );
}

/** Everything behind the sign-in, with the navigation on top. */
function SignedIn() {
  const { session, me } = useSession();
  const location = useLocation();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/anmelden?weiter=${next}`} replace />;
  }
  if (!me) return <SessionProblem />;
  return (
    <div className="app">
      <AppSidebar />
      <PhoneBar />
      <main className="main">
        <div className="route" key={area(location.pathname)}>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
            <Route path="/" element={<OverviewView />} />
            <Route path="/faecher" element={<SubjectsView />} />
            <Route path="/fach/:id/*" element={<CourseView />} />
            <Route path="/planung" element={<PlanningView />} />
            <Route path="/todos" element={<TodosView />} />
            <Route path="/benachrichtigungen" element={<NotificationsView />} />
            {/* Degree programmes moved into the settings; old links still lead there. */}
            <Route path="/studiengaenge/*" element={<ProgramsMoved />} />
            <Route path="/einstellungen/*" element={<SettingsView />} />
            <Route path="/admin" element={<AdminView />} />
            <Route path="/beitreten/:token" element={<JoinView />} />
            <Route path="/oauth/consent" element={<ConsentView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      <AppTabBar />
      <CommandPalette />
      <Toasts />
    </div>
  );
}
