import type { ReactNode, SVGProps } from "react";

/**
 * Every icon is drawn on a 24 × 24 grid with round 2 px lines. Some have a
 * filled form too, for subject tiles and states that should weigh more.
 */
const LINE = {
  // Places in the app
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </>
  ),
  checklist: (
    <>
      <path d="m4 6.5 1.6 1.6L8.5 5M4 13.5l1.6 1.6 2.9-3.1" />
      <path d="M11.5 7h8.5M11.5 14h8.5M4.5 19.5h15.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </>
  ),
  shield: <path d="M12 3 19.5 6v5.5c0 4.5-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5-7.5-9.5V6z" />,
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),

  // Actions
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  edit: (
    <>
      <path d="M14.5 5.5l4 4L9 19H5v-4z" />
      <path d="M12.5 7.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  restore: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4v4h4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="3" />
      <path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  // Directions
  "chevron-right": <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  "chevron-left": <path d="M14.5 5.5 8 12l6.5 6.5" />,
  "chevron-down": <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  sidebar: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  columns: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
      <path d="M12 4.5v15" />
    </>
  ),
  expand: <path d="M4.5 9.5v-3a2 2 0 0 1 2-2h3M14.5 4.5h3a2 2 0 0 1 2 2v3M19.5 14.5v3a2 2 0 0 1-2 2h-3M9.5 19.5h-3a2 2 0 0 1-2-2v-3" />,

  // Things
  file: (
    <>
      <path d="M6 3.5h8l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M13.5 3.5V8.5h5" />
    </>
  ),
  folder: <path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h3.5l2 2.5H18a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17z" />,
  note: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5c2.7-1.3 5.3-1.3 8 0v14c-2.7-1.3-5.3-1.3-8 0z" />
      <path d="M12 5.5c2.7-1.3 5.3-1.3 8 0v14c-2.7-1.3-5.3-1.3-8 0z" />
    </>
  ),
  cards: (
    <>
      <rect x="7" y="4" width="13" height="16" rx="3" />
      <path d="M4 7.5v10A2.5 2.5 0 0 0 6.5 20" />
      <path d="M11 9.5h5M11 13h3" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5V17a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 16-4.5-4.5L7 19.5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.5-1-2.6 0-1 .8-1.7 1.8-1.7h2A3.9 3.9 0 0 0 20.5 11 7.8 7.8 0 0 0 12 3.5z" />
      <circle cx="7.8" cy="11" r="1" fill="currentColor" />
      <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="15" cy="7.8" r="1" fill="currentColor" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M15.5 5.7a3.5 3.5 0 0 1 0 6.6M17.5 14a6.5 6.5 0 0 1 4 5.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="9" r="4" />
      <path d="M2 21a6 6 0 0 1 10.5-4" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M18 14.5V21l1.5-1.5M18 18h1.5" />
    </>
  ),
  claude: (
    <>
      <path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 4.5 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12.3 2.8 2.7L16 9.5" />
    </>
  ),
  list: <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,

  // Subjects
  signal: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  building: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20V9l5-5 5 5v11" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  crystal: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" />
    </>
  ),
  sigma: <path d="M18 5H7l6 7-6 7h11" />,
  flame: <path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 1.5 1.5 2.5 3 2.5 0-3-1-5.5 0-8z" />,
  compass: (
    <>
      <path d="M4 20 20 4" />
      <path d="M4 20h7M4 20v-7" />
      <circle cx="17" cy="17" r="3" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3.5h5M10 3.5v5.5L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9V3.5" />
      <path d="M7.5 14.5h9" />
    </>
  ),
  code: <path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13.5 14.5-14-.5 9.5-6 14.5-14 14z" />
      <path d="M5 19 13 11" />
    </>
  ),
  atom: (
    <>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(-60 12 12)" />
    </>
  ),
  calculator: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01" />
    </>
  ),
} satisfies Record<string, ReactNode>;

/** Filled forms, where an icon has one. They use the current text colour as fill. */
const FILLED: Partial<Record<keyof typeof LINE, ReactNode>> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5z" fill="currentColor" />
    </>
  ),
  folder: <path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h3.5l2 2.5H18a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17z" fill="currentColor" />,
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" fill="currentColor" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
      <path d="m8 12.3 2.8 2.7L16 9.5" stroke="var(--ui-surface)" />
    </>
  ),
  building: (
    <>
      <path d="M12 3.5 18 9.5V20H6V9.5z" fill="currentColor" stroke="none" />
      <path d="M3.5 20.2h17" />
    </>
  ),
  crystal: <path d="M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3z" fill="currentColor" stroke="none" />,
  flame: <path d="M12 2.5c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-2.4 1.2-4.2 2.4-5.4.6 1.8 1.8 3 3.6 3 0-3.6-1.2-6.6 0-8.6z" fill="currentColor" stroke="none" />,
  leaf: (
    <>
      <path d="M5 19c0-8 5-13.5 14.5-14-.5 9.5-6 14.5-14 14z" fill="currentColor" />
      <path d="M5 19 13 11" stroke="var(--ui-surface)" />
    </>
  ),
};

export type IconName = keyof typeof LINE;

/** All icon names, for the docs and pickers. */
export const ICON_NAMES = Object.keys(LINE) as IconName[];
/** Names of the icons that have a filled form. */
export const FILLED_ICON_NAMES = Object.keys(FILLED) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Width and height in px. */
  size?: number;
  /** The filled form, where there is one; otherwise the line form. */
  filled?: boolean;
  /** What the icon means, when nothing next to it says so. Without it the icon is hidden from screen readers. */
  label?: string;
}

/** A line icon in the current text colour. */
export function Icon({ name, size = 20, filled = false, label, className, ...rest }: IconProps) {
  const shape = (filled && FILLED[name]) || LINE[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `ui-icon ${className}` : "ui-icon"}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      focusable="false"
      {...rest}
    >
      {label && <title>{label}</title>}
      {shape}
    </svg>
  );
}
