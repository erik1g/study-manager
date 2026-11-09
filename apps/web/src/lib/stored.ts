// Small things of the device (which panels are open, a zoom): kept in the
// browser, never on the server. Storage may be blocked, then they last until the page is left.
import { useCallback, useState } from "react";

const PREFIX = "study.";

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* blocked or full: the value just is not kept */
  }
}

/** Like `useState`, and kept in the browser under `key`. */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? (next as (c: T) => T)(current) : next;
        writeStored(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, set] as const;
}
