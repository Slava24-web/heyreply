/**
 * Checks the parsers against real public vacancy pages. Network-dependent, so opt-in: `LIVE=1 pnpm test`.
 * Signed-out pages only: they verify extraction and that an un-applied vacancy is not reported.
 */
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { adapterFor } from '../src/content/platforms';
import { extractVacancy, isApplied } from '../src/content/extract';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const fetchHtml = async (url: string) => (await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en' } })).text();
const firstMatch = async (listUrl: string, re: RegExp, base: string) => {
  const m = (await fetchHtml(listUrl)).match(re);
  return m ? new URL(m[0], base).href : null;
};

describe.skipIf(!process.env.LIVE)('live vacancy pages', () => {
  const cases: [string, () => Promise<string | null>][] = [
    ['hh.ru', () => firstMatch('https://hh.ru/search/vacancy?text=frontend', /https:\/\/hh\.ru\/vacancy\/\d+/, 'https://hh.ru')],
    ['Habr Career', () => firstMatch('https://career.habr.com/vacancies?q=frontend&type=all', /\/vacancies\/\d{6,}/, 'https://career.habr.com')],
    ['SuperJob', () => firstMatch('https://www.superjob.ru/vacancy/search/?keywords=frontend', /\/vakansii\/[a-z0-9-]+-\d+\.html/, 'https://www.superjob.ru')],
    ['LinkedIn (guest)', () => firstMatch('https://www.linkedin.com/jobs/search?keywords=frontend&location=Worldwide', /https:\/\/[a-z]+\.linkedin\.com\/jobs\/view\/[a-z0-9%-]+-\d{6,}/, 'https://www.linkedin.com')],
    ['Rabota.ru', () => firstMatch('https://www.rabota.ru/vacancy/?query=frontend', /\/vacancy\/\d+\//, 'https://www.rabota.ru')],
    ['Zarplata.ru', () => firstMatch('https://www.zarplata.ru/vacancy?q=frontend', /\/vacancy\/(?:card\/id)?\d+/, 'https://zarplata.ru')],
    ['Djinni', () => firstMatch('https://djinni.co/jobs/?primary_keyword=JavaScript', /\/jobs\/\d+-[a-z0-9-]+\//, 'https://djinni.co')],
    ['Wellfound', () => firstMatch('https://wellfound.com/role/frontend-engineer', /\/jobs\/\d+-[a-z0-9-]+/, 'https://wellfound.com')],
    ['Dice', () => firstMatch('https://www.dice.com/jobs?q=frontend', /\/job-detail\/[0-9a-f-]{36}/, 'https://www.dice.com')],
    ['XING', () => firstMatch('https://www.xing.com/jobs/search?keywords=frontend', /\/jobs\/[a-z0-9-]+-\d{6,}/, 'https://www.xing.com')],
    ['Greenhouse', async () => (await (await fetch('https://boards-api.greenhouse.io/v1/boards/gitlab/jobs')).json()).jobs?.[0]?.absolute_url ?? null],
    ['Lever', async () => (await (await fetch('https://api.lever.co/v0/postings/spotify?mode=json&limit=1')).json())[0]?.hostedUrl ?? null],
    ['Ashby', async () => (await (await fetch('https://api.ashbyhq.com/posting-api/job-board/ramp')).json()).jobs?.[0]?.jobUrl ?? null],
  ];

  for (const [name, find] of cases) {
    it(name, async () => {
      const href = await find();
      expect(href, 'found a vacancy link on the search page').toBeTruthy();
      const url = new URL(href!);
      const adapter = adapterFor(url)!;
      const html = await fetchHtml(href!);
      const { document } = new JSDOM(html, { url: href! }).window;
      const v = extractVacancy(document, adapter, url);
      console.log(`${name}: id=${adapter.vacancyId(url)} →`, v);
      expect(adapter.vacancyId(url)).toBeTruthy();
      expect(v?.positionName).toBeTruthy();
      expect(v?.companyName).toBeTruthy();
      expect(isApplied(document, adapter)).toBe(false);
    }, 30_000);
  }
});
