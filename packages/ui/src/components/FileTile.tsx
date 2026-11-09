import { cx } from "../cx";
import type { Tone } from "../tokens";
import { Icon, type IconName } from "./Icon";

export type FileKind = "pdf" | "word" | "slides" | "sheet" | "text" | "image" | "audio" | "other";

const LOOK: Record<FileKind, { tone: Tone; text?: string; icon?: IconName }> = {
  pdf: { tone: "orange", text: "PDF" },
  word: { tone: "blau", text: "DOCX" },
  slides: { tone: "gelb", text: "PPTX" },
  sheet: { tone: "gruen", text: "XLSX" },
  text: { tone: "grau", text: "TXT" },
  image: { tone: "petrol", icon: "image" },
  audio: { tone: "violett", icon: "mic" },
  other: { tone: "grau", icon: "file" },
};

/** The kind of a file from its name or type. */
export function fileKind(name: string, mime = ""): FileKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "word";
  if (["ppt", "pptx", "odp", "key"].includes(ext)) return "slides";
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "sheet";
  if (["txt", "md", "tex"].includes(ext)) return "text";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].includes(ext)) return "image";
  if (mime.startsWith("audio/") || ["mp3", "m4a", "wav", "ogg", "webm", "aac"].includes(ext)) return "audio";
  return "other";
}

export interface FileTileProps {
  kind: FileKind;
  /** Width and height in px. */
  size?: number;
  className?: string;
}

/** The kind of a file at a glance, as a small coloured tile. */
export function FileTile({ kind, size = 44, className }: FileTileProps) {
  const look = LOOK[kind];
  return (
    <span className={cx("ui-filetile", `ui-tone-${look.tone}`, className)} style={{ width: size, height: size, fontSize: Math.round(size / 4) }} aria-hidden="true">
      {look.icon ? <Icon name={look.icon} size={Math.round(size * 0.45)} /> : look.text}
    </span>
  );
}
