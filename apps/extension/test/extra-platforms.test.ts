import { describe, expect, it } from 'vitest';
import { IMPORT_PLATFORMS } from '@heyreply/shared/dist/enums';
import { ADAPTERS, adapterFor } from '../src/content/platforms';
import { extractVacancy, isApplied } from '../src/content/extract';

const doc = (body: string, head = '') => new DOMParser().parseFromString(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, 'text/html');
const by = (p: string) => ADAPTERS.find((a) => a.platform === p)!;
const idOf = (href: string) => {
  const u = new URL(href);
  const a = adapterFor(u);
  return a ? [a.platform, a.vacancyId(u)] : [null, null];
};

describe('every import platform has exactly one adapter', () => {
  it('covers all 26', () => {
    expect(ADAPTERS.map((a) => a.platform).sort()).toEqual([...IMPORT_PLATFORMS].sort());
  });
});

describe('vacancy ids for the 20 added platforms', () => {
  it.each([
    ['https://www.avito.ru/moskva/vakansii/frontend-razrabotchik_4012345678', 'avito', '4012345678'],
    ['https://m.avito.ru/sankt-peterburg/vakansii/kurer_3999999999?context=x', 'avito', '3999999999'],
    ['https://www.rabota.ru/vacancy/54421622/', 'rabotaru', '54421622'],
    ['https://spb.rabota.ru/vacancy/54421622/?from=x', 'rabotaru', '54421622'],
    ['https://zarplata.ru/vacancy/138123665', 'zarplata', '138123665'],
    ['https://ekb.zarplata.ru/vacancy/card/id138123665', 'zarplata', '138123665'],
    ['https://trudvsem.ru/vacancy/card/1027700132195/3f1a1b2c-1234-4abc-9def-0123456789ab', 'trudvsem', '1027700132195/3f1a1b2c-1234-4abc-9def-0123456789ab'],
    ['https://geekjob.ru/vacancy/65f1a2b3c4d5e6f7a8b9c0d1', 'geekjob', '65f1a2b3c4d5e6f7a8b9c0d1'],
    ['https://djinni.co/jobs/850116-full-stack-shopify-developer/', 'djinni', '850116'],
    ['https://www.work.ua/jobs/5412345/', 'workua', '5412345'],
    ['https://www.work.ua/ru/jobs/5412345/', 'workua', '5412345'],
    ['https://robota.ua/company3018524/vacancy10392291', 'robotaua', 'company3018524/vacancy10392291'],
    ['https://rabota.ua/ru/company3018524/vacancy10392291', 'robotaua', 'company3018524/vacancy10392291'],
    ['https://www.glassdoor.com/job-listing/frontend-engineer-acme-JV_IC1147401_KO0,17_KE18,22.htm?jl=1009412345678', 'glassdoor', '1009412345678'],
    ['https://www.glassdoor.de/Job/berlin-jobs?jobListingId=1009400000001', 'glassdoor', '1009400000001'],
    ['https://www.ziprecruiter.com/c/Acme/Job/Frontend-Engineer/-in-Austin,TX?jid=a1b2c3d4e5f6', 'ziprecruiter', 'a1b2c3d4e5f6'],
    ['https://www.monster.com/job-openings/frontend-engineer-austin-tx--0b4f3c2a-1d2e-4f5a-8b9c-0d1e2f3a4b5c', 'monster', '0b4f3c2a-1d2e-4f5a-8b9c-0d1e2f3a4b5c'],
    ['https://wellfound.com/jobs/4781700-backend-database-engineer-clone', 'wellfound', '4781700'],
    ['https://wellfound.com/company/acme/jobs/3001234-react-dev', 'wellfound', '3001234'],
    ['https://www.welcometothejungle.com/en/companies/doctolib/jobs/frontend-engineer_paris', 'wttj', 'doctolib/jobs/frontend-engineer_paris'],
    ['https://www.dice.com/job-detail/bb9837b2-c252-4bea-bd19-e8abf8755913', 'dice', 'bb9837b2-c252-4bea-bd19-e8abf8755913'],
    ['https://www.stepstone.de/stellenangebote--Frontend-Entwickler-Berlin-Acme--12345678-inline.html', 'stepstone', '12345678'],
    ['https://www.xing.com/jobs/koeln-frontend-developer-155713704', 'xing', '155713704'],
    ['https://job-boards.greenhouse.io/gitlab/jobs/8860302002', 'greenhouse', 'gitlab/jobs/8860302002'],
    ['https://boards.greenhouse.io/airbnb/jobs/8184174', 'greenhouse', 'airbnb/jobs/8184174'],
    ['https://job-boards.greenhouse.io/embed/job_app?for=gitlab&token=8860302002', 'greenhouse', 'gitlab/jobs/8860302002'],
    ['https://jobs.lever.co/spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1', 'lever', 'spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1'],
    ['https://jobs.lever.co/spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1/thanks', 'lever', 'spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1'],
    ['https://apply.workable.com/huggingface/j/F4C096B22E/', 'workable', 'huggingface/j/F4C096B22E'],
    ['https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245/application', 'ashby', 'ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245'],
  ])('%s', (href, platform, id) => expect(idOf(href)).toEqual([platform, id]));

  it('ignores search and listing pages', () => {
    expect(idOf('https://www.avito.ru/moskva/vakansii?q=react')[1]).toBeNull();
    expect(idOf('https://djinni.co/jobs/?primary_keyword=React')[1]).toBeNull();
    expect(idOf('https://jobs.lever.co/spotify')[1]).toBeNull();
    expect(idOf('https://boards.greenhouse.io/airbnb')[1]).toBeNull();
  });
});

describe('board-specific extraction', () => {
  it('rabota.ru via microdata (live markup shape)', () => {
    const d = doc(`<div class="vacancy-card__title-header"><h1 itemprop="title" class="vacancy-card__title"> Frontend-разработчик (React) </h1></div>
      <div itemprop="hiringOrganization" class="vacancy-company-stats"><div class="vacancy-company-stats__name"><div class="verified-employer"><p>Проверено Работой.ру</p></div>
      <a href="https://www.rabota.ru/company/romashka/" itemprop="legalName"> ООО «Ромашка» </a><meta itemprop="name" content="ООО «Ромашка»"></div></div>`);
    expect(extractVacancy(d, by('rabotaru'))).toMatchObject({ positionName: 'Frontend-разработчик (React)', companyName: 'Ромашка' });
  });

  it('Greenhouse hosted board and embedded form', () => {
    const hosted = doc('<div>Apply</div>', '<title>Job Application for Account Executive - France at GitLab</title>');
    expect(extractVacancy(hosted, by('greenhouse'))).toMatchObject({ positionName: 'Account Executive - France', companyName: 'GitLab' });
    const embed = doc('<h1 class="app-title">Senior Backend Engineer</h1>', '<title>Jobs at GitLab</title>');
    expect(extractVacancy(embed, by('greenhouse'), new URL('https://job-boards.greenhouse.io/embed/job_app?for=gitlab&token=1'))).toMatchObject({
      positionName: 'Senior Backend Engineer',
      companyName: 'GitLab',
    });
  });

  it('Lever and Ashby document titles, Workable company from the URL', () => {
    expect(extractVacancy(doc('<div></div>', '<title>Spotify - Android Engineer - Experience</title>'), by('lever'))).toMatchObject({ companyName: 'Spotify', positionName: 'Android Engineer - Experience' });
    expect(extractVacancy(doc('<div></div>', '<title>Security Engineer, Cloud @ Ramp</title>'), by('ashby'))).toMatchObject({ companyName: 'Ramp', positionName: 'Security Engineer, Cloud' });
    expect(extractVacancy(doc('<h1>ML Engineer</h1>'), by('workable'), new URL('https://apply.workable.com/hugging-face/j/F4C096B22E/'))).toMatchObject({ companyName: 'Hugging Face', positionName: 'ML Engineer' });
  });

  it('Djinni and Wellfound titles', () => {
    expect(extractVacancy(doc('<div></div>', '<title>Full Stack Shopify Developer at Olive – Djinni</title>'), by('djinni'))).toMatchObject({ positionName: 'Full Stack Shopify Developer', companyName: 'Olive' });
    expect(extractVacancy(doc('<div></div>', '<title>Frontend Engineer at REcollab • Chattanooga • Remote</title>'), by('wellfound'))).toMatchObject({ positionName: 'Frontend Engineer', companyName: 'REcollab' });
  });
});

describe('applied detection on the new boards', () => {
  it('ATS confirmation messages', () => {
    for (const [p, text] of [
      ['greenhouse', 'Thank you for applying! Your application has been received.'],
      ['lever', 'Application submitted!'],
      ['workable', 'Thanks for applying'],
      ['ashby', 'Your application was successfully submitted.'],
    ]) expect(isApplied(doc(`<div><h1>Engineer</h1><p>${text}</p></div>`), by(p)), p).toBe(true);
    expect(isApplied(doc('<div><h1>Engineer</h1><button>Submit application</button></div>'), by('lever'))).toBe(false);
  });

  it('localized badges: Ukrainian, German, French', () => {
    expect(isApplied(doc('<div><h1>Frontend</h1><span>Ви відгукнулися</span></div>'), by('workua'))).toBe(true);
    expect(isApplied(doc('<div><h1>Frontend</h1><span>Bereits beworben</span></div>'), by('stepstone'))).toBe(true);
    expect(isApplied(doc('<div><h1>Frontend</h1><span>Candidature envoyée</span></div>'), by('wttj'))).toBe(true);
  });

  it('does not mistake "Applied Scientist" in the title for an "Applied" badge', () => {
    expect(isApplied(doc('<div><h1>Applied Scientist, Search</h1><button>Apply now</button></div>'), by('glassdoor'))).toBe(false);
    expect(isApplied(doc('<div><h1>Senior Engineer, Applied ML</h1><button>Easy Apply</button></div>'), by('dice'))).toBe(false);
    expect(isApplied(doc('<div><h1>Applied Scientist</h1><span>Applied</span></div>'), by('glassdoor'))).toBe(true);
  });
});
