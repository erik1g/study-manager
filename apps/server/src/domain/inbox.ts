// The work inbox: what is waiting for the user's Claude. The cloud runs no
// AI itself, so instead of doing this work it lists it, and Claude picks it
// up through MCP when the user says so.
import { atLeast } from "@study/shared";
import type { coursesOf } from "./courses.ts";
import type { notesOf } from "./notes.ts";
import type { recordingsOf } from "./recordings.ts";

export interface WorkItem {
  kind: "outline" | "lecture";
  courseId: string;
  course: string;
  /** The file or recording to work on. */
  id: string;
  title: string;
  /** What Claude should do, in a sentence. */
  todo: string;
}

export function inboxOf(courses: ReturnType<typeof coursesOf>, notes: ReturnType<typeof notesOf>, recordings: ReturnType<typeof recordingsOf>) {
  return {
    async items(userId: string): Promise<WorkItem[]> {
      const items: WorkItem[] = [];
      for (const course of await courses.list(userId)) {
        // Only editors can write into the shared notes.
        if (!atLeast(course.role, "editor")) continue;
        for (const script of await notes.scriptsWithoutOutline(course.id)) {
          items.push({
            kind: "outline",
            courseId: course.id,
            course: course.title,
            id: script.id,
            title: script.name,
            todo: "Skript mit read_document lesen und seine Gliederung (Kapitel, Abschnitte, Seiten) mit submit_outline in die Notizen eintragen.",
          });
        }
        for (const recording of await recordings.unanalysed(course.id)) {
          items.push({
            kind: "lecture",
            courseId: course.id,
            course: course.title,
            id: recording.id,
            title: `${recording.title} (${recording.date})`,
            todo: "Transkript mit read_transcript lesen, Kernpunkte und wörtliche Prüfungshinweise den Abschnitten aus notes_outline zuordnen und mit submit_lecture_notes eintragen.",
          });
        }
      }
      return items;
    },
  };
}
