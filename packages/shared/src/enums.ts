export const APP_STATUSES = [
  'APPLIED',
  'VIEWED',
  'SCREENING',
  'TEST_TASK',
  'INTERVIEW',
  'FINAL_INTERVIEW',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'DECLINED',
  'NO_RESPONSE',
] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

/** Funnel stage for each status. 0 = terminal status that doesn't move the funnel. */
export const STATUS_STAGE: Record<AppStatus, number> = {
  APPLIED: 1,
  VIEWED: 1,
  SCREENING: 2,
  TEST_TASK: 3,
  INTERVIEW: 4,
  FINAL_INTERVIEW: 4,
  OFFER: 5,
  ACCEPTED: 5,
  REJECTED: 0,
  DECLINED: 0,
  NO_RESPONSE: 0,
};

export const FUNNEL_STAGES = [1, 2, 3, 4, 5] as const;
export const ACTIVE_STATUSES: AppStatus[] = ['APPLIED', 'VIEWED', 'SCREENING', 'TEST_TASK', 'INTERVIEW', 'FINAL_INTERVIEW'];
export const WAITING_STATUSES: AppStatus[] = ['APPLIED', 'VIEWED'];

export const WORK_FORMATS = ['OFFICE', 'HYBRID', 'REMOTE'] as const;
export type WorkFormat = (typeof WORK_FORMATS)[number];

export const SALARY_TYPES = ['GROSS', 'NET'] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const DICTIONARY_TYPES = ['companies', 'positions', 'locations', 'sources', 'tags'] as const;
export type DictionaryType = (typeof DICTIONARY_TYPES)[number];

export const REJECTION_REASONS = ['EXPERIENCE', 'SALARY', 'CLOSED', 'NO_REASON', 'OTHER'] as const;

export const CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'GEL', 'AMD', 'RSD'] as const;

/** System sources with localized names and domains for auto-detection from a vacancy URL. */
/** Job boards and ATS the extension and e-mail import understand (also used as `Application.externalSource`). */
export const IMPORT_PLATFORMS = [
  'hh', 'linkedin', 'habr', 'superjob', 'getmatch', 'indeed',
  'avito', 'rabotaru', 'zarplata', 'trudvsem', 'geekjob', 'djinni', 'workua', 'robotaua',
  'glassdoor', 'ziprecruiter', 'monster', 'wellfound', 'wttj', 'dice', 'stepstone', 'xing',
  'greenhouse', 'lever', 'workable', 'ashby',
] as const;
export type ImportPlatform = (typeof IMPORT_PLATFORMS)[number];

export type PlatformGroup = 'ru' | 'intl' | 'ats';

/** Display names, domains (for URL → source detection) and grouping of every import platform. */
export const PLATFORM_INFO: Record<ImportPlatform, { ru: string; en: string; domains: string[]; group: PlatformGroup }> = {
  hh: { ru: 'HeadHunter', en: 'HeadHunter', domains: ['hh.ru', 'hh.kz', 'headhunter.ru', 'rabota.by'], group: 'ru' },
  linkedin: { ru: 'LinkedIn', en: 'LinkedIn', domains: ['linkedin.com'], group: 'intl' },
  habr: { ru: 'Хабр Карьера', en: 'Habr Career', domains: ['career.habr.com'], group: 'ru' },
  superjob: { ru: 'SuperJob', en: 'SuperJob', domains: ['superjob.ru'], group: 'ru' },
  getmatch: { ru: 'Getmatch', en: 'Getmatch', domains: ['getmatch.ru'], group: 'ru' },
  indeed: { ru: 'Indeed', en: 'Indeed', domains: ['indeed.com'], group: 'intl' },
  avito: { ru: 'Авито Работа', en: 'Avito Jobs', domains: ['avito.ru'], group: 'ru' },
  rabotaru: { ru: 'Работа.ру', en: 'Rabota.ru', domains: ['rabota.ru'], group: 'ru' },
  zarplata: { ru: 'Зарплата.ру', en: 'Zarplata.ru', domains: ['zarplata.ru'], group: 'ru' },
  trudvsem: { ru: 'Работа России', en: 'Rabota Rossii', domains: ['trudvsem.ru'], group: 'ru' },
  geekjob: { ru: 'GeekJob', en: 'GeekJob', domains: ['geekjob.ru'], group: 'ru' },
  djinni: { ru: 'Djinni', en: 'Djinni', domains: ['djinni.co'], group: 'ru' },
  workua: { ru: 'Work.ua', en: 'Work.ua', domains: ['work.ua'], group: 'ru' },
  robotaua: { ru: 'Robota.ua', en: 'Robota.ua', domains: ['robota.ua', 'rabota.ua'], group: 'ru' },
  glassdoor: { ru: 'Glassdoor', en: 'Glassdoor', domains: ['glassdoor.com', 'glassdoor.co.uk', 'glassdoor.de', 'glassdoor.fr', 'glassdoor.ca', 'glassdoor.co.in'], group: 'intl' },
  ziprecruiter: { ru: 'ZipRecruiter', en: 'ZipRecruiter', domains: ['ziprecruiter.com', 'ziprecruiter.co.uk'], group: 'intl' },
  monster: { ru: 'Monster', en: 'Monster', domains: ['monster.com', 'monster.co.uk', 'monster.de'], group: 'intl' },
  wellfound: { ru: 'Wellfound', en: 'Wellfound', domains: ['wellfound.com', 'angel.co'], group: 'intl' },
  wttj: { ru: 'Welcome to the Jungle', en: 'Welcome to the Jungle', domains: ['welcometothejungle.com', 'otta.com'], group: 'intl' },
  dice: { ru: 'Dice', en: 'Dice', domains: ['dice.com'], group: 'intl' },
  stepstone: { ru: 'StepStone', en: 'StepStone', domains: ['stepstone.de', 'stepstone.at', 'stepstone.nl', 'stepstone.be'], group: 'intl' },
  xing: { ru: 'XING', en: 'XING', domains: ['xing.com'], group: 'intl' },
  greenhouse: { ru: 'Greenhouse', en: 'Greenhouse', domains: ['greenhouse.io'], group: 'ats' },
  lever: { ru: 'Lever', en: 'Lever', domains: ['lever.co'], group: 'ats' },
  workable: { ru: 'Workable', en: 'Workable', domains: ['workable.com'], group: 'ats' },
  ashby: { ru: 'Ashby', en: 'Ashby', domains: ['ashbyhq.com'], group: 'ats' },
};

/** Sources pre-created for every new account (the most common ones; the rest appear on first use). */
export const SYSTEM_SOURCES: { key?: ImportPlatform | 'telegram'; ru: string; en: string; domains: string[] }[] = [
  ...(['hh', 'linkedin', 'habr', 'superjob', 'getmatch', 'indeed'] as const).map((key) => ({ key, ...PLATFORM_INFO[key] })),
  { key: 'telegram', ru: 'Telegram', en: 'Telegram', domains: ['t.me', 'telegram.me'] },
  { ru: 'Сайт компании', en: 'Company website', domains: [] },
  { ru: 'Рекомендация', en: 'Referral', domains: [] },
];

export function platformSourceName(platform: ImportPlatform, locale: string): string {
  const i = PLATFORM_INFO[platform];
  return locale === 'en' ? i.en : i.ru;
}

export function systemSourceName(s: (typeof SYSTEM_SOURCES)[number], locale: string): string {
  return locale === 'en' ? s.en : s.ru;
}

export function detectSourceByUrl(url: string, locale: string = 'ru'): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const match = (d: string) => host === d || host.endsWith('.' + d);
    const platform = IMPORT_PLATFORMS.find((p) => PLATFORM_INFO[p].domains.some(match));
    if (platform) return platformSourceName(platform, locale);
    const hit = SYSTEM_SOURCES.find((s) => s.domains.some(match));
    return hit ? systemSourceName(hit, locale) : null;
  } catch {
    return null;
  }
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/ё/g, 'е');
}

const LEGAL_FORMS = /^(ооо|оао|зао|пао|ао|нао|ип|фгуп|муп|гуп|ано|тов|пп|фоп|прат|llc|ltd|inc|gmbh|corp|plc)\.?\s+|[\s,]+(ооо|ао|пао|тов|llc|ltd|inc|gmbh|ag|se|corp|corporation|plc|sas|sarl|s\.?a\.?|b\.?v\.?)\.?$/i;

/** "ООО «Спортдата»" → "Спортдата", "Miro Inc." → "Miro": boards add legal forms that users don't type. */
export function cleanCompanyName(value: string): string {
  let s = value.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const next = s.replace(LEGAL_FORMS, '').replace(/^[«"“„']+|[»"”'"]+$/g, '').trim();
    if (next === s) break;
    s = next;
  }
  return s || value.trim();
}

/** How each platform links to a vacancy (group 1 = id) and which domains its notification e-mails come from. */
export const PLATFORM_PATTERNS: Record<ImportPlatform, { vacancyLink: RegExp; vacancyUrl: (id: string) => string; mailDomains: string[] }> = {
  hh: {
    vacancyLink: /https?:\/\/(?:[\w-]+\.)?(?:hh\.ru|hh\.kz|headhunter\.ru|rabota\.by)\/vacancy\/(\d+)/i,
    vacancyUrl: (id) => `https://hh.ru/vacancy/${id}`,
    mailDomains: ['hh.ru', 'hh.kz', 'headhunter.ru', 'rabota.by'],
  },
  linkedin: {
    vacancyLink: /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^/?#]*?-)?(\d{6,})/i,
    vacancyUrl: (id) => `https://www.linkedin.com/jobs/view/${id}/`,
    mailDomains: ['linkedin.com'],
  },
  habr: {
    vacancyLink: /https?:\/\/career\.habr\.com\/vacancies\/(\d+)/i,
    vacancyUrl: (id) => `https://career.habr.com/vacancies/${id}`,
    mailDomains: ['habr.com', 'habr.ru'],
  },
  superjob: {
    vacancyLink: /https?:\/\/(?:[\w-]+\.)?superjob\.ru\/vakansii\/[^/?#\s"']*?-(\d+)\.html/i,
    vacancyUrl: (id) => `https://www.superjob.ru/vakansii/${id}.html`,
    mailDomains: ['superjob.ru'],
  },
  getmatch: {
    vacancyLink: /https?:\/\/getmatch\.ru\/vacancies\/(\d+)/i,
    vacancyUrl: (id) => `https://getmatch.ru/vacancies/${id}`,
    mailDomains: ['getmatch.ru'],
  },
  indeed: {
    vacancyLink: /https?:\/\/(?:[\w-]+\.)?indeed\.com\/[^\s"'<>]*?[?&](?:jk|vjk)=([\w-]+)/i,
    vacancyUrl: (id) => `https://www.indeed.com/viewjob?jk=${id}`,
    mailDomains: ['indeed.com', 'indeedemail.com'],
  },
  avito: {
    vacancyLink: /https?:\/\/(?:www\.|m\.)?avito\.ru\/[^\s"'<>?#]*?\/vakansii\/[^\s"'<>?#]*?_(\d{6,})/i,
    vacancyUrl: (id) => `https://www.avito.ru/${id}`,
    mailDomains: ['avito.ru'],
  },
  rabotaru: {
    vacancyLink: /https?:\/\/(?:[\w-]+\.)?rabota\.ru\/vacancy\/(\d+)/i,
    vacancyUrl: (id) => `https://www.rabota.ru/vacancy/${id}/`,
    mailDomains: ['rabota.ru'],
  },
  zarplata: {
    vacancyLink: /https?:\/\/(?:[\w-]+\.)?zarplata\.ru\/vacancy\/(?:card\/id)?(\d+)/i,
    vacancyUrl: (id) => `https://zarplata.ru/vacancy/${id}`,
    mailDomains: ['zarplata.ru'],
  },
  trudvsem: {
    vacancyLink: /https?:\/\/(?:www\.)?trudvsem\.ru\/vacancy\/card\/(\d+\/[0-9a-f-]{36})/i,
    vacancyUrl: (id) => `https://trudvsem.ru/vacancy/card/${id}`,
    mailDomains: ['trudvsem.ru'],
  },
  geekjob: {
    vacancyLink: /https?:\/\/geekjob\.ru\/vacancy\/([0-9a-z]{6,})/i,
    vacancyUrl: (id) => `https://geekjob.ru/vacancy/${id}`,
    mailDomains: ['geekjob.ru'],
  },
  djinni: {
    vacancyLink: /https?:\/\/djinni\.co\/jobs\/(\d+)/i,
    vacancyUrl: (id) => `https://djinni.co/jobs/${id}/`,
    mailDomains: ['djinni.co'],
  },
  workua: {
    vacancyLink: /https?:\/\/(?:www\.)?work\.ua\/(?:[a-z]{2}\/)?jobs\/(\d+)/i,
    vacancyUrl: (id) => `https://www.work.ua/jobs/${id}/`,
    mailDomains: ['work.ua'],
  },
  robotaua: {
    vacancyLink: /https?:\/\/(?:www\.)?(?:robota|rabota)\.ua\/(?:[a-z]{2}\/)?(company\d+\/vacancy\d+)/i,
    vacancyUrl: (id) => `https://robota.ua/${id}`,
    mailDomains: ['robota.ua', 'rabota.ua'],
  },
  glassdoor: {
    vacancyLink: /https?:\/\/(?:www\.)?glassdoor\.[a-z.]+\/[^\s"'<>]*?[?&]jl=(\d+)/i,
    vacancyUrl: (id) => `https://www.glassdoor.com/job-listing/?jl=${id}`,
    mailDomains: ['glassdoor.com'],
  },
  ziprecruiter: {
    vacancyLink: /https?:\/\/(?:www\.)?ziprecruiter\.[a-z.]+\/[^\s"'<>]*?[?&]jid=([\w-]+)/i,
    vacancyUrl: (id) => `https://www.ziprecruiter.com/jobs/job?jid=${id}`,
    mailDomains: ['ziprecruiter.com'],
  },
  monster: {
    vacancyLink: /https?:\/\/(?:www\.)?monster\.[a-z.]+\/job-openings\/[^\s"'<>?#]*?--([0-9a-f-]{36})/i,
    vacancyUrl: (id) => `https://www.monster.com/job-openings/--${id}`,
    mailDomains: ['monster.com'],
  },
  wellfound: {
    vacancyLink: /https?:\/\/(?:www\.)?(?:wellfound\.com|angel\.co)\/(?:company\/[^/\s"']+\/)?jobs\/(\d+)/i,
    vacancyUrl: (id) => `https://wellfound.com/jobs/${id}`,
    mailDomains: ['wellfound.com', 'angel.co'],
  },
  wttj: {
    vacancyLink: /https?:\/\/(?:www\.)?welcometothejungle\.com\/[a-z]{2}\/companies\/([a-z0-9-]+\/jobs\/[a-z0-9_-]+)/i,
    vacancyUrl: (id) => `https://www.welcometothejungle.com/en/companies/${id}`,
    mailDomains: ['welcometothejungle.com', 'otta.com'],
  },
  dice: {
    vacancyLink: /https?:\/\/(?:www\.)?dice\.com\/job-detail\/([0-9a-f-]{36})/i,
    vacancyUrl: (id) => `https://www.dice.com/job-detail/${id}`,
    mailDomains: ['dice.com'],
  },
  stepstone: {
    vacancyLink: /https?:\/\/(?:www\.)?stepstone\.[a-z.]+\/stellenangebote--[^\s"'<>]*?--(\d+)-inline\.html/i,
    vacancyUrl: (id) => `https://www.stepstone.de/stellenangebote--x--${id}-inline.html`,
    mailDomains: ['stepstone.de', 'stepstone.com'],
  },
  xing: {
    vacancyLink: /https?:\/\/(?:www\.)?xing\.com\/jobs\/[a-z0-9-]*?-(\d{6,})/i,
    vacancyUrl: (id) => `https://www.xing.com/jobs/-${id}`,
    mailDomains: ['xing.com'],
  },
  greenhouse: {
    vacancyLink: /https?:\/\/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/([a-z0-9_-]+\/jobs\/\d+)/i,
    vacancyUrl: (id) => `https://job-boards.greenhouse.io/${id}`,
    mailDomains: ['greenhouse.io', 'greenhouse-mail.io'],
  },
  lever: {
    vacancyLink: /https?:\/\/jobs(?:\.eu)?\.lever\.co\/([a-z0-9_.-]+\/[0-9a-f-]{36})/i,
    vacancyUrl: (id) => `https://jobs.lever.co/${id}`,
    mailDomains: ['lever.co'],
  },
  workable: {
    vacancyLink: /https?:\/\/apply\.workable\.com\/([a-z0-9_-]+\/j\/[A-Z0-9]{6,})/i,
    vacancyUrl: (id) => `https://apply.workable.com/${id}/`,
    mailDomains: ['workable.com', 'workablemail.com'],
  },
  ashby: {
    vacancyLink: /https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_.%-]+\/[0-9a-f-]{36})/i,
    vacancyUrl: (id) => `https://jobs.ashbyhq.com/${id}`,
    mailDomains: ['ashbyhq.com'],
  },
};

export function platformByMailDomain(domain: string): ImportPlatform | null {
  const d = domain.toLowerCase();
  for (const p of IMPORT_PLATFORMS) if (PLATFORM_PATTERNS[p].mailDomains.some((m) => d === m || d.endsWith('.' + m))) return p;
  return null;
}
