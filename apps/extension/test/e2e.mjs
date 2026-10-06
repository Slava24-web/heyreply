/**
 * Full pipeline in a real Chromium with the extension loaded:
 * job-board page → content script → service worker → heyreply API → database.
 * Board pages are served by route interception at their real URLs (no board accounts or network needed).
 * Requires the dev servers (web :3000, api :4000):  node test/e2e.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const WEB = 'http://localhost:3000';
const stamp = Date.now();
const email = `ext-e2e-${stamp}@heyreply.test`;
const password = 'testpass123';
const log = (...a) => console.log('  ·', ...a);
let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? '  ✓' : '  ✗', msg);
  if (!cond) failures++;
};

execSync('node build.mjs --e2e', { stdio: 'ignore' });
const ext = resolve('dist');

// --- account + token via the API (as the web app would)
let cookie = '';
const call = async (path, init = {}) => {
  const res = await fetch(`${WEB}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Origin: WEB, Cookie: cookie, ...(init.headers ?? {}) },
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, body: await res.json().catch(() => null) };
};
await call('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Ext E2E', email, password }) });
const { body: tok } = await call('/me/tokens', { method: 'POST', body: JSON.stringify({ name: 'e2e' }) });
log('user + token created');

const listApps = async (q) => (await call(`/applications?q=${encodeURIComponent(q)}`)).body;

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'heyreply-e2e-')), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
try {
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  await sw.evaluate(({ token }) => chrome.storage.local.set({ settings: { serverUrl: 'http://localhost:3000', token, disabled: [] } }), { token: tok.token });
  log('extension connected');

  const page = await ctx.newPage();
  const serve = (url, html) => page.route(url, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  const waitFor = async (fn, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const v = await fn();
      if (v) return v;
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  };

  // 1. hh.ru: vacancy page, user clicks "Откликнуться" → button turns into "Вы откликнулись"
  await serve('https://hh.ru/vacancy/990000001*', `<!doctype html><html><head><meta charset="utf-8">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Frontend-разработчик","hiringOrganization":{"@type":"Organization","name":"ООО Спортдата"},"jobLocation":{"@type":"Place","address":{"addressLocality":"Москва"}},"baseSalary":{"currency":"RUR","value":{"minValue":250000,"maxValue":300000}}}</script>
    </head><body><h1 data-qa="vacancy-title">Frontend-разработчик</h1><a data-qa="vacancy-company-name">ООО Спортдата</a>
    <div class="vacancy-actions"><button data-qa="vacancy-response-link-top" onclick="this.outerHTML='<div data-qa=&quot;vacancy-response-link-view-topic&quot;>Вы откликнулись</div>'">Откликнуться</button></div>
    <section><h2>Похожие вакансии</h2><div><a href="/vacancy/990000099">Другая вакансия</a><span>Вы откликнулись</span></div></section>
    </body></html>`);
  await page.goto('https://hh.ru/vacancy/990000001?from=search');
  await page.waitForTimeout(1500);
  check(!(await listApps('Спортдата')).total, 'hh: nothing imported before applying (similar-vacancies badge ignored)');
  await page.click('[data-qa="vacancy-response-link-top"]');
  const hh = await waitFor(async () => (await listApps('Спортдата')).items?.[0]);
  check(!!hh, 'hh: application imported after clicking "Откликнуться"');
  check(hh?.company.name === 'Спортдата' && hh?.position.name === 'Frontend-разработчик', `hh: company/position = ${hh?.company.name} / ${hh?.position.name}`);
  check(hh?.source?.name === 'HeadHunter' && hh?.externalSource === 'hh', 'hh: source HeadHunter, externalSource=hh');
  check(hh?.salaryFrom === 250000 && hh?.salaryTo === 300000 && hh?.currency === 'RUB', 'hh: salary 250–300k RUB from JSON-LD');
  check(hh?.location?.name === 'Москва', 'hh: location Москва');

  // 2. hh.ru "Мои отклики": status changed to invitation
  await serve('https://hh.ru/applicant/negotiations*', `<!doctype html><html><head><meta charset="utf-8"></head><body><main>
    <div class="row"><a href="https://hh.ru/vacancy/990000001">Frontend-разработчик</a><div data-qa="negotiations-item-company">ООО Спортдата</div><span data-qa="negotiations-item-state">Приглашение</span></div>
    <div class="row"><a href="https://hh.ru/vacancy/990000002">React Developer</a><div data-qa="negotiations-item-company">Ozon Tech</div><span data-qa="negotiations-item-state">Отказ</span></div>
    </main></body></html>`);
  await page.goto('https://hh.ru/applicant/negotiations');
  const updated = await waitFor(async () => {
    const a = (await listApps('Спортдата')).items?.[0];
    return a?.status === 'INTERVIEW' ? a : null;
  });
  check(!!updated, 'hh sync: status moved to INTERVIEW from "Мои отклики"');
  const ozon = await waitFor(async () => (await listApps('Ozon Tech')).items?.[0]);
  check(ozon?.status === 'REJECTED', 'hh sync: a mobile-app application appears with status REJECTED');
  const total = (await listApps('Спортдата')).total;
  check(total === 1, 'hh: no duplicates after sync');

  // 3. LinkedIn: Easy Apply confirmation modal
  await serve('https://www.linkedin.com/jobs/view/4400000777/*', `<!doctype html><html><head><meta charset="utf-8">
    <meta property="og:title" content="Senior Frontend Engineer | Miro | LinkedIn"></head><body>
    <div class="jobs-unified-top-card"><h1 class="job-details-jobs-unified-top-card__job-title">Senior Frontend Engineer</h1>
    <div class="job-details-jobs-unified-top-card__company-name"><a>Miro Inc.</a></div><button id="apply">Easy Apply</button></div>
    <script>document.getElementById('apply').onclick=()=>{const m=document.createElement('div');m.className='artdeco-modal';m.setAttribute('role','dialog');m.textContent='Your application was sent to Miro!';document.body.append(m)}</script>
    </body></html>`);
  await page.goto('https://www.linkedin.com/jobs/view/4400000777/');
  await page.click('#apply');
  const li = await waitFor(async () => (await listApps('Miro')).items?.[0]);
  check(li?.externalSource === 'linkedin' && li?.company.name === 'Miro', `linkedin: imported "${li?.company.name} · ${li?.position.name}"`);

  // 4. Lever (ATS): job page → apply form → /thanks page without vacancy details (uses what was seen on the job page)
  const leverId = 'acme/0b4f3c2a-1d2e-4f5a-8b9c-0d1e2f3a4b5c';
  await serve(`https://jobs.lever.co/${leverId}`, `<!doctype html><html><head><meta charset="utf-8"><title>Acme Robotics - Staff Frontend Engineer</title>
    <script type="application/ld+json">{"@type":"JobPosting","title":"Staff Frontend Engineer","hiringOrganization":{"name":"Acme Robotics"}}</script></head>
    <body><div class="posting-headline"><h2>Staff Frontend Engineer</h2></div><a href="/${leverId}/apply">Apply for this job</a></body></html>`);
  await serve(`https://jobs.lever.co/${leverId}/apply`, `<!doctype html><html><head><meta charset="utf-8"><title>Acme Robotics - Staff Frontend Engineer</title></head>
    <body><form action="/${leverId}/thanks"><button type="submit">Submit application</button></form></body></html>`);
  await serve(`https://jobs.lever.co/${leverId}/thanks*`, `<!doctype html><html><head><meta charset="utf-8"><title>Thanks</title></head>
    <body><div><h3>Application submitted!</h3><p>Thank you for applying.</p></div></body></html>`);
  await page.goto(`https://jobs.lever.co/${leverId}`);
  await page.waitForTimeout(1200);
  await page.click('a');
  await page.waitForTimeout(800);
  check(!(await listApps('Acme Robotics')).total, 'lever: nothing imported on the job page or the form');
  await page.click('button[type=submit]');
  const lever = await waitFor(async () => (await listApps('Acme Robotics')).items?.[0]);
  check(lever?.externalSource === 'lever' && lever?.position.name === 'Staff Frontend Engineer', `lever: imported from the /thanks page as "${lever?.company.name} · ${lever?.position.name}"`);

  // 5. Greenhouse form embedded as an iframe on a company's own careers site
  await serve('https://careers.contoso-example.com/jobs/4567*', `<!doctype html><html><head><meta charset="utf-8"><title>Careers — Contoso</title></head>
    <body><h1>Join Contoso</h1><iframe id="gh" src="https://job-boards.greenhouse.io/embed/job_app?for=contoso&token=4567" width="800" height="400"></iframe></body></html>`);
  await serve('https://job-boards.greenhouse.io/embed/job_app*', `<!doctype html><html><head><meta charset="utf-8"><title>Jobs at Contoso</title></head>
    <body><h1 class="app-title">Platform Engineer</h1><button id="submit" onclick="document.body.insertAdjacentHTML('beforeend','<div id=done><h2>Thank you for applying.</h2><p>Your application has been received.</p></div>')">Submit Application</button></body></html>`);
  await page.goto('https://careers.contoso-example.com/jobs/4567');
  const frame = await waitFor(async () => page.frames().find((f) => f.url().includes('greenhouse.io')));
  await page.waitForTimeout(1200);
  await frame.click('#submit');
  const gh = await waitFor(async () => (await listApps('Contoso')).items?.[0]);
  check(gh?.externalSource === 'greenhouse' && gh?.position.name === 'Platform Engineer', `greenhouse iframe: imported "${gh?.company.name} · ${gh?.position.name}"`);

  // 6. Работа.ру: schema.org microdata, verified-employer tooltip next to the company name
  await serve('https://www.rabota.ru/vacancy/54421622/*', `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div class="vacancy-card"><h1 itemprop="title" class="vacancy-card__title">Frontend-разработчик (React)</h1>
    <div itemprop="hiringOrganization"><div class="vacancy-company-stats__name"><span>Проверено Работой.ру</span><a itemprop="legalName" href="https://www.rabota.ru/company/romashka/">АО «Ромашка»</a></div></div>
    <button onclick="this.textContent='Вы откликнулись'">Откликнуться</button></div></body></html>`);
  await page.goto('https://www.rabota.ru/vacancy/54421622/');
  await page.waitForTimeout(1000);
  await page.click('button');
  const rr = await waitFor(async () => (await listApps('Ромашка')).items?.[0]);
  check(rr?.externalSource === 'rabotaru' && rr?.company.name === 'Ромашка' && rr?.source?.name === 'Работа.ру', `rabota.ru: imported "${rr?.company.name} · ${rr?.position.name}" (source ${rr?.source?.name})`);

  // 7. Server down → queued → delivered later
  const sw2 = ctx.serviceWorkers()[0];
  await sw2.evaluate(() => chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, serverUrl: 'http://localhost:3999' } })));
  await serve('https://career.habr.com/vacancies/1000999001*', `<!doctype html><html><head><meta charset="utf-8">
    <script type="application/ld+json">{"@type":"JobPosting","title":"Head of Frontend","hiringOrganization":{"name":"IT-hunter"}}</script></head>
    <body><div class="header"><h1 class="page-title__title">Head of Frontend</h1><div class="company_name"><a>IT-hunter</a></div><button>Вы откликнулись</button></div></body></html>`);
  await page.goto('https://career.habr.com/vacancies/1000999001');
  const queued = await waitFor(() => sw2.evaluate(() => chrome.storage.local.get('state').then(({ state }) => state?.queue?.length ?? 0)));
  check(queued === 1, 'offline: habr application kept in the queue');
  await sw2.evaluate(() => chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, serverUrl: 'http://localhost:3000' } })));
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${new URL(sw2.url()).host}/popup.html`);
  await popup.click('#flush');
  const habr = await waitFor(async () => (await listApps('IT-hunter')).items?.[0]);
  check(habr?.externalSource === 'habr', 'back online: queued habr application delivered');
  const popupText = await popup.locator('body').innerText();
  check(/Ext E2E/.test(popupText), 'popup: shows the connected account');

  // 8. Revoked token is rejected and the item stays queued
  await call(`/me/tokens/${tok.id}`, { method: 'DELETE' });
  await serve('https://getmatch.ru/vacancies/777001*', `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div><h1>Python Developer</h1><a href="/companies/42">Getmatch Corp</a><div>Вы откликнулись</div></div></body></html>`);
  await page.goto('https://getmatch.ru/vacancies/777001');
  const err = await waitFor(() => sw2.evaluate(() => chrome.storage.local.get('state').then(({ state }) => state?.lastError)));
  check(err === 'BAD_TOKEN', 'revoked token: server refuses, extension reports BAD_TOKEN');
  check(!(await listApps('Getmatch Corp')).total, 'revoked token: nothing imported');
} finally {
  await ctx.close();
  await call('/me', { method: 'DELETE', body: JSON.stringify({ password }) });
  log('test user deleted');
  execSync('node build.mjs', { stdio: 'ignore' }); // restore the normal build (no pre-granted localhost)
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
