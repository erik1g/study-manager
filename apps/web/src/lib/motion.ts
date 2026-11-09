// Moving between pages. Ordinary navigation is instant, as it happens all
// day; only opening a subject from its card morphs the card into the page.
import { flushSync } from "react-dom";
import { useCallback } from "react";
import { useNavigate, type NavigateOptions } from "react-router";

export const prefersLessMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function withTransition(update: () => void) {
  if (!document.startViewTransition || prefersLessMotion()) update();
  else document.startViewTransition(() => flushSync(update));
}

export function useGo(morph = false) {
  const navigate = useNavigate();
  return useCallback(
    (to: string, options?: NavigateOptions) => (morph ? withTransition(() => navigate(to, options)) : navigate(to, options)),
    [navigate, morph],
  );
}
