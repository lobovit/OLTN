import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Status } from "../api/types";
import { store } from "./store";

export function useStatus(key: string): Status | undefined {
  const snap = useSnapshot(store.statuses);
  return snap[key] as unknown as Status | undefined;
}

export function useAppState() {
  return useSnapshot(store);
}

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((value) => {
        if (alive) {
          setData(value);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}
