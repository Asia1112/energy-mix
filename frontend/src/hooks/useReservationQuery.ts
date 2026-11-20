import { useEffect, useState } from "react";

type Loader<T> = (
  signal: AbortSignal,
  chargerId: string,
  periodStart: string,
  periodEnd: string
) => Promise<T>;

interface QueryResult<T> {
  load: Loader<T>;
  key: string;
  data: T | null;
  error: boolean;
}

export function useReservationQuery<T>(
  load: Loader<T> | null,
  chargerId = "",
  periodStart = "",
  periodEnd = ""
) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<QueryResult<T> | null>(null);
  const key = JSON.stringify([chargerId, periodStart, periodEnd, revision]);

  useEffect(() => {
    if (!load) return;

    const controller = new AbortController();
    const { signal } = controller;
    void load(signal, chargerId, periodStart, periodEnd).then(
      (data) => {
        if (!signal.aborted) setResult({ load, key, data, error: false });
      },
      () => {
        if (!signal.aborted) setResult({ load, key, data: null, error: true });
      }
    );

    return () => controller.abort();
  }, [load, chargerId, periodStart, periodEnd, key]);

  const current = result?.load === load && result.key === key ? result : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? false,
    loading: load !== null && current === null,
    reload: () => setRevision((previous) => previous + 1)
  };
}
