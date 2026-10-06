import type { Adapter } from '../types';
import { EXTRA_ADAPTERS } from './platforms-extra';

const param = (url: URL, ...names: string[]) => names.map((n) => url.searchParams.get(n)).find((v) => v && /^[\w-]+$/.test(v)) ?? null;

export const ADAPTERS: Adapter[] = [
  {
    platform: 'hh',
    hosts: /(^|\.)(hh\.ru|hh\.kz|headhunter\.ru|rabota\.by)$/,
    vacancyId: (u) => u.pathname.match(/^\/vacancy\/(\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://hh.ru/vacancy/${id}`,
    // data-qa attributes are hh's own test hooks and survive visual redesigns (verified on a live page)
    titleSelectors: ['[data-qa="vacancy-title"]'],
    companySelectors: ['[data-qa="vacancy-company-name"]'],
    appliedMarker: /вы\s+откликнулись|резюме\s+доставлено|отклик\s+отправлен|вы\s+уже\s+откликались/i,
    // Only the vacancy's own action area: "similar vacancies" cards carry the same badge for other jobs
    appliedScope: ['[data-qa*="vacancy-response"]', '.vacancy-actions'],
    isListPage: (u) => /^\/applicant\/negotiations/.test(u.pathname),
    listLink: /\/vacancy\/(\d+)/,
  },
  {
    platform: 'linkedin',
    hosts: /(^|\.)linkedin\.com$/,
    vacancyId: (u) => u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/)?.[1] ?? param(u, 'currentJobId'),
    vacancyUrl: (id) => `https://www.linkedin.com/jobs/view/${id}/`,
    titleSelectors: ['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', '.top-card-layout__title', '.topcard__title'],
    companySelectors: ['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.topcard__org-name-link', '.top-card-layout__second-subline a'],
    appliedMarker:
      /application\s+(was\s+)?(submitted|sent)|your\s+application\s+was\s+sent|applied\s+(\d+\s+\w+\s+ago|today|yesterday|on\b)|отклик\s+отправлен|ваш\s+отклик\s+отправлен|заявка\s+(отправлена|подана)|вы\s+откликнулись/i,
    // Top card of the open job + the Easy Apply confirmation modal; the job list on the left also shows "Applied" badges
    appliedScope: ['.job-details-jobs-unified-top-card__container--two-pane', '.jobs-unified-top-card', '.jobs-s-apply', '.artdeco-modal[role="dialog"]', '.top-card-layout'],
    isListPage: (u) => /^\/my-items\/saved-jobs/.test(u.pathname) && /applied/i.test(u.search),
    listLink: /\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/,
  },
  {
    platform: 'habr',
    hosts: /^career\.habr\.com$/,
    vacancyId: (u) => u.pathname.match(/^\/vacancies\/(\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://career.habr.com/vacancies/${id}`,
    titleSelectors: ['.page-title__title', 'h1.page-title'],
    companySelectors: ['.company_name a', '.company_name', '.vacancy-company__title'],
    appliedMarker: /вы\s+откликнулись|отклик\s+отправлен|вы\s+уже\s+откликнулись|you\s+(have\s+)?applied|response\s+sent/i,
    isListPage: (u) => /^\/(responses|my\/responses|vacancies\/responses)/.test(u.pathname),
    listLink: /\/vacancies\/(\d+)/,
  },
  {
    platform: 'superjob',
    hosts: /(^|\.)superjob\.ru$/,
    vacancyId: (u) => u.pathname.match(/\/vakansii\/[^/]*-(\d+)\.html/)?.[1] ?? null,
    vacancyUrl: (id) => `https://www.superjob.ru/vakansii/${id}.html`,
    titleSelectors: ['h1'],
    companySelectors: ['[class*="company"] a[href*="/clients/"]', 'a[href*="/clients/"]'],
    appliedMarker: /вы\s+откликнулись|отклик\s+отправлен|резюме\s+отправлено/i,
  },
  {
    platform: 'getmatch',
    hosts: /(^|\.)getmatch\.ru$/,
    vacancyId: (u) => u.pathname.match(/^\/vacancies\/(\d+)/)?.[1] ?? null,
    vacancyUrl: (id) => `https://getmatch.ru/vacancies/${id}`,
    titleSelectors: ['h1'],
    companySelectors: ['a[href^="/companies/"]', '[class*="company-name"]', '[class*="companyName"]'],
    appliedMarker: /вы\s+откликнулись|отклик\s+отправлен|заявка\s+отправлена|you\s+applied/i,
  },
  {
    platform: 'indeed',
    hosts: /(^|\.)indeed\.com$/,
    vacancyId: (u) => param(u, 'jk', 'vjk'),
    vacancyUrl: (id) => `https://www.indeed.com/viewjob?jk=${id}`,
    titleSelectors: ['[data-testid="jobsearch-JobInfoHeader-title"]', 'h1.jobsearch-JobInfoHeader-title', 'h1'],
    companySelectors: ['[data-testid="inlineHeader-companyName"]', '[data-company-name]', '.jobsearch-CompanyInfoWithoutHeaderImage a'],
    appliedMarker: /application\s+(has\s+been\s+)?submitted|you\s+applied|applied\s+on\b|you'?ve\s+applied/i,
    isListPage: (u) => u.hostname.startsWith('myjobs.') && /applied/i.test(u.pathname + u.search),
    listLink: /[?&](?:jk|vjk)=([\w-]+)/,
  },
];

ADAPTERS.push(...EXTRA_ADAPTERS);

export function adapterFor(url: URL): Adapter | null {
  return ADAPTERS.find((a) => a.hosts.test(url.hostname)) ?? null;
}
