// Who is signed in, and the subjects everyone in the app needs.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { adoptLocale } from "../i18n";
import { api, type Course, type Me, type Person } from "./api";
import { auth, type Session } from "./auth";

interface SessionState {
  session: Session | null;
  me: Me | null;
  courses: Course[];
  /** Everyone the user shares a subject with, by id. */
  people: Map<string, Person>;
  reloadPeople: () => Promise<void>;
  reloadCourses: () => Promise<void>;
  reloadMe: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Context = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());

  useEffect(() => {
    auth()
      .auth.getSession()
      .then(({ data }) => setSession(data.session));
    const { data } = auth().auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const reloadMe = useCallback(async () => {
    const next = await api.me();
    // The profile's language wins over the browser's. On the welcome page the
    // person is still choosing theirs, so the page stays as it is there.
    if (adoptLocale(next.locale) && !window.location.pathname.startsWith("/willkommen")) {
      window.location.reload();
      return;
    }
    setMe(next);
  }, []);
  const reloadCourses = useCallback(async () => setCourses(await api.courses()), []);
  const reloadPeople = useCallback(async () => setPeople(new Map((await api.people()).map((p) => [p.id, p]))), []);

  useEffect(() => {
    if (!session) {
      setMe(null);
      setCourses([]);
      setPeople(new Map());
      return;
    }
    // One retry: a single failed request should not leave the app empty.
    void reloadMe().catch(() => setTimeout(() => void reloadMe().catch(() => setMe(null)), 1500));
    void reloadCourses().catch(() => {});
    void reloadPeople().catch(() => {});
    // Only when the user changes, not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const signOut = useCallback(async () => {
    await auth().auth.signOut();
  }, []);

  if (session === undefined) return null;
  return <Context.Provider value={{ session, me, courses, people, reloadPeople, reloadCourses, reloadMe, signOut }}>{children}</Context.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(Context);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

export function usePeople(): Map<string, Person> {
  return useSession().people;
}

/** A course title by id, for labels across the app. */
export function useCourseTitles(): (id: string | null) => string | null {
  const { courses } = useSession();
  return (id) => (id ? (courses.find((c) => c.id === id)?.title ?? null) : null);
}
