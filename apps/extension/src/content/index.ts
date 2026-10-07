import type { Adapter, Observed, VacancyData } from '../types';
import { adapterFor } from './platforms';
import { appliedAtOnPage, extractVacancy, isApplied } from './extract';
import { parseList } from './list';
import { isApplyControl, leavesBoard } from './signals';
import { ask, toast, type AskReason } from './ui';

declare const __E2E__: boolean;

/**
 * How an application is noticed, strongest signal first:
 *  1. the vacancy page shows the board's "you applied" marker (also on a later visit, with the date if shown);
 *  2. after a click on an apply control the page turns into a confirmation screen ("…/thanks");
 *  3. a successful apply-like request (hook.ts) — recorded once the board confirms it, otherwise the user is asked;
 *  4. the apply control leads to the employer's site — the user is asked when they come back to the board;
 *  5. "my applications" pages: read when opened, and on hh also in the background a few times a day;
 *  6. anything else: the user adds it from the extension popup (the page is parsed for them).
 */
const SETTLE_MS = 800;
if (__E2E__) document.documentElement.dataset.heyreplyContent = '1';
const reported = new Set<string>();
/** Vacancies already recorded as applied from this page: no prompts for them. */
const appliedIds = new Set<string>();

/** sessionStorage survives reloads and same-tab navigation within the board, which several signals need. */
function stored<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function store(key: string, value: unknown) {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled on the page */
  }
}

/**
 * ATS confirmation pages ("…/thanks", "Application submitted") often drop the vacancy details,
 * so the details seen on the job page are remembered for the tab's session.
 */
const cacheKey = (platform: string, id: string) => `heyreply:v:${platform}:${id}`;
const remember = (platform: string, id: string, v: VacancyData) => store(cacheKey(platform, id), v);
const recall = (platform: string, id: string) => stored<VacancyData>(cacheKey(platform, id));

function send(items: Observed[]) {
  const fresh = items.filter((i) => {
    const key = `${i.platform}:${i.externalId}:${i.status ?? ''}:${i.origin}`;
    if (reported.has(key)) return false;
    reported.add(key);
    return true;
  });
  for (const i of fresh) if (i.origin === 'apply') appliedIds.add(i.externalId);
  if (fresh.length) chrome.runtime.sendMessage({ type: 'observed', items: fresh }).catch(() => {});
}

const applied = (adapter: Adapter, id: string, vacancy: VacancyData, appliedAt?: string | null): Observed => ({
  platform: adapter.platform,
  externalId: id,
  vacancyUrl: adapter.vacancyUrl(id),
  ...vacancy,
  ...(appliedAt ? { appliedAt } : {}),
  origin: 'apply',
});

/** Vacancies the user declined in a prompt ("No, I didn't apply"): not asked about again in this tab. */
const declinedKey = (platform: string) => `heyreply:declined:${platform}`;
async function confirmWithUser(adapter: Adapter, id: string, vacancy: VacancyData, reason: AskReason) {
  const declined = stored<string[]>(declinedKey(adapter.platform)) ?? [];
  if (appliedIds.has(id) || declined.includes(id)) return;
  if (await ask(reason, vacancy)) send([applied(adapter, id, vacancy)]);
  else store(declinedKey(adapter.platform), [...declined, id].slice(-50));
}

function scan() {
  const url = new URL(location.href);
  const adapter = adapterFor(url);
  if (!adapter) return;

  if (adapter.isListPage?.(url)) {
    const items = parseList(document, adapter);
    send(items.map((i) => ({ ...i, origin: 'sync' as const })));
    markListSynced(adapter);
    return;
  }
  if (checkPendingConfirmation(adapter)) return;
  void checkExternalReturn(adapter);

  const id = adapter.vacancyId(url);
  const isAppliedNow = isApplied(document, adapter);
  if (__E2E__) document.documentElement.dataset.heyreplyScan = `${adapter.platform}:${id}:${isAppliedNow}`;
  if (!id) return;
  const extracted = extractVacancy(document, adapter, url);
  if (extracted && !isAppliedNow) {
    remember(adapter.platform, id, extracted);
    return;
  }
  if (!isAppliedNow) return;
  // On a confirmation page prefer what was seen on the job page: it is richer and more reliable
  const vacancy = recall(adapter.platform, id) ?? extracted;
  if (!vacancy) return;
  send([applied(adapter, id, vacancy, appliedAtOnPage(document, adapter))]);
}

/**
 * Real-time capture: hook.ts (page world) reports every successful apply-like request. The vacancy is found in the
 * request itself, so this works for applications made from search results, popups and Easy Apply, on any page.
 */
const VACANCY_IN_REQUEST = /(?:vacancy[_-]?id|vacancyId|job[_-]?id|jobId|job_?posting|vacanc(?:y|ies)|jobs\/view|\bjk)\W{0,12}(?:urn:li:\w+:)?(\d{5,})/i;

async function fetchVacancyPage(adapter: Adapter, id: string): Promise<Document | null> {
  try {
    const target = new URL(adapter.vacancyUrl(id));
    // Same origin, the user's own session, no tab involved
    const res = await fetch(target.pathname + target.search, { credentials: 'include', cache: 'no-store' });
    return res.ok ? new DOMParser().parseFromString(await res.text(), 'text/html') : null;
  } catch {
    return null;
  }
}

async function vacancyFor(adapter: Adapter, id: string): Promise<VacancyData | null> {
  const here = new URL(location.href);
  const cached = recall(adapter.platform, id);
  if (cached) return cached;
  if (adapter.vacancyId(here) === id) {
    const v = extractVacancy(document, adapter, here);
    if (v) return v;
  }
  // Applied from a list: read the vacancy page itself
  const doc = await fetchVacancyPage(adapter, id);
  return doc ? extractVacancy(doc, adapter, new URL(adapter.vacancyUrl(id))) : null;
}

/**
 * A click on an apply control tells us WHICH vacancy the user is applying to (the card or page it sits in); the
 * click alone saves nothing — the application is recorded only when the site then confirms it.
 * Multi-step forms (Easy Apply, ATS questionnaires) can take a while, hence the generous window.
 */
const PENDING_TTL_MS = 15 * 60_000;
let pending: { id: string; at: number } | null = null;

/**
 * Classic (non-AJAX) flows: the form is submitted, the page reloads onto a confirmation screen. The vacancy seen at
 * click time is kept in sessionStorage so the confirmation screen can be matched to it; nothing is saved without
 * the confirmation actually appearing.
 */
const CONFIRM_URL = /thank|confirm|success|submitted|applied|complete|spasibo/i;
const CONFIRM_TEXT = /thank\s+you\s+for\s+appl|application\s+(has\s+been\s+|was\s+)?(received|submitted|sent)|successfully\s+(applied|submitted)|спасибо\s+за\s+отклик|ваш[ae]?\s+(отклик|заявка|резюме)\s+(отправлен|получен|принят|доставлен)|заявка\s+(получена|принята|отправлена)/i;
type StoredPending = { id: string; at: number; vacancy: VacancyData | null };
const pendingKey = (platform: string) => `heyreply:pending:${platform}`;
function readPending(platform: string): StoredPending | null {
  const p = stored<StoredPending>(pendingKey(platform));
  return p && Date.now() - p.at < PENDING_TTL_MS ? p : null;
}
const clearPending = (platform: string) => store(pendingKey(platform), null);

function checkPendingConfirmation(adapter: Adapter) {
  const p = readPending(adapter.platform);
  if (!p?.vacancy) return false;
  const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const confirmed = (CONFIRM_URL.test(location.pathname) && text.length < 6000) || (text.length < 3000 && CONFIRM_TEXT.test(text));
  if (!confirmed) return false;
  clearPending(adapter.platform);
  send([applied(adapter, p.id, p.vacancy)]);
  return true;
}

/**
 * "Apply on company site": the form is on the employer's site, out of the extension's sight. The vacancy is kept and,
 * when the user comes back to the board (tab shown again, or Back to this page), they are asked whether they applied.
 */
const EXTERNAL_MIN_MS = 8_000;
const EXTERNAL_TTL_MS = 2 * 3600_000;
const externalKey = (platform: string) => `heyreply:external:${platform}`;
async function checkExternalReturn(adapter: Adapter) {
  if (document.visibilityState !== 'visible') return;
  const p = stored<StoredPending>(externalKey(adapter.platform));
  if (!p) return;
  const age = Date.now() - p.at;
  if (age < EXTERNAL_MIN_MS) return; // still the same moment: the new tab hasn't even loaded
  store(externalKey(adapter.platform), null);
  if (age > EXTERNAL_TTL_MS || !p.vacancy) return;
  await confirmWithUser(adapter, p.id, p.vacancy, 'external');
}

function vacancyNear(el: Element, adapter: Adapter): string | null {
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

function arm(adapter: Adapter, id: string, external: boolean) {
  pending = { id, at: Date.now() };
  // Read the vacancy now, while its card/page is on screen: the confirmation screen may no longer show it
  void vacancyFor(adapter, id).then((vacancy) => {
    const p: StoredPending = { id, at: Date.now(), vacancy };
    store(external ? externalKey(adapter.platform) : pendingKey(adapter.platform), p);
  });
}

document.addEventListener(
  'click',
  (e) => {
    const here = new URL(location.href);
    const adapter = adapterFor(here);
    const el = (e.target as Element | null)?.closest?.('button, a, [role="button"], input[type="submit"]');
    if (!adapter || !el) return;
    const label = (el.getAttribute('aria-label') || (el as HTMLInputElement).value || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!isApplyControl(el, label)) return;
    const id = vacancyNear(el, adapter);
    // A later click (e.g. "Submit" inside the modal) with no vacancy context must not wipe the id found on the first one
    if (id) arm(adapter, id, leavesBoard(el, label, adapter, here));
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
    const looksLikeApply = form.matches('[data-qa*="response"], [data-qa*="apply"], [data-test*="apply"], [data-testid*="apply"]') || form.querySelector('input[type="file"]') || form.closest('[role="dialog"], [data-qa*="response"]');
    const id = looksLikeApply ? vacancyNear(form, adapter) : null;
    if (id) arm(adapter, id, false);
  },
  true,
);

/**
 * Opening the response form already triggers apply-like requests on some boards, and the form can be closed unsent.
 * The application counts once the vacancy shows the applied marker: read live on its own page, otherwise from
 * the vacancy page fetched again (retried, the site may need a moment to register the response).
 */
async function confirmedApplied(adapter: Adapter, id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 2000));
    if (appliedIds.has(id)) return true; // scan() saw the marker meanwhile
    if (adapter.vacancyId(new URL(location.href)) === id) {
      if (isApplied(document, adapter)) return true;
      continue;
    }
    const doc = await fetchVacancyPage(adapter, id);
    if (doc && isApplied(doc, adapter)) return true;
  }
  return false;
}

const inFlight = new Set<string>();
window.addEventListener('heyreply:apply', async (e) => {
  const adapter = adapterFor(new URL(location.href));
  if (!adapter) return;
  let req: { url: string; body: string };
  try {
    req = JSON.parse((e as CustomEvent<string>).detail);
  } catch {
    return;
  }
  const clicked = pending && Date.now() - pending.at < PENDING_TTL_MS ? pending.id : null;
  const id = `${req.url} ${req.body}`.match(VACANCY_IN_REQUEST)?.[1] ?? clicked;
  if (!id || inFlight.has(id) || appliedIds.has(id)) return;
  inFlight.add(id);
  try {
    if (await confirmedApplied(adapter, id)) {
      pending = null;
      clearPending(adapter.platform);
      const vacancy = await vacancyFor(adapter, id);
      if (vacancy) send([applied(adapter, id, vacancy)]);
      return;
    }
    // Not confirmed by the board. Boards that fire such requests on merely opening the form stay silent (the list
    // sync will catch a real application); elsewhere, if the user did click "apply" on this vacancy, ask them.
    if (adapter.confirmApply || clicked !== id) return;
    const vacancy = await vacancyFor(adapter, id);
    if (vacancy) await confirmWithUser(adapter, id, vacancy, 'unconfirmed');
  } finally {
    inFlight.delete(id);
  }
});

/**
 * Background read of "my applications" (adapter.listUrl): at most every few hours, only in the top frame, on the
 * board's own origin with the user's session. Opening that page by hand counts as a sync too.
 */
const LIST_SYNC_MS = 6 * 3600_000;
const listKey = (platform: string) => `listSync:${platform}`;
function markListSynced(adapter: Adapter) {
  chrome.storage.local.set({ [listKey(adapter.platform)]: Date.now() }).catch(() => {});
}
async function backgroundListSync() {
  const adapter = adapterFor(new URL(location.href));
  if (!adapter?.listUrl || window.top !== window || adapter.isListPage?.(new URL(location.href))) return;
  const key = listKey(adapter.platform);
  const last = (await chrome.storage.local.get(key))[key] as number | undefined;
  if (last && Date.now() - last < LIST_SYNC_MS) return;
  markListSynced(adapter);
  try {
    const res = await fetch(adapter.listUrl, { credentials: 'include' });
    // Signed out: the board redirects to its login page
    if (!res.ok || !adapter.isListPage?.(new URL(res.url))) return;
    const items = parseList(new DOMParser().parseFromString(await res.text(), 'text/html'), adapter);
    send(items.map((i) => ({ ...i, origin: 'sync' as const })));
  } catch {
    /* offline: next visit */
  }
}
setTimeout(() => void backgroundListSync(), 4000);

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

/** What the popup's "add manually" form is prefilled with: the vacancy on this page, if the adapter can read it. */
function currentVacancy() {
  const url = new URL(location.href);
  const adapter = adapterFor(url);
  const id = adapter?.vacancyId(url);
  if (!adapter || !id) return null;
  const vacancy = extractVacancy(document, adapter, url) ?? recall(adapter.platform, id);
  if (!vacancy) return null;
  return { platform: adapter.platform, externalId: id, vacancyUrl: adapter.vacancyUrl(id), ...vacancy, appliedAt: appliedAtOnPage(document, adapter) };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'toast') toast(msg);
  if (msg?.type === 'extract') reply(window.top === window ? currentVacancy() : null);
  return false;
});
