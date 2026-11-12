// Where an assistant remembers the reader's choices, as kunnskapsassistenten does in its own keys:
// the panels' layout, the filter, the collection, the display level and the experiments. The host
// gives the storage; without one, nothing is kept past the page.
import { useCallback, useEffect, useState } from 'react';

export interface AssistantStorage {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
  remove(key: string): void;
  /** Another tab changed `key`. Returns the unsubscribe. */
  subscribe?(key: string, change: () => void): () => void;
}

/** The browser's localStorage under a prefix, followed across tabs. Silent where it is closed. */
export const browserStorage = (prefix: string): AssistantStorage => ({
  read: (key) => {
    try {
      const raw = localStorage.getItem(`${prefix}${key}`);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  },
  write: (key, value) => {
    try {
      localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
    } catch {
      // A private window: the choice lasts for the page.
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(`${prefix}${key}`);
    } catch {
      // Not writable.
    }
  },
  subscribe: (key, change) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === `${prefix}${key}`) change();
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  },
});

/**
 * A value kept in the storage under `key`, read once and again when another tab changes it.
 * `parse` turns what is stored into the value, or the fallback for anything else; `store` turns the
 * value into what is stored, for a value JSON cannot hold as it is, such as a Map.
 */
export const useStoredValue = <T>(
  storage: AssistantStorage | undefined,
  key: string,
  parse: (stored: unknown) => T,
  store?: (value: T) => unknown,
) => {
  const [value, setValue] = useState<T>(() => parse(storage?.read(key)));
  useEffect(
    () => storage?.subscribe?.(key, () => setValue(parse(storage.read(key)))),
    // `parse` is the caller's constant.
    [storage, key],
  );
  const set = useCallback(
    (next: T) => {
      setValue(next);
      storage?.write(key, store ? store(next) : next);
    },
    [storage, key],
  );
  return [value, set] as const;
};
