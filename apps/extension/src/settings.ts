import type { ImportPlatform } from '@heyreply/shared';
import type { Observed } from './types';

export interface Settings {
  serverUrl: string;
  token: string;
  disabled: ImportPlatform[];
}

export interface RecentItem {
  /** null for a page without a board adapter added by hand */
  platform: ImportPlatform | null;
  companyName: string;
  positionName: string;
  status?: string | null;
  result: 'created' | 'updated' | 'unchanged' | 'linked' | 'error';
  at: number;
}

export interface State {
  queue: Observed[];
  recent: RecentItem[];
  lastSyncAt: number | null;
  lastError: string | null;
  totals: { created: number; updated: number };
  /** Failed deliveries per queued item (server refused it or failed on it); an item is given up on after MAX_ATTEMPTS */
  attempts: Record<string, number>;
  /** Consecutive sends that failed as a whole (offline, 5xx, rate limit): drives the retry back-off */
  failures: number;
}

export const DEFAULT_SETTINGS: Settings = { serverUrl: 'http://localhost:3000', token: '', disabled: [] };
export const DEFAULT_STATE: State = { queue: [], recent: [], lastSyncAt: null, lastError: null, totals: { created: 0, updated: 0 }, attempts: {}, failures: 0 };

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}
export async function getState(): Promise<State> {
  const { state } = await chrome.storage.local.get('state');
  return { ...DEFAULT_STATE, ...(state ?? {}) };
}
export const saveSettings = (s: Settings) => chrome.storage.local.set({ settings: s });
export const saveState = (s: State) => chrome.storage.local.set({ state: s });

export const apiUrl = (s: Settings, path: string) => `${s.serverUrl.replace(/\/+$/, '')}/api/v1${path}`;
