import { afterEach, describe, expect, it } from 'vitest';
import { ADAPTERS } from '../src/content/platforms';
import { appliedAtOnPage, isApplied } from '../src/content/extract';
import { isApplyControl, isApplyRequest, leavesBoard } from '../src/content/signals';
import { readVacancyFromPage } from '../src/popup/page-extract';

const doc = (html: string) => new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, 'text/html');
const byPlatform = (p: string) => ADAPTERS.find((a) => a.platform === p)!;
const el = (html: string) => doc(html).body.firstElementChild!;

describe('apply requests (network signal)', () => {
  it.each([
    ['POST', 'https://hh.ru/applicant/vacancy_response/popup', '', true],
    ['POST', 'https://www.linkedin.com/voyager/api/graphql', '{"operationName":"submitJobApplication"}', true],
    ['POST', 'https://boards.greenhouse.io/acme/jobs/123/applications', '', true],
    ['GET', 'https://hh.ru/applicant/vacancy_response?vacancyId=1', '', false],
    // Analytics carry job ids and "apply" event names but never mean the application went through
    ['POST', 'https://www.linkedin.com/li/track', '{"eventName":"jobApplyClick","jobId":4400001234}', false],
    ['POST', 'https://hh.ru/analytics/apply_button_click', '', false],
    ['POST', 'https://mc.yandex.ru/watch/123?apply=1', '', false],
    ['POST', 'https://api.example.com/events?type=application_start', '', false],
    ['POST', 'https://o123.ingest.sentry.io/api/1/envelope/?application=web', '', false],
  ])('%s %s → %s', (method, url, body, expected) => expect(isApplyRequest(method, url, body)).toBe(expected));
});

describe('apply controls', () => {
  const hh = byPlatform('hh');
  const linkedin = byPlatform('linkedin');
  const here = (u: string) => new URL(u);

  it('recognises apply buttons, including long labels that name the job and the external site', () => {
    expect(isApplyControl(el('<button>Откликнуться</button>'), 'Откликнуться')).toBe(true);
    expect(isApplyControl(el('<button data-qa="vacancy-response-link-top">x</button>'), 'x')).toBe(true);
    const long = 'Apply to Senior Frontend Engineer (React, TypeScript) at Acme on company website';
    expect(isApplyControl(el(`<button aria-label="${long}">Apply</button>`), long)).toBe(true);
    // A long label without the external hint is a job card title, not a control
    const card = 'Applied Scientist, Machine Learning — Amazon Web Services, Seattle, WA, United States';
    expect(isApplyControl(el(`<a>${card}</a>`), card)).toBe(false);
  });

  it('knows when the application continues on the employer site', () => {
    const btn = (html: string, label: string, adapter = hh, url = 'https://hh.ru/vacancy/123') => leavesBoard(el(html), label, adapter, here(url));
    expect(btn('<button>Откликнуться</button>', 'Откликнуться')).toBe(false);
    expect(btn('<a href="/applicant/vacancy_response?vacancyId=123">Откликнуться</a>', 'Откликнуться')).toBe(false);
    expect(btn('<a href="https://spb.hh.ru/vacancy/123">Откликнуться</a>', 'Откликнуться')).toBe(false);
    expect(btn('<a href="https://careers.acme.com/jobs/1">Откликнуться</a>', 'Откликнуться')).toBe(true);
    expect(btn('<button>Откликнуться на сайте работодателя</button>', 'Откликнуться на сайте работодателя')).toBe(true);
    expect(btn('<button aria-label="Apply to Dev on company website">Apply</button>', 'Apply to Dev on company website', linkedin, 'https://www.linkedin.com/jobs/view/4400001234/')).toBe(true);
    expect(btn('<button>Easy Apply</button>', 'Easy Apply', linkedin, 'https://www.linkedin.com/jobs/view/4400001234/')).toBe(false);
  });
});

describe('applied date on a revisited vacancy', () => {
  const now = new Date(2026, 9, 7, 15);

  it('reads "Applied 3 weeks ago" from the LinkedIn top card', () => {
    const d = doc(`<div class="jobs-unified-top-card"><h1 class="jobs-unified-top-card__job-title">Frontend Engineer</h1><span>Applied 3 weeks ago</span></div>`);
    const linkedin = byPlatform('linkedin');
    expect(isApplied(d, linkedin)).toBe(true);
    expect(appliedAtOnPage(d, linkedin, now)?.slice(0, 10)).toBe(new Date(2026, 8, 16, 12).toISOString().slice(0, 10));
  });

  it('gives no date when the board shows none (the server then uses the moment of import)', () => {
    const d = doc(`<h1 data-qa="vacancy-title">Dev</h1><div data-qa="vacancy-response-block">Вы откликнулись</div>`);
    expect(isApplied(d, byPlatform('hh'))).toBe(true);
    expect(appliedAtOnPage(d, byPlatform('hh'), now)).toBeNull();
  });

  it('is null on a vacancy the user has not applied to', () => {
    expect(appliedAtOnPage(doc('<h1>Applied Scientist</h1><button>Apply</button>'), byPlatform('linkedin'), now)).toBeNull();
  });
});

describe('popup: reading a page without a board adapter', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.title = '';
  });

  it('prefers schema.org JobPosting', () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'Organization', name: 'x' }, { '@type': ['JobPosting'], title: 'QA Engineer', hiringOrganization: { name: 'Romashka' }, jobLocation: [{ address: { addressLocality: 'Kazan' } }] }],
    })}</script>`;
    document.body.innerHTML = '<h1>Careers at Romashka</h1>';
    expect(readVacancyFromPage()).toMatchObject({ positionName: 'QA Engineer', companyName: 'Romashka', locationName: 'Kazan' });
  });

  it('falls back to the heading and "<position> at <company>" titles', () => {
    document.title = 'Backend Developer at Acme | Careers';
    expect(readVacancyFromPage()).toMatchObject({ positionName: 'Backend Developer', companyName: 'Acme', locationName: null });
    document.body.innerHTML = '<h1> Senior   Go Developer </h1>';
    document.head.innerHTML = '<meta property="og:site_name" content="Acme Careers">';
    document.title = 'Senior Go Developer';
    expect(readVacancyFromPage()).toMatchObject({ positionName: 'Senior Go Developer', companyName: 'Acme Careers' });
  });

  it('runs on its own when injected (no references to the module scope)', () => {
    document.title = 'Designer — Studio';
    // chrome.scripting serializes the function source: rebuild it the same way
    const injected = new Function(`return (${readVacancyFromPage.toString()})()`) as typeof readVacancyFromPage;
    expect(injected()).toMatchObject({ positionName: 'Designer', companyName: 'Studio' });
  });
});
