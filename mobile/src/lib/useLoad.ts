import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useLiveReload } from "./live";

/**
 * Loads data from the API, reloads when the screen comes back into view, and supports pull-to-refresh.
 * `key` identifies what is loaded (e.g. the employee id); a new key loads again.
 */
/** `live` lists the kinds of server change that should reload this screen automatically. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = [], live?: string[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  const seenFocus = useRef(false);
  const key = JSON.stringify(deps);

  useEffect(() => {
    loaderRef.current = loader;
  });

  // Last data as JSON: a reload that returns the same data does not redraw the screen (no jank).
  const lastJson = useRef<string | null>(null);
  const fetchNow = useCallback(() => {
    return loaderRef.current().then(
      (d) => {
        let json: string | null = null;
        try {
          json = JSON.stringify(d);
        } catch {}
        if (json !== null && json === lastJson.current) {
          setError(null);
          return;
        }
        lastJson.current = json;
        setData(d);
        setError(null);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong"),
    );
  }, []);

  useEffect(() => {
    seenFocus.current = false;
    let alive = true;
    loaderRef.current().then(
      (d) => {
        if (!alive) return;
        try {
          lastJson.current = JSON.stringify(d);
        } catch {}
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : "Something went wrong"),
    );
    return () => {
      alive = false;
    };
  }, [key]);

  // Reload when the user comes back to this screen (not on the first show).
  useFocusEffect(
    useCallback(() => {
      if (!seenFocus.current) {
        seenFocus.current = true;
        return;
      }
      // Wait for the back / tab animation to finish before reloading, so it stays smooth.
      const t = setTimeout(() => void fetchNow(), 350);
      return () => clearTimeout(t);
    }, [fetchNow]),
  );

  useLiveReload(live, () => void fetchNow());

  const reload = useCallback(async () => {
    setRefreshing(true);
    await fetchNow();
    setRefreshing(false);
  }, [fetchNow]);

  return { data, error, refreshing, reload, setData };
}
