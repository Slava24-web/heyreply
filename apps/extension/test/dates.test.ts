import { describe, expect, it } from 'vitest';
import { appliedDateFromText } from '../src/content/dates';
import { parseList } from '../src/content/list';
import { ADAPTERS } from '../src/content/platforms';

// Wednesday, 6 October 2026 (local time, like the page the user is looking at)
const NOW = new Date(2026, 9, 6, 15, 30);
const day = (iso: string | null) => (iso ? new Date(iso) : null)?.toLocaleDateString('sv') ?? null;
const at = (text: string) => day(appliedDateFromText(text, NOW));

describe('appliedDateFromText', () => {
  it.each([
    ['Вы откликнулись 12 октября 2025', '2025-10-12'],
    ['Вы откликнулись 12 сентября', '2026-09-12'],
    ['Вы откликнулись 20 декабря', '2025-12-20'], // not yet happened this year → last year
    ['Отклик отправлен вчера', '2026-10-05'],
    ['Вы откликнулись сегодня', '2026-10-06'],
    ['Вы откликнулись 3 дня назад', '2026-10-03'],
    ['Вы откликнулись 2 недели назад', '2026-09-22'],
    ['Вы откликнулись 1 месяц назад', '2026-09-06'],
    ['Applied Oct 12, 2025', '2025-10-12'],
    ['Applied on 5 Sep', '2026-09-05'],
    ['Applied 2w ago', '2026-09-22'],
    ['Applied 5d ago', '2026-10-01'],
    ['Applied 3 hours ago', '2026-10-06'],
    ['Applied 3mo ago', '2026-07-06'],
    ['Applied yesterday', '2026-10-05'],
    ['Submitted: 2026-09-30', '2026-09-30'],
    ['Відгукнулись 5 липня', '2026-07-05'],
    ['Дата отклика: 03.10.2026', '2026-10-03'],
  ])('%s → %s', (text, expected) => expect(at(text)).toBe(expected));

  it('ignores dates that are not the application date', () => {
    expect(at('Москва, 2 дня назад')).toBeNull(); // vacancy posted
    expect(at('Frontend Developer Яндекс 12 октября Приглашение')).toBeNull();
    expect(at('Posted 3 days ago · Applied')).toBeNull();
  });
  it('rejects impossible and future dates', () => {
    expect(at('Вы откликнулись 31 февраля')).toBeNull();
    expect(at('Applied Oct 12, 2027')).toBeNull();
  });
  it('takes the date that follows the marker, not an earlier one', () => {
    expect(at('Posted 2 days ago. Applied Sep 1')).toBe('2026-09-01');
  });
});

describe('parseList: applied date', () => {
  const hh = ADAPTERS.find((a) => a.platform === 'hh')!;
  const doc = (html: string) => new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');

  it('reads the date next to the "applied" label and omits it when absent', () => {
    const d = doc(`
      <div class="list">
        <div class="item"><a href="/vacancy/111">Frontend Developer</a><div data-qa="negotiations-item-company">Яндекс</div><span data-qa="negotiations-item-state">Приглашение</span><div>Вы откликнулись 12 сентября</div></div>
        <div class="item"><a href="/vacancy/222">React Developer</a><div data-qa="negotiations-item-company">Ozon</div><span data-qa="negotiations-item-state">Отказ</span><div>2 дня назад</div></div>
      </div>`);
    const items = parseList(d, hh);
    expect(items[0].appliedAt).toBeTruthy();
    expect(items[0].appliedAt!.startsWith('2026') || items[0].appliedAt!.startsWith('2025')).toBe(true);
    expect('appliedAt' in items[1]).toBe(false);
  });

  it('prefers the exact <time datetime> over relative text', () => {
    const d = doc(`
      <ul><li><div><a href="/vacancy/333">Team Lead</a></div><div data-qa="negotiations-item-company">Avito</div><div>Вы откликнулись <time datetime="2025-08-14T09:00:00Z">3 месяца назад</time></div></li></ul>`);
    expect(day(parseList(d, hh)[0].appliedAt!)).toBe('2025-08-14');
  });
});
