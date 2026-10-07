import type { ManualItem, ManualResult, Observed } from './types';
import { apiUrl, getSettings, getState, saveState, type RecentItem, type Settings } from './settings';
import { backoffMinutes, itemKey, MAX_ATTEMPTS, sanitize, sendBatch, SyncError, type Post } from './sync';

const MAX_QUEUE = 500;
const BATCH = 100;
const RETRY_ALARM = 'heyreply-retry';

/** Tabs where the user just applied, per platform: they get an in-page confirmation once heyreply has saved it. */
const NOTIFY_TTL_MS = 3 * 60_000;
const notifyTabs = new Map<string, Map<number, number>>();
const watchTab = (platform: string, tabId: number | undefined) => {
  if (tabId == null) return;
  const now = Date.now();
  // Entries are otherwise only removed once a save is confirmed; a tab closed or abandoned before that would stay forever
  for (const [p, tabs] of notifyTabs) {
    for (const [id, expires] of tabs) if (expires <= now) tabs.delete(id);
    if (!tabs.size) notifyTabs.delete(p);
  }
  const m = notifyTabs.get(platform) ?? new Map<number, number>();
  m.set(tabId, now + NOTIFY_TTL_MS);
  notifyTabs.set(platform, m);
};
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [p, tabs] of notifyTabs) {
    tabs.delete(tabId);
    if (!tabs.size) notifyTabs.delete(p);
  }
});
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

const poster =
  (settings: Settings): Post =>
  (items) =>
    fetch(apiUrl(settings, '/import/applications'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.token}` },
      body: JSON.stringify({ items }),
    });

async function recordManual(item: ManualItem, result: RecentItem['result']) {
  const s = await getState();
  if (result === 'created') s.totals.created++;
  if (result === 'updated' || result === 'linked') s.totals.updated++;
  s.recent = [{ platform: item.platform ?? null, companyName: item.companyName, positionName: item.positionName, status: item.status, result, at: Date.now() }, ...s.recent].slice(0, 20);
  s.lastSyncAt = Date.now();
  await saveState(s);
}

/**
 * "Add manually" from the popup. Sent right away so the popup can say what happened. A vacancy on a known board goes
 * through the regular import (its id deduplicates it with automatic capture) and waits in the queue when offline;
 * any other page goes to /import/manual, where the link is the identity.
 */
async function manualAdd(item: ManualItem): Promise<ManualResult> {
  const settings = await getSettings();
  if (!settings.token) return { error: 'NO_TOKEN' };
  if (item.platform && item.externalId) {
    const obs = sanitize({ ...item, platform: item.platform, externalId: item.externalId, origin: 'apply' });
    if (!obs) return { error: 'INVALID' };
    try {
      const [outcome] = await sendBatch([obs], poster(settings));
      if (outcome === 'rejected' || outcome === 'error') return { error: 'INVALID' };
      await recordManual(item, outcome);
      return { outcome };
    } catch (e) {
      const code = e instanceof Error ? e.message : 'NETWORK';
      if (code === 'BAD_TOKEN') return { error: code };
      await enqueue([obs], { manual: true });
      return { outcome: 'queued' };
    }
  }
  try {
    const res = await fetch(apiUrl(settings, '/import/manual'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.token}` },
      body: JSON.stringify({ companyName: item.companyName, positionName: item.positionName, vacancyUrl: item.vacancyUrl || null, locationName: item.locationName || null, status: item.status ?? null, appliedAt: item.appliedAt ?? null }),
    });
    if (res.status === 401) return { error: 'BAD_TOKEN' };
    if (res.status === 429) return { error: 'RATE_LIMIT' };
    if (res.status === 400 || res.status === 422) return { error: res.status === 422 ? 'LIMIT' : 'INVALID' };
    if (!res.ok) return { error: 'NETWORK' };
    const { outcome } = (await res.json()) as { outcome: 'created' | 'updated' | 'unchanged' | 'linked' };
    await recordManual(item, outcome);
    return { outcome };
  } catch {
    return { error: 'NETWORK' };
  }
}

async function enqueue(items: Observed[], { manual = false } = {}) {
  const settings = await getSettings();
  const state = await getState();
  // A platform switched off in the popup stops automatic capture; an application the user adds by hand still goes through
  const allowed = items.filter((i) => manual || !settings.disabled.includes(i.platform)).map((i) => sanitize(i)).filter((i): i is Observed => !!i);
  // Keep one entry per vacancy+origin: the latest observation wins
  const map = new Map(state.queue.map((i) => [itemKey(i), i]));
  for (const i of allowed) map.set(itemKey(i), i);
  state.queue = [...map.values()].slice(-MAX_QUEUE);
  await saveState(state);
  await flush();
}

const scheduleRetry = (minutes: number) => chrome.alarms.create(RETRY_ALARM, { delayInMinutes: minutes });

async function doFlush(skip: Set<string> = new Set()) {
  const settings = await getSettings();
  const initial = await getState();
  if (!initial.queue.some((i) => !skip.has(itemKey(i)))) return;
  if (!settings.token) {
    initial.lastError = 'NO_TOKEN';
    await saveState(initial);
    return updateBadge(initial.queue.length, true);
  }
  const post = poster(settings);

  // One pass over what is queued now. Items that failed stay queued for the next pass, so this can't loop on them.
  const pass = initial.queue.filter((i) => !skip.has(itemKey(i)));
  const seen = new Set([...skip, ...pass.map(itemKey)]);
  let created = 0;
  let updated = 0;
  let retained = 0;
  let worstAttempt = 1;
  try {
    for (let from = 0; from < pass.length; from += BATCH) {
      const batch = pass.slice(from, from + BATCH);
      const outcomes = await sendBatch(batch, post);
      const fresh = await getState();
      const done = new Set<string>();
      const recent: RecentItem[] = [];
      batch.forEach((i, idx) => {
        const key = itemKey(i);
        const outcome = outcomes[idx];
        const failed = outcome === 'error' || outcome === 'rejected';
        const attempts = (fresh.attempts[key] ?? 0) + (failed ? 1 : 0);
        if (failed && attempts < MAX_ATTEMPTS) {
          fresh.attempts[key] = attempts;
          worstAttempt = Math.max(worstAttempt, attempts);
          retained++;
          return;
        }
        done.add(key);
        delete fresh.attempts[key];
        if (outcome === 'created') created++;
        if (outcome === 'updated') updated++;
        // Show what actually changed: new applications and status updates (a sync of 50 unchanged rows is noise)
        if (outcome !== 'unchanged') recent.push({ platform: i.platform, companyName: i.companyName, positionName: i.positionName, status: i.status, result: failed ? 'error' : outcome, at: Date.now() });
      });
      fresh.queue = fresh.queue.filter((i) => !done.has(itemKey(i)));
      fresh.lastSyncAt = Date.now();
      fresh.failures = 0;
      fresh.lastError = retained ? 'PARTIAL' : null;
      fresh.totals.created += outcomes.filter((o) => o === 'created').length;
      fresh.totals.updated += outcomes.filter((o) => o === 'updated').length;
      notifySaved(batch.filter((_, idx) => outcomes[idx] === 'created'));
      fresh.recent = [...recent, ...fresh.recent].slice(0, 20);
      await saveState(fresh);
    }
    if (created || updated) updateBadge(created + updated, false);
    if (retained) scheduleRetry(backoffMinutes(worstAttempt));
    // Observations that arrived while this pass was running are sent right away
    if ((await getState()).queue.some((i) => !seen.has(itemKey(i)))) await doFlush(seen);
  } catch (e) {
    const s = await getState();
    s.failures += 1;
    s.lastError = e instanceof SyncError ? e.message : e instanceof Error ? e.message : 'NETWORK';
    await saveState(s);
    updateBadge(s.queue.length, true);
    // A bad token won't fix itself: wait for the user instead of hammering the server
    if (s.lastError !== 'BAD_TOKEN') scheduleRetry(e instanceof SyncError && e.retryAfterMin ? e.retryAfterMin : backoffMinutes(s.failures));
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
  if (msg?.type === 'manual' && msg.item) {
    manualAdd(msg.item as ManualItem).then(reply);
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
