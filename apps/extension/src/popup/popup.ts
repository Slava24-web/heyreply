// Enums only: the package root would also pull in zod schemas the popup doesn't need
import { IMPORT_PLATFORMS, PLATFORM_INFO, platformSourceName, type ImportPlatform, type PlatformGroup } from '@heyreply/shared/dist/enums';
import { apiUrl, getSettings, getState, saveSettings, type Settings } from '../settings';
import { lang, t, type Key } from './i18n';

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
      title.title = `${platformSourceName(r.platform, lang)}: ${title.textContent}`;
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

render();
