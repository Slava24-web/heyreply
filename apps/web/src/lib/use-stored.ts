'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';

/**
 * A per-browser preference kept in localStorage.
 *
 * It is read synchronously on the first client render (useSyncExternalStore), so the stored value is already in the first
 * paint: no default flashing and then jumping to the saved value, as an effect-after-mount read does. During
 * server rendering and hydration the fallback is used, which keeps markup identical on both sides.
 */
export interface Codec<T> {
  parse: (raw: string) => T;
  serialize: (value: T) => string;
}

const jsonCodec: Codec<unknown> = { parse: (raw) => JSON.parse(raw), serialize: (v) => JSON.stringify(v) };
/** For the flags that were already stored as '1' / '0' */
export const flagCodec: Codec<boolean> = { parse: (raw) => raw === '1', serialize: (v) => (v ? '1' : '0') };

interface Options<T> {
  codec?: Codec<T>;
  /** The value when nothing is stored yet, known only in the browser (e.g. depends on the viewport). */
  clientDefault?: () => T;
  /** A stored value that fails this check is ignored (old or hand-edited data). */
  validate?: (value: unknown) => value is T;
}

const listeners = new Map<string, Set<() => void>>();
/** Values that could not be written to localStorage (private mode, quota) still hold for this page. */
const memory = new Map<string, string>();
/** getSnapshot must return the same reference while nothing changed, or React re-renders forever. */
const snapshots = new Map<string, { raw: string | null; value: unknown }>();

const emit = (key: string) => listeners.get(key)?.forEach((l) => l());

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(key: string, onChange: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(onChange);
  listeners.set(key, set);
  // Another tab changed it
  const onStorage = (e: StorageEvent) => {
    if (e.key !== key && e.key !== null) return;
    memory.delete(key);
    emit(key);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    set.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useStoredState<T>(key: string, initial: T, options: Options<T> = {}) {
  // Stable for the lifetime of the component even when the caller passes a fresh array or object each render
  const [fallback] = useState(initial);
  const { codec = jsonCodec as unknown as Codec<T>, clientDefault, validate } = options;

  const getSnapshot = (): T => {
    const raw = read(key);
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) return cached.value as T;
    let value: T;
    if (raw == null) value = clientDefault ? clientDefault() : fallback;
    else {
      try {
        const parsed = codec.parse(raw);
        value = validate && !validate(parsed) ? fallback : parsed;
      } catch {
        value = fallback;
      }
    }
    snapshots.set(key, { raw, value });
    return value;
  };

  const value = useSyncExternalStore(
    useCallback((onChange) => subscribe(key, onChange), [key]),
    getSnapshot,
    () => fallback,
  );

  const set = useCallback(
    (next: T) => {
      const raw = codec.serialize(next);
      memory.set(key, raw);
      try {
        localStorage.setItem(key, raw);
      } catch {
        /* storage unavailable: the in-memory copy keeps the choice for this visit */
      }
      emit(key);
    },
    [key, codec],
  );

  return [value, set] as const;
}
