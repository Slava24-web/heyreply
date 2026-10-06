import type { Adapter, Observed } from '../types';
import { cleanCompanyName } from '@heyreply/shared/dist/enums';
import { statusFromText } from './status';

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Nearest ancestor that holds exactly one vacancy link — i.e. the card of one application. */
function cardOf(link: Element, adapter: Adapter): Element {
  let el: Element = link;
  while (el.parentElement && el.parentElement !== el.ownerDocument.body) {
    const parent = el.parentElement;
    const ids = new Set([...parent.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!.match(adapter.listLink!)?.[1]).filter(Boolean));
    if (ids.size > 1) break;
    el = parent;
  }
  return el;
}

/**
 * "My applications" pages are parsed structurally rather than by CSS classes:
 * every card has a link to the vacancy; the status is a short label inside the card.
 */
export function parseList(doc: Document, adapter: Adapter): Omit<Observed, 'origin'>[] {
  if (!adapter.listLink) return [];
  const seen = new Map<string, Omit<Observed, 'origin'>>();
  for (const link of doc.querySelectorAll('a[href]')) {
    const id = link.getAttribute('href')!.match(adapter.listLink)?.[1];
    if (!id || seen.has(id)) continue;
    const position = clean(link.textContent);
    if (!position || position.length > 160) continue;

    const card = cardOf(link, adapter);
    const company =
      clean(card.querySelector('[data-qa*="company"], [class*="company"], [class*="subtitle"], a[href*="/employer/"], a[href*="/company/"], a[href*="/companies/"]')?.textContent) ||
      (card as HTMLElement).innerText?.split('\n').map(clean).find((l) => l && l !== position) ||
      '';
    if (!company || company === position) continue;

    // Prefer an explicit status element; otherwise read the card text without title and company
    const statusEl = card.querySelector('[data-qa*="state"], [data-qa*="status"], [class*="status"], [class*="state"]');
    const rest = clean(card.textContent).replace(position, ' ').replace(company, ' ');
    const status = statusFromText(clean(statusEl?.textContent)) ?? statusFromText(rest);

    seen.set(id, {
      platform: adapter.platform,
      externalId: id,
      companyName: cleanCompanyName(company).slice(0, 160),
      positionName: position,
      vacancyUrl: adapter.vacancyUrl(id),
      status,
    });
  }
  return [...seen.values()];
}
