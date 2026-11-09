// How many notifications wait: asked on every page change, every minute and
// whenever something changed.
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { api } from "./api";
import { useChanged } from "./events";

const EVERY = 60_000;

export function useUnreadNotifications(): number {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);
  const load = useCallback(() => void api.unreadNotifications().then((r) => setCount(r.count), () => {}), []);
  useEffect(load, [load, pathname]);
  useEffect(() => {
    const timer = setInterval(load, EVERY);
    return () => clearInterval(timer);
  }, [load]);
  useChanged(load);
  return count;
}
