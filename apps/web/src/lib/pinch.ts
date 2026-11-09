// Zooming a pane with Ctrl/⌘ + wheel (a trackpad pinch arrives like that) and with two fingers.
import { useEffect, useRef, type RefObject } from "react";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));

export function usePinchZoom(ref: RefObject<HTMLElement | null>, zoom: number, onZoom?: (zoom: number) => void) {
  const latest = useRef({ zoom, onZoom });
  latest.current = { zoom, onZoom };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const wheel = (event: WheelEvent) => {
      const { zoom: current, onZoom: change } = latest.current;
      if (!change || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      change(clampZoom(current * Math.exp(-event.deltaY * 0.01)));
    };

    let start: { distance: number; zoom: number } | null = null;
    const distance = (event: TouchEvent) => Math.hypot(event.touches[0]!.clientX - event.touches[1]!.clientX, event.touches[0]!.clientY - event.touches[1]!.clientY);
    const touchStart = (event: TouchEvent) => {
      start = event.touches.length === 2 ? { distance: distance(event), zoom: latest.current.zoom } : null;
    };
    const touchMove = (event: TouchEvent) => {
      const change = latest.current.onZoom;
      if (!start || !change || event.touches.length !== 2) return;
      event.preventDefault();
      change(clampZoom((start.zoom * distance(event)) / start.distance));
    };
    const touchEnd = () => {
      start = null;
    };

    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: false });
    element.addEventListener("touchend", touchEnd);
    element.addEventListener("touchcancel", touchEnd);
    return () => {
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("touchend", touchEnd);
      element.removeEventListener("touchcancel", touchEnd);
    };
  }, [ref]);
}
