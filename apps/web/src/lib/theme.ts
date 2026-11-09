// Light, dark or whatever the system says; a matter of the device, so it is
// kept in the browser.
import { dark as darkTheme, light as lightTheme } from "@study/ui/tokens";

export type Theme = "system" | "light" | "dark";

const KEY = "study.theme";

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? darkTheme.neutrals.bg : lightTheme.neutrals.bg);
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Private windows may refuse; the choice then lasts until the page is left.
  }
  applyTheme(theme);
}
