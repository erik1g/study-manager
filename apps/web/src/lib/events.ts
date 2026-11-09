// Things that happen across the app, without passing callbacks around.
import { useEffect } from "react";

/** Something changed that lists elsewhere on the page may show. */
export const emitChanged = () => window.dispatchEvent(new Event("study:changed"));

export function useChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener("study:changed", reload);
    return () => window.removeEventListener("study:changed", reload);
  }, [reload]);
}

export const openPalette = () => window.dispatchEvent(new Event("study:palette"));

export const toast = (text: string) => window.dispatchEvent(new CustomEvent("study:toast", { detail: text }));
