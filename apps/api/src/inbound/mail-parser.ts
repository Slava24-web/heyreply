import { simpleParser } from 'mailparser';
import { createHash } from 'node:crypto';
import {
  cleanCompanyName,
  normalizeName,
  PLATFORM_INFO,
  PLATFORM_PATTERNS,
  statusFromText,
  type ImportItem,
  type ImportPlatform,
} from '@heyreply/shared';

export interface MailLink {
  href: string;
  text: string;
}

export interface MailFacts {
  fromAddress: string;
  fromDomain: string;
  subject: string;
  text: string;
  links: MailLink[];
  messageId: string | null;
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function htmlLinks(html: string): MailLink[] {
  const out: MailLink[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    out.push({ href: decodeEntities(m[1]), text: clean(decodeEntities(m[2].replace(/<[^>]+>/g, ' '))) });
  }
  return out;
}

export async function readMail(raw: Buffer): Promise<MailFacts> {
  const mail = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true });
  const from = mail.from?.value?.[0]?.address?.toLowerCase() ?? '';
  const html = typeof mail.html === 'string' ? mail.html : '';
  const text = clean(mail.text || decodeEntities(html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')));
  const textLinks = [...(mail.text ?? '').matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((m) => ({ href: m[0], text: '' }));
  return {
    fromAddress: from,
    fromDomain: from.split('@')[1] ?? '',
    subject: clean(mail.subject),
    text,
    links: [...htmlLinks(html), ...textLinks],
    messageId: mail.messageId ?? null,
  };
}

/* ---------- mailbox forwarding confirmation (Gmail, Yandex, Mail.ru, Outlook) ---------- */

const PROVIDER_DOMAINS = ['google.com', 'yandex.ru', 'yandex.com', 'ya.ru', 'mail.ru', 'outlook.com', 'live.com', 'microsoft.com'];
const isProvider = (host: string) => PROVIDER_DOMAINS.some((d) => host === d || host.endsWith('.' + d));

export function isProviderSender(domain: string) {
  return isProvider(domain);
}

/** Mail providers verify a new forwarding address by sending it a link/code. We surface it to the user. */
export function detectConfirmation(m: MailFacts): { url: string | null; code: string | null } | null {
  if (!isProvider(m.fromDomain)) return null;
  if (!/forwarding|пересылк|переадресац|redirect/i.test(m.subject + ' ' + m.text.slice(0, 500))) return null;
  const url =
    m.links
      .map((l) => l.href)
      .find((h) => {
        try {
          const u = new URL(h);
          return u.protocol === 'https:' && isProvider(u.hostname) && /vf|confirm|verify|подтвер|forward/i.test(u.pathname + u.search);
        } catch {
          return false;
        }
      }) ?? null;
  const code = (m.subject + ' ' + m.text).match(/(?:#|code[:\s]+|код[^\d]{0,20})(\d{6,12})/i)?.[1] ?? null;
  return url || code ? { url, code } : null;
}

/* ---------- job board notification → application ---------- */

const GENERIC_LINK = /^(посмотреть|смотреть|открыть|перейти|подробнее|ответить|view|see|open|go\s+to|apply|details|more)\b/i;

function findVacancy(m: MailFacts, platform: ImportPlatform): { id: string; linkText: string } | null {
  const re = PLATFORM_PATTERNS[platform].vacancyLink;
  for (const l of m.links) {
    let href = l.href;
    try {
      href = decodeURIComponent(href); // tracking redirects often carry the target URL-encoded
    } catch {
      /* keep as is */
    }
    const id = href.match(re)?.[1];
    if (id) return { id, linkText: l.text };
  }
  const id = m.text.match(re)?.[1];
  return id ? { id, linkText: '' } : null;
}

const QUOTED = /[«"“„]([^»"”]{2,160})[»"”]/;

function findPosition(m: MailFacts, linkText: string): string | null {
  if (linkText && linkText.length >= 3 && linkText.length <= 160 && !GENERIC_LINK.test(linkText)) return linkText;
  const quoted = m.subject.match(QUOTED)?.[1] ?? m.text.match(/вакансию\s+[«"“]([^»"”]{2,160})[»"”]/i)?.[1];
  if (quoted) return clean(quoted);
  const source = m.subject + '. ' + m.text.slice(0, 2000);
  const en =
    source.match(/interest in (?:the\s+)?(.{2,120}?)\s+(?:position|role|opening|job)\b/i)?.[1] ??
    source.match(/interview\s+for\s+(?:the\s+)?(.{2,120}?)\s+(?:position|role)\b/i)?.[1] ??
    // "Interview invitation: Security Engineer, Cloud at Ramp", "Absage: Frontend Entwickler"
    m.subject.match(/^[^:]{3,60}:\s*(.{2,120}?)(?:\s+(?:at|bei|chez|в)\s+[^:]{2,60})?$/i)?.[1] ??
    source.match(/(?:application (?:for|to)|applied (?:for|to)|applying (?:for|to)|position of|role of)\s+(?:the\s+)?(.{2,120}?)\s+(?:at|with|position|role)\b/i)?.[1];
  return en ? clean(en) : null;
}

const COMPANY_PATTERNS = [
  // ATS confirmations: "Thank you for applying to GitLab", "…the Account Executive position at GitLab"
  /(?:position|role|opening)\s+(?:at|with)\s+([A-ZА-ЯЁ0-9][^!.,\n]{1,60}?)(?=\s*[!.,\n]|$)/,
  /thank\s*s?\s+(?:you\s+)?for\s+(?:applying|your\s+(?:application|interest))\s+(?:to|at|with|in)\s+([A-ZА-ЯЁ0-9][^!.,\n]{1,60}?)(?=\s*[!.,\n]|$)/i,
  /application (?:was )?(?:sent|submitted) to\s+(.{2,80}?)(?:[!.\n]|$)/i,
  /(?:viewed|downloaded|reviewed) by\s+(.{2,80}?)(?:[!.\n]|$)/i,
  /\b(?:at|with)\s+([A-ZА-ЯЁ0-9][\w&.,'’«»"\- ]{1,70}?)(?=\s+(?:has|have|was|is|viewed|downloaded|reviewed)\b|[!.\n]|$)/,
  // stop before the verb: "Компания IT-hunter просмотрела ваш отклик" → "IT-hunter" (Russian and Ukrainian)
  /(?:компани[яиюей]|компані[яїюєі])\s+[«"“]?([^»"”\n,.!?]{2,80}?)(?=\s+(?:просмотрел|переглянул|пригласил|приглашает|запрош|отклонил|відхилил|отказал|відмовил|рассмотрел|розглянул|ответил|відповіл|хочет|заинтересовал|предлагает|пропонує)|[»"”\n,.!?]|$)/i,
  /(?:работодател[ьяю]|роботодав(?:ець|ця))\s+[«"“]?([^»"”\n,.!?]{2,80}?)(?=\s+(?:просмотрел|переглянул|пригласил|приглашает|запрош|отклонил|відхилил|отказал|відмовил|рассмотрел|ответил|хочет|предлагает)|[»"”\n,.!?]|$)/i,
  // German / French: "bei der Firma Acme", "Arbeitgeber Acme GmbH", "l'entreprise Acme"
  /(?:[Aa]rbeitgeber|[Ff]irma|[Uu]nternehmen)\s+([A-ZÄÖÜ0-9][^!.,\n]{1,60}?)(?=\s+(?:nicht|hat|ist|möchte|freut|bedankt)|[!.,\n]|$)/,
  /(?:[Ll]'entreprise|[Ll]a\s+société|[Cc]hez)\s+([A-Z0-9][^!.,\n]{1,60}?)(?=\s+(?:n'a|a\s|vous|souhaite)|[!.,\n]|$)/,
  /^([A-ZА-ЯЁ0-9][^\n,.!?]{1,60}?)\s+(?:пригласил|приглашает|отклонил|рассмотрел|просмотрел)/,
];

function findCompany(m: MailFacts): string | null {
  const employerLink = m.links.find((l) => /\/employer\/\d+|\/company\/|\/companies\/|\/clients\//i.test(l.href) && l.text.length >= 2 && l.text.length <= 80 && !GENERIC_LINK.test(l.text));
  if (employerLink) return cleanCompanyName(employerLink.text);
  for (const source of [m.subject, m.text.slice(0, 2000)]) {
    for (const re of COMPANY_PATTERNS) {
      const v = source.match(re)?.[1];
      if (v && clean(v).length >= 2) return cleanCompanyName(clean(v));
    }
  }
  return null;
}

/**
 * Turns a board notification into an import item. Returns null when the essentials
 * (vacancy id, company, position) can't be found — the e-mail is then logged as unrecognized.
 */
/** Job alerts and digests list vacancies the user has NOT applied to — never import them. */
const DIGEST = /подборк|новые\s+вакансии|вакансии\s+для\s+вас|рекомендуем|нові\s+вакансії|jobs?\s+(?:for\s+you|you\s+(?:may|might)|alert|recommend)|new\s+jobs|recommended\s+jobs|top\s+jobs|neue\s+(?:jobs|stellen)|jobs\s+für\s+sie|offres\s+(?:d'emploi\s+)?pour\s+vous|weekly|digest/i;

/** ATS confirmations that mean "your application reached the employer". */
const ATS_CONFIRMATION = /thank\s*s?\s+(?:you\s+)?for\s+(?:applying|your\s+application)|application\s+(?:was\s+|has\s+been\s+)?(?:received|submitted)|we(?:'ve|\s+have)\s+received\s+your\s+application/i;

/**
 * ATS e-mails rarely link to the job. For them the id is derived from company + position ("mail-…");
 * the server matches it to the same application recorded by the extension with the real job id.
 */
export function syntheticId(company: string, position: string) {
  return 'mail-' + createHash('sha256').update(`${normalizeName(cleanCompanyName(company))}|${normalizeName(position)}`).digest('hex').slice(0, 24);
}

export function extractApplication(m: MailFacts, platform: ImportPlatform): ImportItem | null {
  if (DIGEST.test(m.subject)) return null;
  const found = findVacancy(m, platform);
  const isAts = PLATFORM_INFO[platform].group === 'ats';
  if (!found && !isAts) return null;
  const positionName = findPosition(m, found?.linkText ?? '');
  const companyName = findCompany(m);
  if (!positionName || !companyName) return null;
  // Without a job link, only accept unmistakable application e-mails (not newsletters or job alerts)
  if (!found && !ATS_CONFIRMATION.test(m.subject + ' ' + m.text.slice(0, 1500)) && !statusFromText(m.subject)) return null;
  const vacancy = found ?? { id: syntheticId(companyName, positionName), linkText: '' };
  // The subject is the most reliable status signal; the body's opening lines are a fallback (footers are noise).
  // No status evidence at all means it isn't about one of the user's applications.
  // A weak subject ("Ответ на ваш отклик" → applied) yields to a stronger signal in the body ("отказал").
  const fromSubject = statusFromText(m.subject);
  const fromBody = statusFromText(m.text.slice(0, 600));
  const status = fromSubject && !(fromSubject === 'APPLIED' && fromBody && fromBody !== 'APPLIED') ? fromSubject : (fromBody ?? fromSubject);
  if (!status) return null;
  return {
    platform,
    externalId: vacancy.id,
    companyName: companyName.slice(0, 160),
    positionName: positionName.slice(0, 160),
    vacancyUrl: found ? PLATFORM_PATTERNS[platform].vacancyUrl(vacancy.id) : null,
    status,
    origin: 'sync',
  };
}
