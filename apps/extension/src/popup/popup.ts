// Enums only: the package root would also pull in zod schemas the popup doesn't need
import { IMPORT_PLATFORMS, PLATFORM_INFO, platformSourceName, type ImportPlatform, type PlatformGroup } from '@heyreply/shared/dist/enums';
import type { AppStatus } from '@heyreply/shared';
import { apiUrl, getSettings, getState, saveSettings, type Settings } from '../settings';
import type { ManualItem, ManualResult } from '../types';
import { lang, t, type Key } from './i18n';
import { readVacancyFromPage } from './page-extract';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n as Key)));

function errorText(code: string | null) {
  if (!code) return '';
  if (code.startsWith('HTTP_') || code === 'NETWORK' || code === 'Failed to fetch') return t('e_NETWORK');
  const key = `e_${code}` as Key;
  return t(key) ?? code;
}

async function ping(s: Settings) {
  const res = await fetch(apiUrl(s, '/import/ping'), { headers: { Authorization: `Bearer ${s.token}` } });
  if (res.status === 401) throw new Error('BAD_TOKEN');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return (await res.json()) as { user: { name: string; email: string } };
}

/** The policy is served by the heyreply instance the extension talks to, in the user's language. */
const setPrivacyLink = (serverUrl: string) => {
  try {
    $<HTMLAnchorElement>('privacy').href = `${new URL(serverUrl).origin}/${lang}/privacy`;
  } catch {
    $<HTMLAnchorElement>('privacy').removeAttribute('href');
  }
};
$('server').addEventListener('input', () => setPrivacyLink(($('server') as HTMLInputElement).value.trim()));

async function render() {
  const settings = await getSettings();
  const state = await getState();
  const conn = $('conn');
  $('server').setAttribute('value', settings.serverUrl);
  ($('server') as HTMLInputElement).value = settings.serverUrl;
  setPrivacyLink(settings.serverUrl);

  if (!settings.token) {
    $('connect').hidden = false;
    $('main').hidden = true;
    conn.textContent = t('notConnected');
    conn.className = 'pill';
    return;
  }
  $('connect').hidden = true;
  $('main').hidden = false;
  $<HTMLAnchorElement>('open').href = settings.serverUrl;
  void prepareAdd();

  try {
    const { user } = await ping(settings);
    $('who').textContent = `${user.name} · ${user.email}`;
    conn.textContent = t('connected');
    conn.className = 'pill ok';
  } catch (e) {
    const code = e instanceof Error ? e.message : 'NETWORK';
    conn.textContent = code === 'BAD_TOKEN' ? t('notConnected') : t('offline');
    conn.className = 'pill bad';
    $('who').textContent = settings.serverUrl;
  }

  $('created').textContent = String(state.totals.created);
  $('updated').textContent = String(state.totals.updated);
  $('queued').textContent = String(state.queue.length);
  const fmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  $('syncInfo').textContent = `${t('lastSync')}: ${state.lastSyncAt ? fmt.format(state.lastSyncAt) : t('never')}`;
  const err = errorText(state.lastError?.startsWith('PARTIAL') ? null : state.lastError);
  $('syncError').hidden = !err;
  $('syncError').textContent = err;

  const list = $('recent');
  list.replaceChildren(
    ...state.recent.map((r) => {
      const li = document.createElement('li');
      const title = document.createElement('span');
      title.className = 't';
      title.textContent = `${r.companyName} · ${r.positionName}`;
      if (r.platform) title.title = `${platformSourceName(r.platform, lang)}: ${title.textContent}`;
      const res = document.createElement('span');
      res.className = `r ${r.result === 'error' ? 'error' : ''}`;
      res.textContent = t(`r_${r.result}` as Key) ?? r.result;
      li.append(title, res);
      return li;
    }),
  );
  $('recentEmpty').hidden = state.recent.length > 0;

  const box = $('platforms');
  const groups: PlatformGroup[] = ['ru', 'intl', 'ats'];
  box.replaceChildren(
    ...groups.flatMap((g) => [
      Object.assign(document.createElement('p'), { className: 'group', textContent: t(`g_${g}` as Key) }),
      ...IMPORT_PLATFORMS.filter((p) => PLATFORM_INFO[p].group === g).map((p: ImportPlatform) => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !settings.disabled.includes(p);
        cb.addEventListener('change', async () => {
          const s = await getSettings();
          s.disabled = cb.checked ? s.disabled.filter((x) => x !== p) : [...s.disabled, p];
          await saveSettings(s);
        });
        label.append(cb, platformSourceName(p, lang));
        return label;
      }),
    ]),
  );
}

$('save').addEventListener('click', async () => {
  const errEl = $('formError');
  errEl.hidden = true;
  let origin: string;
  const serverUrl = ($('server') as HTMLInputElement).value.trim().replace(/\/+$/, '');
  try {
    const u = new URL(serverUrl);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
    origin = u.origin;
  } catch {
    errEl.textContent = t('e_URL');
    errEl.hidden = false;
    return;
  }
  // The server is user-configurable, so host access is requested at runtime for exactly that origin
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false);
  if (!granted) {
    errEl.textContent = t('e_PERMISSION');
    errEl.hidden = false;
    return;
  }
  const next: Settings = { ...(await getSettings()), serverUrl: origin, token: ($('token') as HTMLInputElement).value.trim() };
  try {
    await ping(next);
  } catch (e) {
    errEl.textContent = errorText(e instanceof Error ? e.message : 'NETWORK');
    errEl.hidden = false;
    return;
  }
  await saveSettings(next);
  ($('token') as HTMLInputElement).value = '';
  chrome.runtime.sendMessage({ type: 'flush' }).catch(() => {});
  render();
});

$('disconnect').addEventListener('click', async () => {
  await saveSettings({ ...(await getSettings()), token: '' });
  render();
});

$('flush').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'flush' }).catch(() => {});
  render();
});

/* ---------------- Manual add ---------------- */

/** Statuses offered when adding by hand: an application usually gets added right after applying or at the first reply. */
const STATUSES: AppStatus[] = ['APPLIED', 'VIEWED', 'SCREENING', 'TEST_TASK', 'INTERVIEW', 'OFFER', 'REJECTED'];
$('fStatus').replaceChildren(...STATUSES.map((s) => Object.assign(document.createElement('option'), { value: s, textContent: t(`s_${s}` as Key) })));

let prefill: ManualItem | null = null;
let prepared = false;

/**
 * What the current tab shows. On a board the content script answers with the parsed vacancy and its board id; on any
 * other page the generic reader is injected (activeTab: only this tab, only because the user opened the popup).
 */
async function pageVacancy(): Promise<ManualItem | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return null;
  try {
    const v = (await chrome.tabs.sendMessage(tab.id, { type: 'extract' }, { frameId: 0 })) as ManualItem | null;
    if (v?.companyName && v.positionName) return v;
  } catch {
    /* no content script on this page */
  }
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readVacancyFromPage });
    if (res?.result) return res.result as ManualItem;
  } catch {
    /* browser pages, the web store, PDFs: nothing to read */
  }
  return tab.url && /^https?:/.test(tab.url) ? { companyName: '', positionName: '', vacancyUrl: tab.url } : null;
}

async function prepareAdd() {
  if (prepared) return;
  prepared = true;
  prefill = await pageVacancy();
  const found = !!(prefill?.companyName && prefill.positionName);
  $('pageBox').hidden = !found;
  if (found) $('pageVacancy').textContent = `${prefill!.companyName} · ${prefill!.positionName}`;
  $('addOpen').textContent = t(found ? 'addThis' : 'addManual');
}

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const input = (id: string) => $<HTMLInputElement>(id);

$('addOpen').addEventListener('click', () => {
  input('fCompany').value = prefill?.companyName ?? '';
  input('fPosition').value = prefill?.positionName ?? '';
  input('fUrl').value = prefill?.vacancyUrl ?? '';
  input('fLocation').value = prefill?.locationName ?? '';
  $<HTMLSelectElement>('fStatus').value = 'APPLIED';
  const today = localDay();
  input('fDate').max = today;
  input('fDate').value = prefill?.appliedAt ? localDay(new Date(prefill.appliedAt)) : today;
  $('addError').hidden = true;
  $('addResult').hidden = true;
  $('addHead').hidden = true;
  $('addForm').hidden = false;
  (input('fCompany').value ? input('fPosition').value ? $('addSave') : input('fPosition') : input('fCompany')).focus();
});

const closeForm = () => {
  $('addForm').hidden = true;
  $('addHead').hidden = false;
};
$('addCancel').addEventListener('click', closeForm);

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('addError');
  const fail = (key: Key) => {
    err.textContent = t(key) ?? key;
    err.hidden = false;
  };
  err.hidden = true;
  const companyName = input('fCompany').value.trim();
  const positionName = input('fPosition').value.trim();
  if (!companyName || !positionName) return fail('e_REQUIRED');
  const day = input('fDate').value;
  if (day && day > localDay()) return fail('e_FUTURE');
  const vacancyUrl = input('fUrl').value.trim() || null;
  if (vacancyUrl && !/^https?:\/\/\S+$/i.test(vacancyUrl)) return fail('e_URL');
  // The board id only belongs to the page it was read from: an edited link means another vacancy
  const samePage = !!prefill?.platform && vacancyUrl === prefill.vacancyUrl;
  const item: ManualItem = {
    ...(samePage ? prefill : {}),
    platform: samePage ? prefill!.platform : null,
    externalId: samePage ? prefill!.externalId : null,
    companyName,
    positionName,
    vacancyUrl,
    locationName: input('fLocation').value.trim() || null,
    status: $<HTMLSelectElement>('fStatus').value as AppStatus,
    // Today: let the server stamp the actual time; another day: its midday, so no time zone shifts it to a neighbour
    appliedAt: !day || day === localDay() ? null : new Date(`${day}T12:00:00`).toISOString(),
  };
  const save = $<HTMLButtonElement>('addSave');
  save.disabled = true;
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'manual', item })) as ManualResult;
    if ('error' in res) return fail(`e_${res.error}` as Key);
    closeForm();
    const result = $('addResult');
    result.textContent = t(`m_${res.outcome}` as Key);
    result.className = `result small${res.outcome === 'queued' ? ' bad' : ''}`;
    result.hidden = false;
    await render();
  } catch {
    fail('e_NETWORK');
  } finally {
    save.disabled = false;
  }
});

render();
