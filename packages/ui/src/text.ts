// The few words the building blocks bring along themselves (a close button,
// a loading label). English by default; an app in another language hands
// over its own once at start with `setUiText`, before anything renders.
import { TONE_NAMES, type Tone } from "./tokens";

export interface UiText {
  close: string;
  cancel: string;
  loading: string;
  clearSearch: string;
  /** The name of a breadcrumb trail. */
  breadcrumb: string;
  /** The name of the main navigation (sidebar, tab bar). */
  mainNav: string;
  /** The last choice of a `TonePicker` with `allowNone`. */
  noColour: string;
  tones: Record<Tone, string>;
}

const text: UiText = {
  close: "Close",
  cancel: "Cancel",
  loading: "Loading",
  clearSearch: "Clear search",
  breadcrumb: "Path",
  mainNav: "Main navigation",
  noColour: "No colour",
  tones: { ...TONE_NAMES },
};

/** Replaces the building blocks' own words, e.g. with a translation. */
export function setUiText(next: Partial<UiText>) {
  Object.assign(text, next);
}

/** The building blocks' own words as currently set. */
export function uiText(): Readonly<UiText> {
  return text;
}
