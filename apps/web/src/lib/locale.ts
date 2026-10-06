'use client';
import type { Locale } from '@heyreply/shared';
import { api } from './api';

/**
 * Switches the UI language with a full navigation. The locale is part of the root layout, so a client-side
 * transition would re-render the whole document on the client — including next-themes' pre-paint <script>,
 * which React 19 refuses to run ("Encountered a script tag…"). A real navigation also refreshes <html lang>,
 * page titles and metadata. Path, query and hash are kept.
 */
export async function switchLocale(next: Locale, { persist = false }: { persist?: boolean } = {}) {
  if (persist) await api('/me', { method: 'PATCH', body: { locale: next } }).catch(() => {});
  const { pathname, search, hash } = window.location;
  const rest = pathname.replace(/^\/(ru|en)(?=\/|$)/, '');
  window.location.assign(`/${next}${rest}${search}${hash}`);
}
