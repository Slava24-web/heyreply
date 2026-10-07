import type { WorkFormat } from '@heyreply/shared';
import { cleanCompanyName } from '@heyreply/shared/dist/enums';
import type { Adapter, VacancyData } from '../types';
import { appliedDateFromText } from './dates';

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function firstText(doc: Document, selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const t = clean(el?.textContent);
    if (t) return t;
  }
  return '';
}

interface JsonLdPosting {
  title?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: unknown;
  jobLocationType?: string;
  baseSalary?: { currency?: string; value?: { minValue?: number | string; maxValue?: number | string; value?: number | string } };
  employmentType?: string | string[];
}

/** Schema.org JobPosting embedded for search engines — the most stable source across redesigns. */
export function readJobPosting(doc: Document): JsonLdPosting | null {
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent ?? '');
      const nodes: unknown[] = Array.isArray(data) ? data : data?.['@graph'] ? data['@graph'] : [data];
      const job = nodes.find((n) => (n as { '@type'?: unknown })?.['@type'] === 'JobPosting');
      if (job) return job as JsonLdPosting;
    } catch {
      /* malformed block on the page — skip */
    }
  }
  return null;
}

function decodeEntities(s: string) {
  const ta = globalThis.document?.createElement?.('textarea');
  if (!ta) return s;
  ta.innerHTML = s;
  return ta.value;
}

function locality(loc: unknown): string | null {
  const first = Array.isArray(loc) ? loc[0] : loc;
  const addr = (first as { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } })?.address;
  if (!addr) return null;
  const country = typeof addr.addressCountry === 'string' ? addr.addressCountry : addr.addressCountry?.name;
  return clean(addr.addressLocality || addr.addressRegion || country) || null;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

function formatFromText(text: string): WorkFormat | null {
  if (/удал[её]нн|remote|telecommute|из\s+дома/i.test(text)) return 'REMOTE';
  if (/гибрид|hybrid/i.test(text)) return 'HYBRID';
  return null;
}

/** "Position | Company | LinkedIn", "Вакансия Position в Company — …" etc. */
function fromDocumentTitle(doc: Document): { position: string; company: string } {
  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '';
  const title = clean(og || doc.title);
  const pipe = title.split(/\s+[|·—–-]\s+/).map(clean).filter(Boolean);
  return { position: pipe[0] ?? '', company: pipe[1] ?? '' };
}

/** schema.org microdata (itemprop) — used by boards without JSON-LD, e.g. rabota.ru. */
function readMicrodata(doc: Document): { title: string; company: string } {
  const scope = doc.querySelector('[itemtype*="JobPosting"]') ?? doc;
  const org = scope.querySelector('[itemprop="hiringOrganization"]');
  const orgName = org?.querySelector('[itemprop="name"]');
  return {
    title: clean(scope.querySelector('[itemprop="title"]')?.textContent),
    company: clean(orgName?.getAttribute('content') || orgName?.textContent || (org?.querySelector('[class*="name"]')?.textContent ?? '')),
  };
}

const slugToName = (slug: string) => decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

export function extractVacancy(doc: Document, adapter: Adapter, url?: URL): VacancyData | null {
  const ld = readJobPosting(doc);
  const ldCompany = typeof ld?.hiringOrganization === 'string' ? ld.hiringOrganization : ld?.hiringOrganization?.name;
  const md = readMicrodata(doc);
  const boardTitle = adapter.docTitle?.(clean(doc.title)) ?? null;
  const urlCompany = url ? adapter.companyFromUrl?.(url) : null;

  const positionName =
    clean(firstText(doc, adapter.titleSelectors) || decodeEntities(ld?.title ?? '') || md.title || boardTitle?.position || doc.querySelector('h1')?.textContent) ||
    fromDocumentTitle(doc).position;
  const companyName =
    clean(firstText(doc, adapter.companySelectors) || decodeEntities(ldCompany ?? '') || md.company || boardTitle?.company) ||
    (urlCompany ? slugToName(urlCompany) : '') ||
    fromDocumentTitle(doc).company;
  if (!positionName || !companyName) return null;

  const salary = ld?.baseSalary;
  const remote = ld?.jobLocationType === 'TELECOMMUTE';
  return {
    positionName: positionName.slice(0, 160),
    companyName: cleanCompanyName(companyName).slice(0, 160),
    locationName: locality(ld?.jobLocation),
    workFormat: remote ? 'REMOTE' : formatFromText([ld?.employmentType].flat().join(' ')),
    salaryFrom: num(salary?.value?.minValue ?? salary?.value?.value),
    salaryTo: num(salary?.value?.maxValue),
    currency: salary?.currency && /^[A-Z]{3}$/.test(salary.currency) ? (salary.currency === 'RUR' ? 'RUB' : salary.currency) : null,
  };
}

/**
 * The block around the vacancy title (title, company, apply button) — never the whole page,
 * which may list other vacancies carrying the same "applied" badge.
 */
function titleRegion(doc: Document): Element | null {
  let el: Element | null = doc.querySelector('h1');
  if (!el) return null;
  // Climb while the block stays small; a small page may grow up to <body>, a large one never does
  while (el !== doc.body && el.parentElement && (el.parentElement.textContent?.length ?? 0) < 3000) el = el.parentElement;
  return el;
}

/** Text of the region that carries the "you have applied" marker, with the vacancy title cut out; null when none does. */
export function appliedText(doc: Document, adapter: Adapter): string | null {
  const scoped = adapter.appliedScope?.flatMap((sel) => [...doc.querySelectorAll(sel)]) ?? [];
  // Short pages without a title block are confirmation screens ("…/thanks"): read them whole
  const body = doc.body && (doc.body.textContent?.length ?? 0) < 3000 ? doc.body : null;
  // Confirmations often appear as a toast/dialog outside the title block ("Отклик отправлен", "Application sent")
  const notices = [...doc.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="alert"], [role="status"], [aria-live="polite"], [aria-live="assertive"]')].filter((el) => (el.textContent?.length ?? 0) < 600);
  const regions = [...(scoped.length ? scoped : [titleRegion(doc) ?? body].filter((x): x is Element => !!x)), ...notices];
  // The vacancy title itself is excluded: "Applied Scientist" must not read as an "Applied" badge
  const titles = [doc.querySelector('h1')?.textContent, ...adapter.titleSelectors.map((s) => doc.querySelector(s)?.textContent)].map(clean).filter((t) => t.length > 2);
  for (const el of regions) {
    let text = clean(el.textContent);
    for (const t of titles) text = text.split(t).join(' ');
    if (adapter.appliedMarker.test(text)) return text;
  }
  return null;
}

export const isApplied = (doc: Document, adapter: Adapter) => appliedText(doc, adapter) !== null;

/**
 * When the vacancy page says the user applied ("Applied 3 weeks ago", "Вы откликнулись 12 октября"), that date.
 * A vacancy opened again long after applying would otherwise be recorded as applied today.
 */
export function appliedAtOnPage(doc: Document, adapter: Adapter, now = new Date()): string | null {
  const text = appliedText(doc, adapter);
  return text ? appliedDateFromText(text, now) : null;
}
