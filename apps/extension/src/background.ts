import type { ImportResultDto } from '@heyreply/shared';
import type { Observed } from './types';
import { apiUrl, getSettings, getState, saveState, type RecentItem } from './settings';

const MAX_QUEUE = 500;
const BATCH = 100;
const RETRY_ALARM = 'heyreply-retry';

/** Tabs where the user just applied, per platform: they get an in-page confirmation once heyreply has saved it. */
const NOTIFY_TTL_MS = 3 * 60_000;
const notifyTabs = new Map<string, Map<number, number>>();
const watchTab = (platform: string, tabId: number | undefined) => {
  if (tabId == null) return;
  const m = notifyTabs.get(platform) ?? new Map<number, number>();
  m.set(tabId, Date.now() + NOTIFY_TTL_MS);
  notifyTabs.set(platform, m);
};
function notifySaved(created: Observed[]) {
  const byPlatform = new Map<string, Observed[]>();
  for (const i of created) byPlatform.set(i.platform, [...(byPlatform.get(i.platform) ?? []), i]);
  for (const [platform, items] of byPlatform) {
    const tabs = notifyTabs.get(platform);
    if (!tabs) continue;
    for (const [tabId, expires] of tabs) {
      if (expires > Date.now()) chrome.tabs.sendMessage(tabId, { type: 'toast', companyName: items[0].companyName, positionName: items[0].positionName, count: items.length }, { frameId: 0 }).catch(() => {});
    }
    notifyTabs.delete(platform);
  }
}

let flushing: Promise<void> | null = null;

async function enqueue(items: Observed[]) {
  const settings = await getSettings();
  const state = await getState();
  const allowed = items.filter((i) => !settings.disabled.includes(i.platform));
  // Keep one entry per vacancy+origin: the latest observation wins
  const key = (i: Observed) => `${i.platform}:${i.externalId}:${i.origin}`;
  const map = new Map(state.queue.map((i) => [key(i), i]));
  for (const i of allowed) map.set(key(i), i);
  state.queue = [...map.values()].slice(-MAX_QUEUE);
  await saveState(state);
  await flush();
}

async function doFlush() {
  const settings = await getSettings();
  const state = await getState();
  if (!state.queue.length) return;
  if (!settings.token) {
    state.lastError = 'NO_TOKEN';
    await saveState(state);
    return updateBadge(state.queue.length, true);
  }
  const batch = state.queue.slice(0, BATCH);
  try {
    const res = await fetch(apiUrl(settings, '/import/applications'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.token}` },
      body: JSON.stringify({ items: batch }),
    });
    if (res.status === 401) throw new Error('BAD_TOKEN');
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const r = (await res.json()) as ImportResultDto;
    const fresh = await getState();
    const sent = new Set(batch.map((i) => `${i.platform}:${i.externalId}:${i.origin}`));
    fresh.queue = fresh.queue.filter((i) => !sent.has(`${i.platform}:${i.externalId}:${i.origin}`));
    fresh.lastSyncAt = Date.now();
    fresh.lastError = r.errors.length ? `PARTIAL_${r.errors.length}` : null;
    fresh.totals.created += r.created;
    fresh.totals.updated += r.updated;
    // Show what actually changed: new applications and status updates (a sync of 50 unchanged rows is noise)
    const recent: RecentItem[] = batch
      .map((i, idx) => ({ i, result: r.items[idx] ?? 'unchanged' }))
      .filter(({ result }) => result === 'created' || result === 'updated' || result === 'linked' || result === 'error')
      .map(({ i, result }) => ({ platform: i.platform, companyName: i.companyName, positionName: i.positionName, status: i.status, result, at: Date.now() }));
    notifySaved(batch.filter((_, idx) => r.items[idx] === 'created'));
    fresh.recent = [...recent, ...fresh.recent].slice(0, 20);
    await saveState(fresh);
    if (r.created || r.updated) updateBadge(r.created + r.updated, false);
    if (fresh.queue.length) await doFlush();
  } catch (e) {
    const s = await getState();
    s.lastError = e instanceof Error ? e.message : 'NETWORK';
    await saveState(s);
    updateBadge(s.queue.length, true);
    chrome.alarms.create(RETRY_ALARM, { delayInMinutes: 1 });
  }
}

function flush() {
  flushing ??= doFlush().finally(() => (flushing = null));
  return flushing;
}

function updateBadge(count: number, problem: boolean) {
  chrome.action.setBadgeBackgroundColor({ color: problem ? '#9e2a48' : '#7a2e8e' });
  chrome.action.setBadgeText({ text: count ? (problem ? `${count}` : `+${count}`) : '' });
  if (!problem && count) setTimeout(() => chrome.action.setBadgeText({ text: '' }), 8000);
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'observed' && Array.isArray(msg.items)) {
    for (const i of msg.items as Observed[]) if (i.origin === 'apply') watchTab(i.platform, _sender.tab?.id);
    enqueue(msg.items as Observed[]).then(() => reply({ ok: true }));
    return true;
  }
  if (msg?.type === 'flush') {
    flush().then(() => reply({ ok: true }));
    return true;
  }
  return false;
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === RETRY_ALARM) flush();
});
chrome.runtime.onStartup?.addListener(() => flush());
