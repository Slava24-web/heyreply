import { describe, expect, it } from 'vitest';
import { ADAPTERS, adapterFor } from '../src/content/platforms';
import { extractVacancy, isApplied, readJobPosting } from '../src/content/extract';
import { parseList } from '../src/content/list';
import { statusFromText } from '../src/content/status';

const doc = (html: string) => new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, 'text/html');
const withHead = (head: string, body: string) => new DOMParser().parseFromString(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, 'text/html');
const byPlatform = (p: string) => ADAPTERS.find((a) => a.platform === p)!;

const jobPostingLd = (o: object) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'JobPosting', ...o })}</script>`;

describe('statusFromText', () => {
  it.each([
    ['Не просмотрен', 'APPLIED'],
    ['Просмотрен', 'VIEWED'],
    ['Приглашение', 'INTERVIEW'],
    ['Отказ', 'REJECTED'],
    ['Работодатель не готов пригласить вас', 'REJECTED'],
    ['Тестовое задание', 'TEST_TASK'],
    ['Application viewed', 'VIEWED'],
    ['Not selected by employer', 'REJECTED'],
    ['No longer under consideration', 'REJECTED'],
    ['Interviewing', 'INTERVIEW'],
    ['Applied 3 days ago', 'APPLIED'],
    ['', null],
    ['Москва, 2 дня назад', null],
  ])('%s → %s', (text, expected) => expect(statusFromText(text)).toBe(expected));
});

describe('vacancy ids', () => {
  const id = (href: string) => adapterFor(new URL(href))?.vacancyId(new URL(href));
  it('parses every platform', () => {
    expect(id('https://hh.ru/vacancy/134575860?from=search')).toBe('134575860');
    expect(id('https://spb.hh.ru/vacancy/123')).toBe('123');
    expect(id('https://www.linkedin.com/jobs/view/desenvolvedor-react-at-bairesdev-4472556445/')).toBe('4472556445');
    expect(id('https://www.linkedin.com/jobs/view/4472556445/')).toBe('4472556445');
    expect(id('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4400001234')).toBe('4400001234');
    expect(id('https://career.habr.com/vacancies/1000168750')).toBe('1000168750');
    expect(id('https://www.superjob.ru/vakansii/frontend-razrabotchik-52229075.html')).toBe('52229075');
    expect(id('https://getmatch.ru/vacancies/24512-frontend')).toBe('24512');
    expect(id('https://www.indeed.com/viewjob?jk=0a1b2c3d4e5f6789')).toBe('0a1b2c3d4e5f6789');
    expect(id('https://hh.ru/search/vacancy?text=react')).toBeNull();
    expect(adapterFor(new URL('https://evil-hh.ru/vacancy/1'))).toBeNull();
  });
});

describe('extractVacancy', () => {
  it('prefers platform selectors and fills the rest from JSON-LD', () => {
    const d = withHead(
      jobPostingLd({
        title: 'Frontend-разработчик',
        hiringOrganization: { '@type': 'Organization', name: 'Спортдата' },
        jobLocation: { '@type': 'Place', address: { addressLocality: 'Москва' } },
        jobLocationType: 'TELECOMMUTE',
        baseSalary: { currency: 'RUR', value: { minValue: 200000, maxValue: 260000 } },
      }),
      `<h1 data-qa="vacancy-title">Frontend-разработчик (React)</h1><a data-qa="vacancy-company-name">ООО Спортдата</a>`,
    );
    expect(extractVacancy(d, byPlatform('hh'))).toEqual({
      positionName: 'Frontend-разработчик (React)',
      companyName: 'Спортдата',
      locationName: 'Москва',
      workFormat: 'REMOTE',
      salaryFrom: 200000,
      salaryTo: 260000,
      currency: 'RUB',
    });
  });

  it('falls back to JSON-LD, then to og:title', () => {
    const ld = withHead(jobPostingLd({ title: 'Data Engineer', hiringOrganization: { name: 'ПИК' } }), '<div></div>');
    expect(extractVacancy(ld, byPlatform('superjob'))).toMatchObject({ positionName: 'Data Engineer', companyName: 'ПИК' });
    const og = withHead('<meta property="og:title" content="Senior React Engineer | Miro | LinkedIn">', '<div></div>');
    expect(extractVacancy(og, byPlatform('linkedin'))).toMatchObject({ positionName: 'Senior React Engineer', companyName: 'Miro' });
  });

  it('returns null without a company', () => {
    expect(extractVacancy(doc('<h1>Only title</h1>'), byPlatform('getmatch'))).toBeNull();
  });

  it('survives broken JSON-LD blocks', () => {
    const d = withHead('<script type="application/ld+json">{oops</script>' + jobPostingLd({ title: 'QA' }), '');
    expect(readJobPosting(d)?.title).toBe('QA');
  });
});

describe('isApplied', () => {
  const hh = byPlatform('hh');

  it('detects the applied state in the vacancy action area', () => {
    const d = doc(`<h1 data-qa="vacancy-title">Dev</h1><div data-qa="vacancy-response-link-view-topic">Вы откликнулись</div>`);
    expect(isApplied(d, hh)).toBe(true);
  });

  it('ignores "applied" badges of other vacancies on the page', () => {
    const d = doc(`
      <h1 data-qa="vacancy-title">Dev</h1><a data-qa="vacancy-response-link-top">Откликнуться</a>
      <section class="similar"><div class="card"><a href="/vacancy/2">Other</a><span>Вы откликнулись</span></div></section>`);
    expect(isApplied(d, hh)).toBe(false);
  });

  it('uses the block around the title when a board has no known action selectors', () => {
    const habr = byPlatform('habr');
    const applied = doc(`<div class="header"><h1>Dev</h1><button>Вы откликнулись</button></div><aside>${'x'.repeat(4000)}</aside>`);
    expect(isApplied(applied, habr)).toBe(true);
    const listOnly = doc(`<div class="header"><h1>Dev</h1><button>Откликнуться</button></div><aside>${'x'.repeat(4000)}<div>Вы откликнулись</div></aside>`);
    expect(isApplied(listOnly, habr)).toBe(false);
  });
});

describe('parseList', () => {
  it('reads an hh-like negotiations page structurally', () => {
    const d = doc(`
      <div class="list">
        <div class="item"><a href="/vacancy/111">Frontend Developer</a><div data-qa="negotiations-item-company">Яндекс</div><span data-qa="negotiations-item-state">Приглашение</span></div>
        <div class="item"><a href="/vacancy/222">React Developer</a><div data-qa="negotiations-item-company">Ozon</div><span data-qa="negotiations-item-state">Отказ</span></div>
        <div class="item"><a href="/vacancy/333">Team Lead</a><div data-qa="negotiations-item-company">Avito</div><span>Не просмотрен</span></div>
      </div>`);
    expect(parseList(d, byPlatform('hh'))).toEqual([
      expect.objectContaining({ externalId: '111', positionName: 'Frontend Developer', companyName: 'Яндекс', status: 'INTERVIEW', vacancyUrl: 'https://hh.ru/vacancy/111' }),
      expect.objectContaining({ externalId: '222', companyName: 'Ozon', status: 'REJECTED' }),
      expect.objectContaining({ externalId: '333', companyName: 'Avito', status: 'APPLIED' }),
    ]);
  });

  it('reads a LinkedIn-like applied jobs list', () => {
    const d = doc(`
      <ul>
        <li><div><a href="https://www.linkedin.com/jobs/view/4400000001/">Senior Frontend Engineer</a></div><div class="entity-result__primary-subtitle">Miro</div><div>Application viewed</div></li>
        <li><div><a href="https://www.linkedin.com/jobs/view/4400000002/">React Developer</a></div><div class="entity-result__primary-subtitle">Revolut</div><div>Applied 2w ago</div></li>
      </ul>`);
    const items = parseList(d, byPlatform('linkedin'));
    expect(items.map((i) => [i.externalId, i.companyName, i.status])).toEqual([
      ['4400000001', 'Miro', 'VIEWED'],
      ['4400000002', 'Revolut', 'APPLIED'],
    ]);
  });
});

describe('cleanCompanyName', async () => {
  const { cleanCompanyName } = await import('@heyreply/shared/dist/enums');
  it.each([
    ['ООО Спортдата', 'Спортдата'],
    ['ООО «Яндекс»', 'Яндекс'],
    ['ПАО Сбербанк', 'Сбербанк'],
    ['АО "Тинькофф Банк"', 'Тинькофф Банк'],
    ['Miro Inc.', 'Miro'],
    ['Revolut Ltd', 'Revolut'],
    ['JetBrains', 'JetBrains'],
    ['АО', 'АО'],
  ])('%s → %s', (input, out) => expect(cleanCompanyName(input)).toBe(out));
});
