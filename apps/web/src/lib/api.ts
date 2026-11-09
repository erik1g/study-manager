// The backend, as the web app calls it. Every call carries the session token.
import type { CourseDraft, CourseRole, DeadlineDraft, FeedDraft, FileFolder, ModuleData, ProgramDraft, TaskDraft } from "@study/shared";
import { accessToken } from "./auth";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await accessToken();
  const isForm = body instanceof FormData;
  const response = await fetch(path, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body !== undefined && !isForm && { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new ApiError(response.status, data?.code ?? "server_error", data?.message ?? response.statusText);
  return data as T;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = <T = { ok: true }>(path: string) => request<T>("DELETE", path);
const query = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
};

// --- Types ---------------------------------------------------------------

export interface Me {
  id: string;
  email: string;
  displayName: string;
  studies: string | null;
  semester: number | null;
  /** Null without a picture. */
  avatarVersion: number | null;
  isAdmin: boolean;
  adminReady: boolean;
  icalUrl: string;
  mcpUrl: string;
}

export interface Course {
  id: string;
  title: string;
  number: string | null;
  credits: number | null;
  semester: string;
  moduleId: string | null;
  role: CourseRole;
  color: string | null;
  memberCount: number;
}

export interface Member {
  userId: string;
  displayName: string;
  email: string;
  role: CourseRole;
  joinedAt: string;
}

export interface CourseFile {
  id: string;
  courseId: string;
  folder: FileFolder;
  name: string;
  size: number;
  mime: string;
  uploadedBy: string | null;
  uploadedById: string | null;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface Deadline {
  id: string;
  courseId: string | null;
  title: string;
  allDay: boolean;
  date: string | null;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdById: string | null;
  editable: boolean;
  /** Ticked off by the user; each member for themselves. */
  done: boolean;
  doneAt: string | null;
}

export interface PersonMatch {
  id: string;
  displayName: string;
  email: string;
  hasAvatar: boolean;
  avatarVersion: number;
  status: "member" | "invited" | null;
}

export interface PendingInvitation {
  userId: string;
  displayName: string;
  email: string;
  role: CourseRole;
  invitedBy: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  kind: "course_invitation" | "invitation_accepted" | "invitation_declined";
  courseId: string | null;
  courseTitle: string | null;
  actorId: string | null;
  actorName: string | null;
  data: { role?: CourseRole; status?: "open" | "accepted" | "declined" | "withdrawn" };
  createdAt: string;
  read: boolean;
}

export interface Task {
  id: string;
  courseId: string | null;
  deadlineId: string | null;
  title: string;
  plannedDate: string | null;
  startTime: string | null;
  estimateMinutes: number | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
}

export interface CalendarItem {
  kind: "session" | "event" | "deadline" | "task";
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  courseId: string | null;
  feedId: string | null;
  location: string | null;
  notes: string | null;
  url: string | null;
  cancelled: boolean;
  done?: boolean;
  editable?: boolean;
}

export interface Session {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  notes: string | null;
  url: string | null;
  cancelled: boolean;
  number: number | null;
  total: number;
}

export interface Feed {
  id: string;
  name: string;
  url: string;
  color: string | null;
  fetchedAt: string | null;
  error: string | null;
}

export interface Series {
  feedId: string;
  title: string;
  count: number;
  courseId: string | null;
  decided: boolean;
  suggestion: string | null;
}

export interface Program {
  id: string;
  university: string;
  name: string;
  degree: string;
  regulation: string;
  managerId: string | null;
  managerName: string | null;
  moduleCount: number;
  enrolled: boolean;
  hasHandbook: boolean;
}

export interface Module extends ModuleData {
  id: string;
  programId: string;
}

export interface PersonalKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

export interface ConnectedApp {
  clientId: string;
  name: string;
  redirectHosts: string[];
  grantedAt: string;
  lastUsedAt: string | null;
}

/** Proxies in front often pass at most 100 MB per request, so files go one by one and each stays below. */
export const MAX_UPLOAD_MB = 95;

export class FileTooLargeError extends Error {
  constructor(readonly file: string) {
    super(`„${file}“ ist größer als ${MAX_UPLOAD_MB} MB. Teile die Datei oder lade eine kleinere Fassung hoch.`);
  }
}

const checkSize = (file: File) => {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new FileTooLargeError(file.name);
};

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  disabled: boolean;
  quotaBytes: number | null;
  usedBytes: number;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface ServerStatus {
  disk: { total: number; free: number } | null;
  databaseBytes: number;
  fileBytes: number;
  users: number;
  courses: number;
  files: number;
  backups: { name: string; size: number; createdAt: string }[];
  feedErrors: { name: string; error: string | null }[];
}

export interface Notes {
  content: string;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedById: string | null;
}

export interface SearchHit {
  fileId: string;
  name: string;
  folder: string;
  page: number | null;
  text: string;
  score: number;
  courseId?: string;
}

export interface EverywhereResult {
  files: { id: string; courseId: string; name: string; folder: string }[];
  deadlines: { id: string; courseId: string | null; title: string; date: string | null; startsAt: string | null }[];
  tasks: { id: string; courseId: string | null; title: string }[];
  recordings: { id: string; courseId: string; title: string; date: string }[];
  notes: { courseId: string; title: string }[];
  passages: (SearchHit & { courseId: string })[];
}

export interface Deck {
  id: string;
  courseId: string;
  name: string;
  cards: number;
  due: number;
  new: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  source: string | null;
  due: string | null;
  state: number;
}

export interface Proposal {
  id: string;
  courseId: string;
  deckName: string;
  front: string;
  back: string;
  source: string | null;
  createdAt: string;
}

export interface Recording {
  id: string;
  courseId: string;
  title: string;
  date: string;
  language: string | null;
  durationSeconds: number | null;
  createdBy: string | null;
  createdById: string | null;
  createdAt: string;
  analysedAt: string | null;
  analysedBy: string | null;
  length: number;
}

export interface WorkItem {
  kind: "outline" | "lecture";
  courseId: string;
  course: string;
  id: string;
  title: string;
  todo: string;
}

/** Someone the user meets in the app, for names and pictures. */
export interface Person {
  id: string;
  displayName: string;
  hasAvatar: boolean;
  avatarVersion: number;
}

export interface ActivityEntry {
  id: string;
  at: string;
  courseId: string | null;
  courseTitle: string | null;
  actorId: string | null;
  /** Null once the account was deleted. */
  actorName: string | null;
  via: "app" | "claude";
  action: string;
  subjectId: string | null;
  subject: string;
  details: Record<string, unknown>;
  count: number;
}

export interface CourseProgress {
  courseId: string;
  done: number;
  total: number;
  next: { start: string; end: string; location: string | null; title: string } | null;
}

export interface DeletionCheck {
  lastAdmin: boolean;
  handOver: { courseId: string; title: string; semester: string; successor: { userId: string; displayName: string; role: CourseRole } }[];
  alone: { courseId: string; title: string }[];
}

/** The notes changed on the server since they were loaded. */
export class NotesConflictError extends ApiError {
  constructor(readonly current: Notes) {
    super(409, "notes_conflict", "notes_conflict");
  }
}

// --- Calls ---------------------------------------------------------------

export const api = {
  me: () => get<Me>("/api/me"),
  updateProfile: (change: { displayName?: string; studies?: string | null; semester?: number | null }) => patch("/api/me", change),
  uploadAvatar: (picture: Blob) => {
    const form = new FormData();
    form.append("file", picture, `avatar.${picture.type.split("/")[1] ?? "png"}`);
    return put("/api/me/avatar", form);
  },
  removeAvatar: () => del("/api/me/avatar"),
  people: () => get<Person[]>("/api/people"),
  deletionCheck: () => get<DeletionCheck>("/api/me/deletion"),
  deleteAccount: (email: string) => request("DELETE", "/api/me", { email }),
  courseActivity: (courseId: string, before?: string) => get<ActivityEntry[]>(`/api/courses/${courseId}/activity${query({ before })}`),
  renewIcal: () => post<{ icalUrl: string }>("/api/me/ical-token"),
  keys: () => get<PersonalKey[]>("/api/keys"),
  createKey: (name: string) => post<{ id: string; key: string }>("/api/keys", { name }),
  revokeKey: (id: string) => del(`/api/keys/${id}`),
  extendKey: (id: string) => post<{ expiresAt: string }>(`/api/keys/${id}/extend`),
  connectedApps: () => get<ConnectedApp[]>("/api/connected-apps"),
  disconnectApp: (id: string) => del(`/api/connected-apps/${id}`),

  courses: () => get<Course[]>("/api/courses"),
  course: (id: string) => get<Course>(`/api/courses/${id}`),
  createCourse: (draft: Partial<CourseDraft> & { semester: string }) => post<Course>("/api/courses", draft),
  updateCourse: (id: string, change: { title?: string; semester?: string; credits?: number | null }) => patch(`/api/courses/${id}`, change),
  deleteCourse: (id: string) => del(`/api/courses/${id}`),
  setCourseColor: (id: string, color: string | null) => put(`/api/courses/${id}/color`, { color }),
  members: (id: string) => get<Member[]>(`/api/courses/${id}/members`),
  setRole: (id: string, userId: string, role: CourseRole) => put(`/api/courses/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) => del(`/api/courses/${id}/members/${userId}`),
  createInvite: (id: string, role: CourseRole) => post<{ token: string; url: string; expiresAt: string }>(`/api/courses/${id}/invites`, { role }),
  invitation: (token: string) => get<{ courseId: string; title: string; semester: string; role: CourseRole }>(`/api/invitations/${token}`),
  acceptInvitation: (token: string) => post<Course>(`/api/invitations/${token}/accept`),
  findPeople: (courseId: string, q: string) => get<PersonMatch[]>(`/api/courses/${courseId}/people${query({ q })}`),
  pendingInvitations: (courseId: string) => get<PendingInvitation[]>(`/api/courses/${courseId}/invitations`),
  inviteUser: (courseId: string, userId: string, role: CourseRole) => post(`/api/courses/${courseId}/invitations`, { userId, role }),
  withdrawInvitation: (courseId: string, userId: string) => del(`/api/courses/${courseId}/invitations/${userId}`),
  answerInvitation: (courseId: string, accept: boolean) => post<{ courseId: string; joined: boolean }>(`/api/course-invitations/${courseId}/${accept ? "accept" : "decline"}`),
  notifications: () => get<AppNotification[]>("/api/notifications"),
  unreadNotifications: () => get<{ count: number }>("/api/notifications/unread"),
  markNotificationsRead: (ids?: string[]) => post("/api/notifications/read", ids ? { ids } : {}),

  files: (courseId: string) => get<CourseFile[]>(`/api/courses/${courseId}/files`),
  async upload(courseId: string, folder: FileFolder, files: File[]) {
    files.forEach(checkSize);
    const saved: CourseFile[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file, file.name);
      saved.push(...(await post<CourseFile[]>(`/api/courses/${courseId}/files${query({ folder })}`, form)));
    }
    return saved;
  },
  updateFile: (id: string, change: { name?: string; folder?: FileFolder }) => patch<CourseFile>(`/api/files/${id}`, change),
  trashFile: (id: string) => del(`/api/files/${id}`),
  trash: (courseId: string) => get<CourseFile[]>(`/api/courses/${courseId}/trash`),
  restoreFile: (id: string) => post<CourseFile>(`/api/files/${id}/restore`),
  /** The bytes of a file, fetched with the session (for viewing and downloading). */
  async fileBytes(id: string): Promise<ArrayBuffer> {
    const token = await accessToken();
    const response = await fetch(`/api/files/${id}/content`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new ApiError(response.status, "unknown_file", response.statusText);
    return response.arrayBuffer();
  },
  async download(file: { id: string; name: string; mime: string }) {
    const bytes = await api.fileBytes(file.id);
    const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },

  deadlines: (params: { courseId?: string; from?: string; to?: string } = {}) => get<Deadline[]>(`/api/deadlines${query(params)}`),
  createDeadline: (draft: DeadlineDraft) => post<Deadline>("/api/deadlines", draft),
  updateDeadline: (id: string, draft: DeadlineDraft) => put<Deadline>(`/api/deadlines/${id}`, draft),
  deleteDeadline: (id: string) => del(`/api/deadlines/${id}`),
  setDeadlineDone: (id: string, done: boolean) => put<Deadline>(`/api/deadlines/${id}/done`, { done }),

  tasks: (params: { courseId?: string; open?: boolean } = {}) =>
    get<Task[]>(`/api/tasks${query({ courseId: params.courseId, open: params.open ? "1" : undefined })}`),
  createTask: (draft: TaskDraft) => post<Task>("/api/tasks", draft),
  updateTask: (id: string, change: Partial<TaskDraft> & { done?: boolean }) => patch<Task>(`/api/tasks/${id}`, change),
  deleteTask: (id: string) => del(`/api/tasks/${id}`),

  progress: () => get<CourseProgress[]>("/api/progress"),
  calendar: (from: Date, to: Date) => get<CalendarItem[]>(`/api/calendar${query({ from: from.toISOString(), to: to.toISOString() })}`),
  sessions: (courseId: string) => get<Session[]>(`/api/courses/${courseId}/sessions`),
  feeds: () => get<Feed[]>("/api/feeds"),
  addFeed: (draft: FeedDraft) => post<Feed>("/api/feeds", draft),
  updateFeed: (id: string, change: { name?: string; color?: string | null }) => patch(`/api/feeds/${id}`, change),
  removeFeed: (id: string) => del(`/api/feeds/${id}`),
  refreshFeed: (id: string) => post(`/api/feeds/${id}/refresh`),
  series: () => get<Series[]>("/api/series"),
  assignSeries: (feedId: string, title: string, courseId: string | null) => put("/api/series", { feedId, title, courseId }),

  programs: () => get<Program[]>("/api/programs"),
  createProgram: (draft: ProgramDraft) => post<{ id: string }>("/api/programs", draft),
  updateProgram: (id: string, draft: ProgramDraft) => put(`/api/programs/${id}`, draft),
  deleteProgram: (id: string) => del(`/api/programs/${id}`),
  setEnrolled: (id: string, enrolled: boolean) => post(`/api/programs/${id}/enrollment`, { enrolled }),
  modules: (programId: string, q?: string) => get<Module[]>(`/api/programs/${programId}/modules${query({ q })}`),
  deleteModule: (id: string) => del(`/api/modules/${id}`),
  uploadHandbook: (programId: string, file: File) => {
    checkSize(file);
    const form = new FormData();
    form.append("file", file, file.name);
    return post(`/api/programs/${programId}/handbook`, form);
  },

  notes: (courseId: string) => get<Notes>(`/api/courses/${courseId}/notes`),
  async saveNotes(courseId: string, content: string, version: number): Promise<Notes> {
    try {
      return await put<Notes>(`/api/courses/${courseId}/notes`, { content, version });
    } catch (error) {
      if (error instanceof ApiError && error.code === "notes_conflict") {
        // The refusal carries the text as it is now.
        throw new NotesConflictError(await api.notes(courseId));
      }
      throw error;
    }
  },
  privateNotes: (courseId: string) => get<{ content: string; updatedAt: string | null }>(`/api/courses/${courseId}/private-notes`),
  savePrivateNotes: (courseId: string, content: string) => put(`/api/courses/${courseId}/private-notes`, { content }),
  search: (q: string) => get<EverywhereResult>(`/api/search${query({ q })}`),
  searchCourse: (courseId: string, q: string) => get<SearchHit[]>(`/api/courses/${courseId}/search${query({ q })}`),

  decks: (courseId: string) => get<Deck[]>(`/api/courses/${courseId}/decks`),
  createDeck: (courseId: string, name: string) => post<Deck>(`/api/courses/${courseId}/decks`, { name }),
  renameDeck: (id: string, name: string) => patch(`/api/decks/${id}`, { name }),
  deleteDeck: (id: string) => del(`/api/decks/${id}`),
  cards: (deckId: string) => get<Card[]>(`/api/decks/${deckId}/cards`),
  queue: (deckId: string) => get<Card[]>(`/api/decks/${deckId}/queue`),
  addCard: (deckId: string, card: { front: string; back: string; source?: string | null }) => post<Card>(`/api/decks/${deckId}/cards`, card),
  updateCard: (id: string, card: { front: string; back: string; source?: string | null }) => put(`/api/cards/${id}`, card),
  deleteCard: (id: string) => del(`/api/cards/${id}`),
  review: (id: string, rating: 1 | 2 | 3 | 4) => post<{ due: string; state: number }>(`/api/cards/${id}/review`, { rating }),
  proposals: (courseId: string) => get<Proposal[]>(`/api/courses/${courseId}/proposals`),
  acceptProposal: (id: string, card?: { front: string; back: string }) => post(`/api/proposals/${id}/accept`, card ?? {}),
  rejectProposal: (id: string) => del(`/api/proposals/${id}`),
  dueCards: () => get<Record<string, number>>("/api/due-cards"),

  recordings: (courseId: string) => get<Recording[]>(`/api/courses/${courseId}/recordings`),
  recording: (id: string) => get<Recording & { transcript: string }>(`/api/recordings/${id}`),
  createRecording: (
    courseId: string,
    draft: { title: string; date: string; language: string | null; durationSeconds: number | null; transcript: string },
  ) => post<{ id: string }>(`/api/courses/${courseId}/recordings`, draft),
  updateRecording: (id: string, change: { title?: string; date?: string }) => patch(`/api/recordings/${id}`, change),
  deleteRecording: (id: string) => del(`/api/recordings/${id}`),
  inbox: () => get<WorkItem[]>("/api/inbox"),

  admin: {
    users: () => get<UserView[]>("/api/admin/users"),
    invite: (email: string, displayName: string, isAdmin: boolean) =>
      post<{ userId: string; link: string | null; mailed: boolean }>("/api/admin/users", { email, displayName, isAdmin }),
    update: (id: string, change: { isAdmin?: boolean; disabled?: boolean; quotaBytes?: number | null; displayName?: string; email?: string }) =>
      patch(`/api/admin/users/${id}`, change),
    resetLink: (id: string) => post<{ link: string }>(`/api/admin/users/${id}/reset-link`),
    remove: (id: string) => del(`/api/admin/users/${id}`),
    status: () => get<ServerStatus>("/api/admin/status"),
    activity: (actor?: string, before?: string) => get<ActivityEntry[]>(`/api/admin/activity${query({ actor, before })}`),
    backup: () => post<{ files: { name: string; size: number }[]; removed: number }>("/api/admin/backups"),
  },
};
