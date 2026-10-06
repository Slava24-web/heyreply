import type { Observed, VacancyData } from '../types';
import { adapterFor } from './platforms';
import { extractVacancy, isApplied } from './extract';
import { parseList } from './list';

declare const __E2E__: boolean;

const SETTLE_MS = 800;
if (__E2E__) document.documentElement.dataset.heyreplyContent = '1';
const reported = new Set<string>();

/**
 * ATS confirmation pages ("…/thanks", "Application submitted") often drop the vacancy details,
 * so the details seen on the job page are remembered for the tab's session.
 */
const cacheKey = (platform: string, id: string) => `heyreply:v:${platform}:${id}`;
function remember(platform: string, id: string, v: VacancyData) {
  try {
    sessionStorage.setItem(cacheKey(platform, id), JSON.stringify(v));
  } catch {
    /* storage disabled on the page */
  }
}
function recall(platform: string, id: string): VacancyData | null {
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(platform, id)) ?? 'null');
  } catch {
    return null;
  }
}

function send(items: Observed[]) {
  const fresh = items.filter((i) => {
    const key = `${i.platform}:${i.externalId}:${i.status ?? ''}:${i.origin}`;
    if (reported.has(key)) return false;
    reported.add(key);
    return true;
  });
  if (fresh.length) chrome.runtime.sendMessage({ type: 'observed', items: fresh }).catch(() => {});
}

function scan() {
  const url = new URL(location.href);
  const adapter = adapterFor(url);
  if (!adapter) return;

  if (adapter.isListPage?.(url)) {
    const items = parseList(document, adapter);
    send(items.map((i) => ({ ...i, origin: 'sync' as const })));
    return;
  }

  const id = adapter.vacancyId(url);
  if (__E2E__) document.documentElement.dataset.heyreplyScan = `${adapter.platform}:${id}:${isApplied(document, adapter)}`;
  if (!id) return;
  const extracted = extractVacancy(document, adapter, url);
  if (extracted && !isApplied(document, adapter)) {
    remember(adapter.platform, id, extracted);
    return;
  }
  if (!isApplied(document, adapter)) return;
  // On a confirmation page prefer what was seen on the job page: it is richer and more reliable
  const vacancy = recall(adapter.platform, id) ?? extracted;
  if (!vacancy) return;
  send([{ platform: adapter.platform, externalId: id, vacancyUrl: adapter.vacancyUrl(id), ...vacancy, origin: 'apply' }]);
}

// Boards are SPAs: re-scan after DOM changes settle and on client-side navigation
let timer: ReturnType<typeof setTimeout> | undefined;
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(scan, SETTLE_MS);
};
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    schedule();
  }
}, 1000);
schedule();
