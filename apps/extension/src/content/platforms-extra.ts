import type { Adapter } from '../types';

/**
 * The 20 boards and ATS added after the original six. Verified against live public pages where the site
 * allows non-browser requests (see test/live.test.ts); Avito, Работа России, Work.ua, Robota.ua, Glassdoor,
 * ZipRecruiter, StepStone, Monster and Welcome to the Jungle block such requests, so their selectors follow
 * the sites' public URL schemes and schema.org data and are covered by synthetic tests only.
 */
const param = (url: URL, ...names: string[]) => names.map((n) => url.searchParams.get(n)).find((v) => v && /^[\w-]+$/.test(v)) ?? null;

/** Shared wording of "you have applied" across Russian, Ukrainian, German, French and English boards. */
const RU = /вы\s+(уже\s+)?откликнулись|отклик\s+(отправлен|направлен)|резюме\s+(отправлено|доставлено|направлено)|заявка\s+отправлена/i;
const UA = /ви\s+(вже\s+)?відгукнулися|відгук\s+(надіслано|відправлено)|резюме\s+надіслано/i;
const EN_BADGE = /\b(?:already\s+)?applied\b(?!\s+(?:scien|math|ml|ai|research|data|physic|machine|econom|linguist|psycholog))|you(?:'ve|\s+have)?\s+applied|application\s+(?:was\s+|has\s+been\s+)?(?:sent|submitted|received|complete)/i;
const ATS_DONE = /thank\s*s?\s+(?:you\s+)?for\s+(?:applying|your\s+application)|application\s+(?:was\s+|has\s+been\s+)?(?:successfully\s+)?(?:submitted|received)|successfully\s+(?:applied|submitted)/i;
const DE = /bewerbung\s+(?:wurde\s+)?(?:gesendet|versendet|abgeschickt|übermittelt)|(?:sie\s+haben\s+sich\s+)?beworben/i;
const FR = /candidature\s+(?:envoyée|transmise)|vous\s+avez\s+postulé/i;
const any = (...res: RegExp[]) => new RegExp(res.map((r) => `(?:${r.source})`).join('|'), 'i');
/** "<position> at <company> …" style document titles */
const positionAtCompany = (re: RegExp) => (t: string) => {
  const m = t.match(re);
  return m ? { position: m[1], company: m[2] } : null;
};

export const EXTRA_ADAPTERS: Adapter[] = [
  /* ---------------- Russia & CIS ---------------- */
  {
    platform: 'avito',
    hosts: /(^|\.)avito\.ru$/,
    vacancyId: (u) => u.pathname.match(/\/vakansii\/[^/]*?_(\d{6,})/)?.[1] ?? null,
    vacancyUrl: (id) => `https://www.avito.ru/${id}`,
    titleSelectors: ['[data-marker="item-view/title-info"]', 'h1[itemprop="name"]'],
    companySelectors: ['[data-marker="seller-info/name"]', '[data-marker="seller-link/link"]'],
    appliedMarker: RU,
  },
  {
    platform: 'rabotaru',
    hosts: /(^|\.)rabota\.ru$/,
    vacancyId: (u) => u.pathname.match(/^\/vacancy\/(\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://www.rabota.ru/vacancy/${id}/`,
    // verified on a live page: <h1 itemprop="title">, company in <a itemprop="legalName"> (the block also holds a hidden "verified" tooltip)
    titleSelectors: ['h1.vacancy-card__title', 'h1[itemprop="title"]'],
    companySelectors: ['.vacancy-company-stats__name [itemprop="legalName"]', '.vacancy-company-stats__name a[href*="/company/"]'],
    appliedMarker: RU,
  },
  {
    platform: 'zarplata',
    hosts: /(^|\.)zarplata\.ru$/,
    vacancyId: (u) => u.pathname.match(/^\/vacancy\/(?:card\/id)?(\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://zarplata.ru/vacancy/${id}`,
    // Zarplata.ru runs on the hh.ru platform (same data-qa hooks)
    titleSelectors: ['[data-qa="vacancy-title"]'],
    companySelectors: ['[data-qa="vacancy-company-name"]'],
    appliedMarker: RU,
    appliedScope: ['[data-qa*="vacancy-response"]'],
  },
  {
    platform: 'trudvsem',
    hosts: /(^|\.)trudvsem\.ru$/,
    vacancyId: (u) => u.pathname.match(/^\/vacancy\/card\/(\d+\/[0-9a-f-]{36})/)?.[1] ?? null,
    vacancyUrl: (id) => `https://trudvsem.ru/vacancy/card/${id}`,
    titleSelectors: ['.content__section-title h1', 'h1'],
    companySelectors: ['.content__company-name a', '[class*="company-name"]', 'a[href*="/company/"]'],
    appliedMarker: RU,
  },
  {
    platform: 'geekjob',
    hosts: /(^|\.)geekjob\.ru$/,
    vacancyId: (u) => u.pathname.match(/^\/vacancy\/([0-9a-z]{6,})/i)?.[1] ?? null,
    vacancyUrl: (id) => `https://geekjob.ru/vacancy/${id}`,
    titleSelectors: ['h1'],
    companySelectors: ['.company-name a', 'h5.company-name', 'a[href^="/company/"]'],
    appliedMarker: RU,
  },
  {
    platform: 'djinni',
    hosts: /(^|\.)djinni\.co$/,
    vacancyId: (u) => u.pathname.match(/^\/jobs\/(\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://djinni.co/jobs/${id}/`,
    titleSelectors: ['h1'],
    companySelectors: ['.job-details--title', 'a[href^="/jobs/?company="]'],
    // verified on a live page: "Full Stack Shopify Developer at Olive – Djinni"
    docTitle: positionAtCompany(/^(.+?)\s+at\s+(.+?)\s+[–-]\s+Djinni$/i),
    appliedMarker: any(EN_BADGE, UA, RU),
  },
  {
    platform: 'workua',
    hosts: /(^|\.)work\.ua$/,
    vacancyId: (u) => u.pathname.match(/^\/(?:[a-z]{2}\/)?jobs\/(\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://www.work.ua/jobs/${id}/`,
    titleSelectors: ['h1#h1-name', 'h1'],
    companySelectors: ['a[href^="/jobs/by-company/"]', 'a[href*="/company/"] span', 'a[href*="/company/"]'],
    appliedMarker: any(UA, RU, EN_BADGE),
  },
  {
    platform: 'robotaua',
    hosts: /(^|\.)(robota|rabota)\.ua$/,
    vacancyId: (u) => u.pathname.match(/\/(company\d+\/vacancy\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://robota.ua/${id}`,
    titleSelectors: ['h1'],
    companySelectors: ['a[href*="/company"] [class*="name"]', 'a[href^="/company"]'],
    appliedMarker: any(UA, RU),
  },

  /* ---------------- International ---------------- */
  {
    platform: 'glassdoor',
    hosts: /(^|\.)glassdoor\.[a-z.]+$/,
    vacancyId: (u) => param(u, 'jl', 'jobListingId'),
    vacancyUrl: (id) => `https://www.glassdoor.com/job-listing/?jl=${id}`,
    titleSelectors: ['[data-test="job-title"]', '[id^="jd-job-title"]', 'h1'],
    companySelectors: ['[data-test="employer-name"]', '[class*="EmployerProfile"] h4', '[data-test="employerName"]'],
    appliedMarker: EN_BADGE,
  },
  {
    platform: 'ziprecruiter',
    hosts: /(^|\.)ziprecruiter\.[a-z.]+$/,
    vacancyId: (u) => param(u, 'jid', 'lvk'),
    vacancyUrl: (id) => `https://www.ziprecruiter.com/jobs/job?jid=${id}`,
    titleSelectors: ['h1.job_title', '[data-testid="job-title"]', 'h1'],
    companySelectors: ['a.hiring_company_text', '[data-testid="job-company"]', '.hiring_company'],
    appliedMarker: EN_BADGE,
  },
  {
    platform: 'monster',
    hosts: /(^|\.)monster\.[a-z.]+$/,
    vacancyId: (u) => u.pathname.match(/\/job-openings\/[^/]*?--([0-9a-f-]{36})/)?.[1] ?? param(u, 'id', 'jobid'),
    vacancyUrl: (id) => `https://www.monster.com/job-openings/--${id}`,
    titleSelectors: ['[data-testid="jobTitle"]', 'h1'],
    companySelectors: ['[data-testid="company"]', '[data-testid="svx-job-header-company"]'],
    appliedMarker: EN_BADGE,
  },
  {
    platform: 'wellfound',
    hosts: /(^|\.)(wellfound\.com|angel\.co)$/,
    vacancyId: (u) => u.pathname.match(/\/jobs\/(\d+)/)?.[1] ?? param(u, 'job_listing_id'),
    vacancyUrl: (id) => `https://wellfound.com/jobs/${id}`,
    titleSelectors: ['h1'],
    companySelectors: ['a[href^="/company/"] h2', 'a[href^="/company/"]'],
    // verified on a live page: "FRONTEND ENGINEER at REcollab • Chattanooga • Remote"
    docTitle: positionAtCompany(/^(.+?)\s+at\s+(.+?)\s+•/),
    appliedMarker: EN_BADGE,
  },
  {
    platform: 'wttj',
    hosts: /(^|\.)(welcometothejungle\.com|otta\.com)$/,
    vacancyId: (u) => u.pathname.match(/\/companies\/([a-z0-9-]+\/jobs\/[a-z0-9_-]+)/)?.[1] ?? u.pathname.match(/^\/jobs\/([\w-]+)/)?.[1] ?? null,
    vacancyUrl: (id) => (id.includes('/') ? `https://www.welcometothejungle.com/en/companies/${id}` : `https://app.welcometothejungle.com/jobs/${id}`),
    titleSelectors: ['[data-testid="job-metadata-block"] h2', 'h1', 'h2'],
    companySelectors: ['[data-testid="job-metadata-block"] a[href*="/companies/"]', 'a[href*="/companies/"] span'],
    companyFromUrl: (u) => u.pathname.match(/\/companies\/([a-z0-9-]+)\//)?.[1] ?? null,
    appliedMarker: any(EN_BADGE, FR),
  },
  {
    platform: 'dice',
    hosts: /(^|\.)dice\.com$/,
    vacancyId: (u) => u.pathname.match(/^\/job-detail\/([0-9a-f-]{36})/)?.[1] ?? null,
    vacancyUrl: (id) => `https://www.dice.com/job-detail/${id}`,
    titleSelectors: ['h1[data-cy="jobTitle"]', 'h1'],
    companySelectors: ['[data-cy="companyNameLink"]', 'a[href*="/company-profile/"]'],
    appliedMarker: EN_BADGE,
  },
  {
    platform: 'stepstone',
    hosts: /(^|\.)stepstone\.(de|at|nl|be)$/,
    vacancyId: (u) => u.pathname.match(/--(\d+)-inline\.html/)?.[1] ?? null,
    vacancyUrl: (id) => `https://www.stepstone.de/stellenangebote--x--${id}-inline.html`,
    titleSelectors: ['[data-at="header-job-title"]', 'h1'],
    companySelectors: ['[data-at="header-company-name"]', '[data-at="metadata-company-name"]'],
    appliedMarker: any(DE, EN_BADGE),
  },
  {
    platform: 'xing',
    hosts: /(^|\.)xing\.com$/,
    vacancyId: (u) => u.pathname.match(/^\/jobs\/[a-z0-9-]*?-(\d{6,})/)?.[1] ?? null,
    vacancyUrl: (id) => `https://www.xing.com/jobs/-${id}`,
    titleSelectors: ['h1[data-testid="job-details-title"]', 'h1'],
    companySelectors: ['[data-testid="job-details-company-info-name"]', 'a[href*="/pages/"] p'],
    appliedMarker: any(DE, EN_BADGE),
  },

  /* ---------------- ATS (where "Apply on company website" leads) ---------------- */
  {
    platform: 'greenhouse',
    hosts: /(^|\.)greenhouse\.io$/,
    vacancyId: (u) => {
      const path = u.pathname.match(/^\/([a-z0-9_-]+\/jobs\/\d+)/i)?.[1];
      if (path) return path;
      // embedded application form on a company site: /embed/job_app?for=<board>&token=<job id>
      const board = param(u, 'for');
      const job = param(u, 'token');
      return u.pathname.startsWith('/embed/') && board && job && /^\d+$/.test(job) ? `${board}/jobs/${job}` : null;
    },
    vacancyUrl: (id) => `https://job-boards.greenhouse.io/${id}`,
    titleSelectors: ['.job__title h1', '.app-title', 'h1.section-header'],
    companySelectors: ['.company-name'],
    // verified on a live hosted board: "Job Application for Account Executive - France at GitLab"
    docTitle: (t) => {
      const m = t.match(/^Job Application for (.+) at (.+)$/i);
      if (m) return { position: m[1], company: m[2] };
      const embed = t.match(/^Jobs at (.+)$/i);
      return embed ? { company: embed[1] } : null;
    },
    companyFromUrl: (u) => u.pathname.match(/^\/([a-z0-9_-]+)\/jobs\//i)?.[1] ?? u.searchParams.get('for'),
    appliedMarker: ATS_DONE,
  },
  {
    platform: 'lever',
    hosts: /(^|\.)lever\.co$/,
    // /<company>/<uuid>, /<company>/<uuid>/apply and the post-submit /<company>/<uuid>/thanks
    vacancyId: (u) => u.pathname.match(/^\/([a-z0-9_.-]+\/[0-9a-f-]{36})/i)?.[1] ?? null,
    vacancyUrl: (id) => `https://jobs.lever.co/${id}`,
    titleSelectors: ['.posting-headline h2', '.posting-header h2'],
    companySelectors: [],
    // verified on a live page: "Spotify - Android Engineer - Experience" (company first)
    docTitle: (t) => {
      const i = t.indexOf(' - ');
      return i > 0 ? { company: t.slice(0, i), position: t.slice(i + 3) } : null;
    },
    companyFromUrl: (u) => u.pathname.split('/')[1] ?? null,
    appliedMarker: ATS_DONE,
  },
  {
    platform: 'workable',
    hosts: /^apply\.workable\.com$/,
    vacancyId: (u) => u.pathname.match(/^\/([a-z0-9_-]+\/j\/[A-Z0-9]{6,})/i)?.[1] ?? null,
    vacancyUrl: (id) => `https://apply.workable.com/${id}/`,
    titleSelectors: ['[data-ui="job-title"]', 'h1'],
    companySelectors: ['[data-ui="company-name"]', 'header [data-ui="logo"] img[alt]'],
    companyFromUrl: (u) => u.pathname.split('/')[1] ?? null,
    appliedMarker: ATS_DONE,
  },
  {
    platform: 'ashby',
    hosts: /^jobs\.ashbyhq\.com$/,
    vacancyId: (u) => u.pathname.match(/^\/([a-z0-9_.%-]+\/[0-9a-f-]{36})/i)?.[1] ?? null,
    vacancyUrl: (id) => `https://jobs.ashbyhq.com/${id}`,
    titleSelectors: ['[class*="_title_"] h1', 'h1'],
    companySelectors: [],
    // verified on a live page: "Security Engineer, Cloud @ Ramp"
    docTitle: (t) => {
      const m = t.match(/^(.+?)\s+@\s+(.+)$/);
      return m ? { position: m[1], company: m[2] } : null;
    },
    companyFromUrl: (u) => u.pathname.split('/')[1] ?? null,
    appliedMarker: ATS_DONE,
  },
];
