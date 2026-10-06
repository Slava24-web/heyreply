'use client';
import { useEffect, useState } from 'react';

/**
 * True only after the component has mounted on the client — gate client-only (cached user) data
 * so the server render and the hydration render are identical. (A useSyncExternalStore variant
 * reported `true` during hydration inside streamed Suspense boundaries.)
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}
