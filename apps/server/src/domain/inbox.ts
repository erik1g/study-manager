// The work inbox: what is waiting for the user's Claude. The cloud runs no
// AI itself, so instead of doing this work it lists it, and Claude picks it
// up through MCP when the user says so.
import { atLeast, type Locale } from "@study/shared";
import type { coursesOf } from "./courses.ts";
import type { notesOf } from "./notes.ts";
import type { recordingsOf } from "./recordings.ts";

export interface WorkItem {
  kind: "outline" | "lecture";
  courseId: string;
  course: string;
  /** The course's language: what Claude writes into it is in this language. */
  locale: Locale;
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
            locale: course.locale,
            id: script.id,
            title: script.name,
            todo: "Read the script with read_document and add its outline (chapters, sections, pages) to the notes with submit_outline.",
          });
        }
        for (const recording of await recordings.unanalysed(course.id)) {
          items.push({
            kind: "lecture",
            courseId: course.id,
            course: course.title,
            locale: course.locale,
            id: recording.id,
            title: `${recording.title} (${recording.date})`,
            todo: "Read the transcript with read_transcript, assign key points (in the course's language) and verbatim exam hints to the sections from notes_outline and add them with submit_lecture_notes.",
          });
        }
      }
      return items;
    },
  };
}
