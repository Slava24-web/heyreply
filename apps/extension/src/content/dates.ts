const MONTHS: Record<string, number> = {
  // Russian / Ukrainian (stem only: "октября", "жовтня" …)
  январ: 0, янв: 0, січ: 0, феврал: 1, фев: 1, лют: 1, март: 2, мар: 2, берез: 2, апрел: 3, апр: 3, квіт: 3,
  мая: 4, май: 4, трав: 4, июн: 5, чер: 5, июл: 6, лип: 6, август: 7, авг: 7, серп: 7, сентябр: 8, сен: 8, верес: 8,
  октябр: 9, окт: 9, жовт: 9, ноябр: 10, ноя: 10, листоп: 10, декабр: 11, дек: 11, груд: 11,
  // English
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
  august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

/** Words that introduce the date the user applied (not when the vacancy was posted or the status last changed). */
const APPLIED_MARKER = /(?:вы\s+)?откликнул[а-яё]*|отклик\s+(?:отправлен|от)|дата\s+отклика|відгукнул[а-яё]*|applied|application\s+(?:sent|submitted)|submitted|date\s+applied/gi;

const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0);
const valid = (d: Date, y: number, m: number, day: number) => d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;

function relative(s: string, now: Date): Date | null {
  if (/^(?:сегодня|сьогодні|today|just\s+now|только\s+что)/i.test(s)) return noon(now.getFullYear(), now.getMonth(), now.getDate());
  if (/^(?:вчера|вчора|yesterday)/i.test(s)) return noon(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  // "3 days ago", "2w ago", "5 дней назад", "1 mo ago"; hours and minutes mean today
  const m = s.match(/^(\d{1,3})\s*(mo(?:nths?)?|мес[а-я]*|y(?:ears?)?|г(?:ода?)?|лет|w(?:eeks?)?|нед[а-я]*|d(?:ays?)?|д(?:ень|ня|ней)|h(?:ours?|rs?)?|ч(?:аса?|асов)?|m(?:in(?:ute)?s?)?|мин[а-я]*)(?![a-zа-яё])\.?\s*(?:ago|назад|тому)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const day = (back: number) => noon(now.getFullYear(), now.getMonth(), now.getDate() - back);
  if (/^(mo|months?|мес)/.test(unit)) return noon(now.getFullYear(), now.getMonth() - n, now.getDate());
  if (/^(y|г|лет)/.test(unit)) return noon(now.getFullYear() - n, now.getMonth(), now.getDate());
  if (/^(w|нед)/.test(unit)) return day(n * 7);
  if (/^(d|д)/.test(unit)) return day(n);
  if (/^(h|ч|m|мин)/.test(unit)) return day(0);
  return null;
}

/** A date at the very start of `s`: "12 октября 2025", "Oct 12, 2025", "12.10.2025", "2025-10-12", "3 days ago", "yesterday". */
function dateAtStart(s: string, now: Date): Date | null {
  s = s.replace(/^(?:(?:on|от|в|с)(?![a-zа-яё])|[:\s])+/i, '');
  const rel = relative(s, now);
  if (rel) return rel;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return build(Number(m[1]), Number(m[2]) - 1, Number(m[3]), true, now);
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/);
  if (m) return build(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]) - 1, Number(m[1]), true, now);

  const monthWord = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})[a-zа-яё]*\\.?(?:,?\\s+(\\d{4}))?`, 'i');
  m = s.match(monthWord);
  if (m) return build(m[3] ? Number(m[3]) : null, MONTHS[monthKey(m[2])], Number(m[1]), !!m[3], now);
  const wordMonth = new RegExp(`^(${MONTH_RE})[a-zа-яё]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, 'i');
  m = s.match(wordMonth);
  if (m) return build(m[3] ? Number(m[3]) : null, MONTHS[monthKey(m[1])], Number(m[2]), !!m[3], now);
  return null;
}

const monthKey = (w: string) => w.toLowerCase();

/** Without a year the date is the most recent one that is not in the future. */
function build(year: number | null, month: number, day: number, explicitYear: boolean, now: Date): Date | null {
  if (month == null || !day) return null;
  let y = year ?? now.getFullYear();
  let d = noon(y, month, day);
  if (!valid(d, y, month, day)) return null;
  if (d.getTime() > now.getTime() + 86_400_000) {
    if (explicitYear) return null;
    y -= 1;
    d = noon(y, month, day);
    if (!valid(d, y, month, day)) return null;
  }
  return d;
}

/**
 * The date the user applied, read from a card's text. Only a date that directly follows an "applied" marker counts:
 * a card also shows other dates (vacancy posted "2 days ago", status changed) and a wrong date is worse than none.
 */
export function appliedDateFromText(text: string, now = new Date()): string | null {
  const t = text.replace(/\s+/g, ' ');
  for (const m of t.matchAll(APPLIED_MARKER)) {
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 40).trim();
    const d = dateAtStart(after, now);
    if (d) return d.toISOString();
  }
  return null;
}
