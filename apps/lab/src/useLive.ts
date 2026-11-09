import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** Runs a Dexie query and re-runs it whenever the data it read changes. */
export function useLive<T>(query: () => Promise<T>): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (err) => console.error(err),
    });
    return () => subscription.unsubscribe();
    // The queries used here have no inputs, so subscribing once is enough.
  }, []);
  return value;
}
