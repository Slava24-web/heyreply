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

  if (!adapter.isListPage?.(url) && checkPendingConfirmation(adapter)) return;

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

/**
 * Real-time capture: hook.ts (page world) reports every successful apply-like request. The vacancy is found in the
 * request itself, so this works for applications made from search results, popups and Easy Apply, on any page.
 */
const VACANCY_IN_REQUEST = /(?:vacancy[_-]?id|vacancyId|job[_-]?id|jobId|job_?posting|vacanc(?:y|ies)|jobs\/view|\bjk)\W{0,12}(?:urn:li:\w+:)?(\d{5,})/i;

async function vacancyFor(adapter: NonNullable<ReturnType<typeof adapterFor>>, id: string): Promise<VacancyData | null> {
  const here = new URL(location.href);
  const cached = recall(adapter.platform, id);
  if (cached) return cached;
  if (adapter.vacancyId(here) === id) {
    const v = extractVacancy(document, adapter, here);
    if (v) return v;
  }
  // Applied from a list: read the vacancy page itself (same origin, the user's own session, no tab involved)
  try {
    const target = new URL(adapter.vacancyUrl(id));
    const res = await fetch(target.pathname + target.search, { credentials: 'include' });
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    return extractVacancy(doc, adapter, target);
  } catch {
    return null;
  }
}

/**
 * A click on an apply control tells us WHICH vacancy the user is applying to (the card or page it sits in); the
 * click alone saves nothing — the application is recorded only when the site then confirms it (request succeeded).
 * This also covers requests that don't carry the vacancy id.
 */
const PENDING_TTL_MS = 2 * 60_000;
let pending: { id: string; at: number } | null = null;

/**
 * Classic (non-AJAX) flows: the form is submitted, the page reloads onto a confirmation screen. The vacancy seen at
 * click time is kept in sessionStorage so the confirmation screen can be matched to it; nothing is saved without
 * the confirmation actually appearing.
 */
const CONFIRM_URL = /thank|confirm|success|submitted|applied|complete|spasibo/i;
const CONFIRM_TEXT = /thank\s+you\s+for\s+appl|application\s+(has\s+been\s+|was\s+)?(received|submitted|sent)|successfully\s+(applied|submitted)|спасибо\s+за\s+отклик|ваш[ae]?\s+(отклик|заявка|резюме)\s+(отправлен|получен|принят|доставлен)|заявка\s+(получена|принята|отправлена)/i;
const pendingKey = (platform: string) => `heyreply:pending:${platform}`;
type StoredPending = { id: string; at: number; vacancy: VacancyData | null };
function storePending(platform: string, p: StoredPending) {
  try {
    sessionStorage.setItem(pendingKey(platform), JSON.stringify(p));
  } catch {
    /* storage disabled */
  }
}
function readPending(platform: string): StoredPending | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(pendingKey(platform)) ?? 'null') as StoredPending | null;
    return p && Date.now() - p.at < 3 * 60_000 ? p : null;
  } catch {
    return null;
  }
}
const clearPending = (platform: string) => {
  try {
    sessionStorage.removeItem(pendingKey(platform));
  } catch {
    /* storage disabled */
  }
};

function checkPendingConfirmation(adapter: NonNullable<ReturnType<typeof adapterFor>>) {
  const p = readPending(adapter.platform);
  if (!p?.vacancy) return false;
  const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const confirmed = (CONFIRM_URL.test(location.pathname) && text.length < 6000) || (text.length < 3000 && CONFIRM_TEXT.test(text));
  if (!confirmed) return false;
  clearPending(adapter.platform);
  send([{ platform: adapter.platform, externalId: p.id, vacancyUrl: adapter.vacancyUrl(p.id), ...p.vacancy, origin: 'apply' }]);
  return true;
}
const APPLY_LABEL = /откликнуть|отправить\s+(отклик|заявк|резюме)|подать\s+заявк|easy\s+apply|\bapply\b|submit\s+(your\s+)?application|send\s+application/i;
const APPLY_HOOK = '[data-qa*="response"], [data-qa*="apply"], [data-test*="apply"], [data-testid*="apply"]';

function vacancyNear(el: Element, adapter: NonNullable<ReturnType<typeof adapterFor>>): string | null {
  let node: Element | null = el;
  let found: string | null = null;
  while (node && node !== document.body) {
    const ids = new Set<string>();
    for (const a of node.querySelectorAll('a[href]')) {
      try {
        const id = adapter.vacancyId(new URL(a.getAttribute('href')!, location.href));
        if (id) ids.add(id);
      } catch {
        /* malformed href */
      }
    }
    if (ids.size > 1) break; // climbed past the card into a list of vacancies
    if (ids.size === 1) found = [...ids][0];
    node = node.parentElement;
  }
  return found ?? adapter.vacancyId(new URL(location.href));
}

document.addEventListener(
  'click',
  (e) => {
    const adapter = adapterFor(new URL(location.href));
    const el = (e.target as Element | null)?.closest?.('button, a, [role="button"], input[type="submit"]');
    if (!adapter || !el) return;
    const label = (el.getAttribute('aria-label') || (el as HTMLInputElement).value || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!((label.length < 60 && APPLY_LABEL.test(label)) || el.matches(APPLY_HOOK))) return;
    const id = vacancyNear(el, adapter);
    // A later click (e.g. "Submit" inside the modal) with no vacancy context must not wipe the id found on the first one
    if (id) {
      pending = { id, at: Date.now() };
      void vacancyFor(adapter, id).then((vacancy) => storePending(adapter.platform, { id, at: Date.now(), vacancy }));
    }
  },
  true,
);
// A submit inside an apply dialog/form on a vacancy page arms the same pending state (Enter key, custom buttons)
document.addEventListener(
  'submit',
  (e) => {
    const adapter = adapterFor(new URL(location.href));
    const form = e.target as Element | null;
    if (!adapter || !form?.closest) return;
    const looksLikeApply = form.matches(APPLY_HOOK) || form.querySelector('input[type="file"]') || form.closest('[role="dialog"], [data-qa*="response"]');
    const id = looksLikeApply ? vacancyNear(form, adapter) : null;
    if (id) {
      pending = { id, at: Date.now() };
      void vacancyFor(adapter, id).then((vacancy) => storePending(adapter.platform, { id, at: Date.now(), vacancy }));
    }
  },
  true,
);

/**
 * Opening the response form already triggers apply-like requests on some boards, and the form can be closed unsent.
 * The application counts only when the vacancy shows the applied marker: read live on its own page, otherwise from
 * the vacancy page fetched again (retried, the site may need a moment to register the response).
 */
async function confirmedApplied(adapter: NonNullable<ReturnType<typeof adapterFor>>, id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 2000));
    if (adapter.vacancyId(new URL(location.href)) === id) {
      if (isApplied(document, adapter)) return true;
      continue;
    }
    try {
      const target = new URL(adapter.vacancyUrl(id));
      const res = await fetch(target.pathname + target.search, { credentials: 'include', cache: 'no-store' });
      if (res.ok && isApplied(new DOMParser().parseFromString(await res.text(), 'text/html'), adapter)) return true;
    } catch {
      /* offline or blocked: try again */
    }
  }
  return false;
}

window.addEventListener('heyreply:apply', async (e) => {
  const adapter = adapterFor(new URL(location.href));
  if (!adapter) return;
  let req: { url: string; body: string };
  try {
    req = JSON.parse((e as CustomEvent<string>).detail);
  } catch {
    return;
  }
  const id = `${req.url} ${req.body}`.match(VACANCY_IN_REQUEST)?.[1] ?? (pending && Date.now() - pending.at < PENDING_TTL_MS ? pending.id : null);
  if (!id) return;
  pending = null;
  clearPending(adapter.platform);
  if (adapter.confirmApply && !(await confirmedApplied(adapter, id))) return;
  const vacancy = await vacancyFor(adapter, id);
  if (vacancy) send([{ platform: adapter.platform, externalId: id, vacancyUrl: adapter.vacancyUrl(id), ...vacancy, origin: 'apply' }]);
});

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
// Back/forward cache restores and tab switches don't reload the script: re-check when the page comes back
window.addEventListener('pageshow', schedule);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule());

/** In-page confirmation (shadow DOM, so the board's CSS can't touch it and ours can't leak into the board). */
const RU = /^ru\b/i.test(navigator.language);
function toast(msg: { companyName: string; positionName: string; count: number }) {
  document.getElementById('heyreply-toast')?.remove();
  const host = document.createElement('div');
  host.id = 'heyreply-toast';
  const root = host.attachShadow({ mode: 'closed' });
  const more = msg.count > 1 ? (RU ? ` и ещё ${msg.count - 1}` : ` and ${msg.count - 1} more`) : '';
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  const title = document.createElement('b');
  title.textContent = RU ? 'Отклик сохранён в heyreply' : 'Application saved to heyreply';
  const text = document.createElement('span');
  text.textContent = `${msg.companyName} · ${msg.positionName}${more}`;
  box.append(title, text);
  const style = document.createElement('style');
  style.textContent = `div{position:fixed;right:20px;bottom:20px;z-index:2147483647;display:flex;flex-direction:column;gap:2px;max-width:320px;padding:12px 16px;border-radius:12px;background:#2a1633;color:#fff;font:13px/1.35 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28);border-left:4px solid #e0457b;animation:in .25s ease-out}b{font-weight:600}span{opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@keyframes in{from{opacity:0;transform:translateY(8px)}}@media(prefers-reduced-motion:reduce){div{animation:none}}`;
  root.append(style, box);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 5000);
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'toast') toast(msg);
});
