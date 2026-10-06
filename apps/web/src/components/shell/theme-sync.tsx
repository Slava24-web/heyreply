'use client';
import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';
import { useMe } from '@/lib/queries';

/** Apply the theme saved in the profile once per session (another device may have changed it). */
export function ThemeSync() {
  const { data } = useMe();
  const { setTheme } = useTheme();
  const done = useRef(false);
  useEffect(() => {
    if (!data || done.current) return;
    done.current = true;
    setTheme(data.theme);
  }, [data, setTheme]);
  return null;
}
